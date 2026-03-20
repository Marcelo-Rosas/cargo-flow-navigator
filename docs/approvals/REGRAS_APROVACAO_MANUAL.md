# Regras para Aprovação Manual

Este documento descreve **quando** uma solicitação de aprovação manual é criada e **onde** a lógica está no código.

---

## ⚠️ Regra importante: Risco é em OS, não em cotação

- **Avaliação de risco (`risk_evaluation`)** e **gate de risco (`risk_gate`)** existem apenas para **Ordem de Serviço (OS)** e **Viagem (VG)**.
- **Cotação (COT)** em estágio **negociacao**, **precificacao**, **enviado** etc. **não** passa por `evaluate-risk` e **não** deve ter aprovação do tipo `risk_gate`.
- Se aparecer uma aprovação **risk_gate** (ou mensagem “não possui risk_evaluation”) para uma **cotação** ainda em negociação, isso está **fora da regra** do desenho atual: pode ser dado inconsistente (ex.: `entity_type`/`entity_id` errados), processo legado ou outro sistema criando a solicitação. O correto é:
  - **Cotações** → aprovação só quando forem para `pending_approval` e o **auto-approval-worker** retornar `flagged_for_review` → tipo **`quote_risk_review`**.
  - **OS** → aprovação **`risk_gate`** só após **evaluate-risk** com criticidade HIGH/CRITICAL.

---

## 1. Resumo por tipo de entidade

| Entidade            | Tipo de aprovação     | Quando aparece                    | Onde é criada                    |
|---------------------|------------------------|------------------------------------|-----------------------------------|
| **Cotação (quote)** | `quote_risk_review`    | Cotação não atende critérios de auto-aprovação | `auto-approval-worker`          |
| **OS (order)**      | `risk_gate`            | Avaliação de risco HIGH/CRITICAL   | `evaluate-risk` (Edge Function)   |
| **OS (order)**      | `compliance_override`  | Violação de compliance             | `workflow-orchestrator`          |
| **Documento financeiro** | Por regra (ex.: `financial_release`, `pag_approval`) | Valor acima do limite ou tipo PAG | `workflow-orchestrator` (handleFinancialStatusChanged) |

---

## 2. Cotação (quote) → aprovação manual

**Regra:** quando a cotação vai para o estágio `pending_approval`, o **workflow-orchestrator** chama o **auto-approval-worker**. O worker avalia critérios e decide:

- **auto_approved** → não cria aprovação; a cotação pode seguir.
- **flagged_for_review** → cria uma `approval_request` com:
  - `entity_type: 'quote'`
  - `approval_type: 'quote_risk_review'`
  - `title`: `Revisão de Risco — COT {id.slice(0,8)}`
  - `description`: `Cotação não atende critérios de aprovação automática. Motivos: {reasons}.`

**Critérios do auto-approval-worker** (todos precisam ser atendidos para auto-aprovar):

- `risk_score < 30`
- `margin_percentage > 15`
- Cliente sem inadimplência
- Compliance OK
- Sem restrições de rota bloqueantes

**Arquivos:**

- `supabase/functions/workflow-orchestrator/index.ts` → `handleQuoteStageChanged` (quando `new_stage === 'pending_approval'`)
- `supabase/functions/auto-approval-worker/index.ts` → critérios, `decide()`, e `insert` em `approval_requests`

---

## 3. OS (order) → risk_gate (gate de risco)

**Regra:** quando uma **OS** passa pela avaliação de risco (Edge Function **evaluate-risk**) e a criticidade é **HIGH** ou **CRITICAL** (ou não pode auto-aprovar), é criada uma `approval_request`:

- `entity_type: 'order'`
- `approval_type: 'risk_gate'`
- `title`: `Aprovação de Risco — OS {order_id.slice(0,8)}`
- `description`: `Criticidade: {criticality}. Valor carga: R$ {...}. Requisitos: {requirements}.`

**Condição para não auto-aprovar:**  
`canAutoApprove = (criticality === 'LOW' || criticality === 'MEDIUM') && requirements.length <= 2`.  
Se `!canAutoApprove` → cria aprovação manual.

**Arquivos:**

- `supabase/functions/evaluate-risk/index.ts` → trecho “Create approval_request for HIGH/CRITICAL”
- Regra em DB: `approval_rules` com `entity_type = 'order'`, `approval_type = 'risk_gate'`, `trigger_condition = {"stage": "documentacao", "risk_gate": true}` (ver migration `20260407000000_risk_workflow_tables.sql`).

**Observação:** `risk_evaluations` e `risk_gate` são usados para **ordens (OS)** e **trips**, não para cotações. A tabela `risk_evaluations` tem `entity_type` em ('order', 'trip').

---

## 4. Documento financeiro → aprovação por valor/tipo

**Regra:** no **workflow-orchestrator**, em `handleFinancialStatusChanged`, quando o status do documento passa para `GERADO`:

- Consulta `approval_rules` com `entity_type = 'financial_document'`.
- Se o valor (ou tipo) atende à `trigger_condition` da regra → cria `approval_request` com:
  - `entity_type: 'financial_document'`
  - `approval_type` e `assigned_to_role` vindos da regra.
  - `title` / `description` montados com valor e tipo do documento.

**Arquivos:**

- `supabase/functions/workflow-orchestrator/index.ts` → `handleFinancialStatusChanged`

---

## 5. Violação de compliance (OS)

**Regra:** quando o workflow processa um evento de **compliance violation**:

- Cria `approval_request` com:
  - `entity_type: 'order'`
  - `approval_type: 'compliance_override'`
  - `title`: `Violação de Compliance - {os_number}`
  - `description`: `Compliance check ({check_type}) encontrou violações que requerem revisão.`

**Arquivos:**

- `supabase/functions/workflow-orchestrator/index.ts` → `handleComplianceViolation`

---

## 6. Sobre a mensagem “Quote … não possui risk_evaluation. Requer aprovação manual”

No código atual do repositório **não** há nenhum trecho que preencha `title` ou `description` com o texto exato **“não possui risk_evaluation. Requer aprovação manual”** ou **“Aprovação Manual — sem avaliação de risco”**.

Os fluxos encontrados são:

- **Cotações:** aprovação criada pelo **auto-approval-worker** com tipo `quote_risk_review` e descrição *“Cotação não atende critérios de aprovação automática. Motivos: …”*.
- **OS:** aprovação de risco criada pelo **evaluate-risk** com tipo `risk_gate` e descrição *“Criticidade: … Valor carga: … Requisitos: …”*.

Se no seu ambiente aparece um card de aprovação com:

- **Tipo:** `risk_gate`
- **Entidade:** cotação (Quote COT-…)
- **Descrição:** “Quote … não possui risk_evaluation. Requer aprovação manual.”

então essa combinação pode vir de:

1. **Outro serviço ou script** que insere em `approval_requests` com essa descrição (por exemplo, quando a cotação é enviada para aprovação e não existe `risk_evaluation` para a entidade relacionada).
2. **Frontend ou API** que cria a solicitação de aprovação quando o usuário aciona “enviar para aprovação” e o sistema verifica ausência de `risk_evaluation`.
3. **Versão antiga** de alguma Edge Function ou job que já tenha sido alterada no repositório.

**Recomendação:** procurar no projeto por:

- `approval_requests` + `insert` (ou `.from('approval_requests').insert`).
- Textos como `risk_evaluation`, `sem avaliação`, `Requer aprovação manual`, `Aprovação Manual`.

Se quiser padronizar a mensagem para cotações sem avaliação de risco, o lugar mais coerente seria o **auto-approval-worker** (ao criar `quote_risk_review`) ou um novo fluxo específico que crie aprovação para “cotação sem risk_evaluation”, com título e descrição centralizados nesse ponto.

### 6.1 Cotação em negociação com aprovação risk_gate — fora da regra

Se uma **cotação** (ex.: COT-2026-03-0027) ainda está em estágio **negociacao** (ou qualquer estágio antes de virar OS) e aparece na fila de aprovações com tipo **risk_gate** ou mensagem "não possui risk_evaluation":

- **Pela regra do código:** isso não deveria ocorrer. Risco é avaliado em **OS**, não em COT.
- **O que verificar no banco:** na tabela `approval_requests`, conferir `entity_type` e `entity_id` do registro.
  - Se `entity_type = 'quote'` e `entity_id` = id da cotação → a aprovação foi criada para cotação; no código atual **nenhum** fluxo cria `risk_gate` para quote, então a origem é outra (script, integração, versão antiga).
  - Se `entity_type = 'order'` e `entity_id` = id de uma OS → a aprovação é da OS; a descrição pode ter sido montada com o código da cotação ligada à OS. Aí a regra está certa; o que pode estar estranho é a cotação ter voltado para negociacao enquanto a OS já existe.
- **Ação recomendada:** não criar novas aprovações **risk_gate** para cotações; manter risk_gate apenas para OS (e trip). Se existirem registros com `entity_type = 'quote'` e `approval_type = 'risk_gate'`, tratá-los como fora da regra e corrigir o processo que os gerou.

---

## 7. Onde a Análise AI (Risco médio/alto/baixo) vem

No modal de aprovação, o **“Risco (Análise AI): médio”** (ou baixo/alto) é gerado pela Edge Function **ai-approval-summary-worker**, chamada pelo frontend quando o usuário abre o modal para uma aprovação pendente sem análise já salva. O worker:

- Lê a `approval_request` e a entidade (quote, order ou financial_document).
- Monta um prompt e chama o Gemini.
- O modelo devolve um JSON com `risk`, `summary`, `recommendation`, `key_points`.
- O resultado é gravado em `ai_insights` e usado no modal como “Análise AI”.

Ou seja: a **classificação de risco da Análise AI** é independente do fluxo de **risk_evaluation** (tabela `risk_evaluations`, usado para OS/trip). A primeira é apenas um resumo de apoio à decisão no modal; a segunda é o fluxo formal de avaliação de risco (ordem/viagem).
