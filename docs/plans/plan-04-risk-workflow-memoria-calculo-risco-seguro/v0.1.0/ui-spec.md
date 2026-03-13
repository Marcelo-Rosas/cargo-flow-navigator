---
document: UI Spec
plan: plan-04-risk-workflow-memoria-calculo-risco-seguro
version: v0.1.0
created_at: 2026-03-07
ui_choice: UI-B Risk Workflow Wizard + trilha auditavel
---

# UI Spec — Risk Workflow Wizard + Paineis de Risco

## 1. Componentes novos

| Componente | Onde aparece | Fase |
|-----------|-------------|------|
| `RiskWorkflowWizard` | OrderDetailModal (tab "Risco") | 2 |
| `RiskStatusCard` | OrderDetailModal (acima das tabs) | 2 |
| `RiskCriticalityBadge` | OrderDetailModal, TripDetailModal, listas | 2 |
| `BuonnyStatusIndicator` | Wizard passo 1, RiskStatusCard | 2 |
| `RiskRequirementChecklist` | Wizard passo 2 | 2 |
| `RiskEvidencePanel` | Wizard passo 3 | 2 |
| `TripRiskPanel` | TripDetailModal (tab "Risco VG") | 2 |
| `QuoteRiskEstimate` | QuoteDetailModal (card inline) | 2 |
| `DreV5Tab` | QuoteModalCostCompositionTab (subtab "DRE v5") | 3 |

---

## 2. RiskWorkflowWizard — Detalhamento

### 2.1 Localizacao

- Dentro de `OrderDetailModal.tsx`
- Nova tab "Risco" no `TabsList` (entre "Composicao" e "Historico")
- Visivel quando `order.stage` IN (`documentacao`, `coleta_realizada`, `em_transito`, `entregue`)
- Editavel somente quando `order.stage = 'documentacao'`

### 2.2 Estados do Wizard

```typescript
type WizardState =
  | 'not_started'      // Avaliacao nao criada ainda
  | 'step_1_buonny'    // Verificacao Buonny
  | 'step_2_rules'     // Regras e criticidade
  | 'step_3_evidence'  // Upload de evidencias
  | 'step_4_submit'    // Revisao e envio
  | 'submitted'        // Enviado para aprovacao
  | 'approved'         // Aprovado
  | 'rejected';        // Rejeitado (pode reiniciar)
```

### 2.3 Passo 1 — Status Buonny

**Layout:**
```
+----------------------------------------------------------+
| Passo 1 de 4: Verificacao Buonny                         |
+----------------------------------------------------------+
|                                                          |
|  Motorista: [João da Silva]  CPF: [***.***.***-00]       |
|  Veiculo:   [ABC-1234]      Tipo: [Truck]                |
|                                                          |
|  +----------------------------------------------------+  |
|  | Status Buonny                                      |  |
|  |                                                    |  |
|  |  [●] Aprovado    Valido ate: 15/06/2026            |  |
|  |      Consulta ID: BNY-2026-001234                  |  |
|  |      Cadastro: Sim                                 |  |
|  |      Monitoramento: Nao ativo                      |  |
|  +----------------------------------------------------+  |
|                                                          |
|  [Consultar Buonny]  (loading spinner quando em andamento)|
|                                                          |
|  Ultima consulta: 05/03/2026 14:30                       |
|  Validade restante: 87 dias                              |
|                                                          |
|                              [Proximo →]                 |
+----------------------------------------------------------+
```

**Comportamento:**
- Se nao ha consulta valida: botao "Consultar Buonny" em destaque
- Se consulta valida (< 90 dias): badge verde "Aprovado" + data validade
- Se consulta expirada: badge amarelo "Expirado" + botao "Reconsultar"
- Se reprovado: badge vermelho "Reprovado" + bloqueio dos proximos passos
- Se em analise: badge amarelo "Em Analise" + auto-refresh a cada 30s
- Se nao cadastrado: badge azul "Nao Cadastrado" + botao "Solicitar Cadastro"
- Botao "Proximo" desabilitado ate consulta valida

**Hook:** `useRiskEvaluation(orderId)` + `useBuonnyCheck()`

### 2.4 Passo 2 — Regras e criticidade

**Layout:**
```
+----------------------------------------------------------+
| Passo 2 de 4: Avaliacao de Criticidade                   |
+----------------------------------------------------------+
|                                                          |
|  Valor da Carga: R$ 180.000,00                           |
|  Distancia: 1.200 km                                     |
|  Rota: SC → SP (Joinville → Guarulhos)                   |
|                                                          |
|  +----------------------------------------------------+  |
|  | Criticidade: [██ ALTA]                             |  |
|  |                                                    |  |
|  | Regras aplicadas:                                  |  |
|  | ✓ Valor R$ 150.001-500.000 → HIGH                  |  |
|  | ✓ Distancia > 1.000 km → +1 nivel                  |  |
|  |                                                    |  |
|  | Resultado final: HIGH (maximo entre regras)        |  |
|  +----------------------------------------------------+  |
|                                                          |
|  Exigencias determinadas:                                |
|  ☑ Consulta Buonny .............. R$ 13,76 (obrigatoria) |
|  ☑ Cadastro Buonny .............. R$ 42,10 (obrigatorio) |
|  ☑ Monitoramento Buonny ......... R$ 252,78 (obrigatorio)|
|  ☑ Analise GR (documento) ....... upload necessario      |
|  ☑ Rota documentada ............. upload necessario      |
|  ☐ Aprovacao gerencial .......... automatica (HIGH)      |
|                                                          |
|  Custo estimado de risco: R$ 308,64                      |
|                                                          |
|                    [← Anterior]  [Proximo →]             |
+----------------------------------------------------------+
```

**Comportamento:**
- Criticidade calculada automaticamente ao entrar no passo
- Regras aplicadas mostradas com checkmark e explicacao
- Exigencias listadas com status (atendida/pendente)
- Custo estimado de risco somado
- Se trip: mostra nota "Esta OS faz parte da VG #{trip_number}"
- Botao "Proximo" sempre habilitado (exigencias verificadas no passo 3)

### 2.5 Passo 3 — Evidencias

**Layout:**
```
+----------------------------------------------------------+
| Passo 3 de 4: Evidencias e Documentacao                  |
+----------------------------------------------------------+
|                                                          |
|  Exigencias pendentes:                                   |
|                                                          |
|  ☑ Consulta Buonny ......... Valida (15/06/2026)        |
|  ☑ Cadastro Buonny ......... Cadastrado                  |
|  ☐ Monitoramento ........... [Ativar Monitoramento]      |
|  ☐ Analise GR .............. [Upload GR]                 |
|  ☑ Rota documentada ........ Webrouter (12 pracas)       |
|  ☑ CNH motorista ........... Valida (doc #abc123)        |
|  ☑ CRLV veiculo ............ Valido (doc #def456)        |
|                                                          |
|  +----------------------------------------------------+  |
|  | Upload de Documentos                               |  |
|  |                                                    |  |
|  | [Arrastar arquivo aqui ou clicar para selecionar]  |  |
|  |                                                    |  |
|  | Tipo: [Analise GR ▼]                               |  |
|  +----------------------------------------------------+  |
|                                                          |
|  Notas adicionais:                                       |
|  [_______________________________________________]       |
|                                                          |
|                    [← Anterior]  [Proximo →]             |
+----------------------------------------------------------+
```

**Comportamento:**
- Lista de exigencias com status em tempo real
- Documentos ja uploaded (de stages anteriores) mostrados como "atendidos"
- Upload inline com `DocumentUpload` component reutilizado
- Buonny consulta/cadastro: status do passo 1
- Monitoramento: botao para ativar (chama `buonny-check` com flag monitoramento)
- Rota: se `tollPlazas` existem no breakdown, auto-atendido
- Botao "Proximo" habilitado somente quando TODAS as exigencias obrigatorias atendidas
- Notas: campo livre para justificativas

### 2.6 Passo 4 — Revisao e envio

**Layout:**
```
+----------------------------------------------------------+
| Passo 4 de 4: Revisao e Envio para Aprovacao             |
+----------------------------------------------------------+
|                                                          |
|  Resumo da Avaliacao de Risco                            |
|                                                          |
|  OS: #OS-2026-0042                                       |
|  Criticidade: [██ ALTA]                                  |
|  Motorista: Joao da Silva (Buonny: Aprovado)             |
|  Veiculo: ABC-1234                                       |
|  Valor carga: R$ 180.000,00                              |
|  Rota: SC → SP (1.200 km)                                |
|                                                          |
|  Exigencias:                                             |
|  ☑ Consulta Buonny (valida)                              |
|  ☑ Cadastro Buonny                                       |
|  ☑ Monitoramento (ativado)                               |
|  ☑ Analise GR (doc #xyz789)                              |
|  ☑ Rota documentada (12 pracas)                          |
|                                                          |
|  Custo de risco: R$ 308,64                               |
|                                                          |
|  +----------------------------------------------------+  |
|  | ⚠ Esta avaliacao sera enviada para aprovacao       |  |
|  |   gerencial (criticidade ALTA).                    |  |
|  |   Aprovador: admin                                 |  |
|  +----------------------------------------------------+  |
|                                                          |
|  Se LOW/MEDIUM com tudo atendido:                        |
|  +----------------------------------------------------+  |
|  | ✓ Aprovacao automatica — todas as exigencias       |  |
|  |   atendidas para criticidade [MEDIA/BAIXA].        |  |
|  +----------------------------------------------------+  |
|                                                          |
|                    [← Anterior]  [Enviar para Aprovacao] |
+----------------------------------------------------------+
```

**Comportamento:**
- Resumo completo da avaliacao
- Se `criticidade <= MEDIUM` e todas exigencias atendidas: aprovacao automatica
  - Botao diz "Aprovar e Liberar" em vez de "Enviar para Aprovacao"
  - Cria `approval_request` com status `approved` + `decided_by = 'system'`
- Se `criticidade >= HIGH`: botao "Enviar para Aprovacao"
  - Cria `approval_request` com status `pending`
  - Mostra quem vai aprovar (role)
- Apos envio: wizard muda para estado `submitted`
- Tela de `submitted`: badge "Pendente de Aprovacao" + link para Aprovacoes

---

## 3. RiskStatusCard — Resumo inline

### 3.1 Localizacao

- Acima das tabs no `OrderDetailModal`, abaixo do header
- Sempre visivel quando `order.stage >= documentacao`
- Compacto (1 linha quando aprovado; expandido quando pendente)

### 3.2 Layout compacto (aprovado)

```
+----------------------------------------------------------+
| ✓ Risco Aprovado | Criticidade: MEDIA | Buonny: Valido   |
|   Custo risco: R$ 13,76 | Aprovado em 06/03 por Sistema  |
+----------------------------------------------------------+
```

### 3.3 Layout expandido (pendente/rejeitado)

```
+----------------------------------------------------------+
| ⚠ Avaliacao de Risco Pendente                            |
|                                                          |
|  Criticidade: [██ ALTA]     Buonny: [Nao consultado]     |
|  Exigencias: 2/5 atendidas  Custo est.: R$ 308,64       |
|                                                          |
|  [Iniciar Avaliacao de Risco →]                          |
+----------------------------------------------------------+
```

---

## 4. RiskCriticalityBadge

```typescript
interface RiskCriticalityBadgeProps {
  criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  size?: 'sm' | 'md';
}

// Cores
const CRITICALITY_COLORS = {
  LOW: 'bg-green-100 text-green-700 border-green-200',
  MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
  HIGH: 'bg-red-100 text-red-700 border-red-200',
  CRITICAL: 'bg-red-200 text-red-900 border-red-400',
};

const CRITICALITY_LABELS = {
  LOW: 'Baixo',
  MEDIUM: 'Medio',
  HIGH: 'Alto',
  CRITICAL: 'Critico',
};
```

---

## 5. TripRiskPanel — VG consolidado

### 5.1 Localizacao

- Nova tab "Risco VG" no `TripDetailModal`
- Visivel sempre que trip tem orders

### 5.2 Layout

```
+----------------------------------------------------------+
| Risco da Viagem — VG #VG-2026-0015                       |
+----------------------------------------------------------+
|                                                          |
|  Criticidade VG: [██ ALTA]                               |
|  Soma valor carga: R$ 470.000,00                         |
|  Qtd OS: 3                                               |
|                                                          |
|  +---------+------------+-----------+---------+---------+|
|  | OS      | Carga (R$) | Crit. OS  | Buonny  | Status  ||
|  +---------+------------+-----------+---------+---------+|
|  | OS-042  | 180.000    | ALTA      | Valid   | Aprov   ||
|  | OS-043  | 120.000    | MEDIA     | Valid   | Pend    ||
|  | OS-044  | 170.000    | ALTA      | N/A     | N/A     ||
|  +---------+------------+-----------+---------+---------+|
|                                                          |
|  Custo risco VG:                                         |
|  • Buonny Consulta: R$ 13,76 (1x por VG)                |
|  • Buonny Monitoramento: R$ 252,78 (1x por VG)          |
|  • Total: R$ 266,54                                      |
|                                                          |
|  Gate VG: ⚠ 1 de 3 OS aprovadas                         |
|  [Todas as OS devem ter risco aprovado para liberar VG]  |
+----------------------------------------------------------+
```

---

## 6. QuoteRiskEstimate — Card no QuoteDetailModal

### 6.1 Localizacao

- Inline na area de Composicao ou como card separado
- Visivel quando `breakdown.riskCosts` existe (v5) ou estimado de GRIS/TSO/RCTR-C

### 6.2 Layout

```
+----------------------------------------------------------+
| Risco e Seguro (estimativa)                              |
+----------------------------------------------------------+
|                                                          |
|  Repasse ao cliente (receita):                           |
|  • GRIS (0.30%): R$ 540,00                              |
|  • TSO (0.15%): R$ 270,00                               |
|  • RCTR-C (0.30%): R$ 540,00                            |
|  Subtotal repasse: R$ 1.350,00                           |
|                                                          |
|  Custo real estimado:                                    |
|  • Buonny Consulta: R$ 13,76 (obrigatorio)              |
|  • Buonny Monitoramento: R$ 252,78 (se HIGH+)           |
|  Subtotal custo: R$ 13,76 — R$ 266,54                   |
|                                                          |
|  Margem de risco: R$ 1.083,46 — R$ 1.336,24             |
|                                                          |
|  ℹ Valores de repasse ja inclusos no Total Cliente.      |
|    Custos reais dependem da criticidade na OS.           |
+----------------------------------------------------------+
```

---

## 7. DRE v5 — Nova aba de composicao

### 7.1 Localizacao

- Sub-tab dentro de "Composicao" no `QuoteModalCostCompositionTab`
- Tab "DRE" mostra v5 quando `breakdown.version = '5.x'`; mostra v4 para legado

### 7.2 Layout DRE v5

```
+----------------------------------------------------------+
| DRE (Asset-Light v5)                                     |
+----------------------------------------------------------+
|                                                          |
| (+) Receita de Frete .................. R$ 8.650,00      |
| (+) Receita de Repasse de Risco ....... R$ 1.350,00  NEW |
|     • GRIS (0.30%) .................... R$ 540,00        |
|     • TSO (0.15%) ..................... R$ 270,00        |
|     • RCTR-C (0.30%) .................. R$ 540,00        |
| (+) DAS (14%) ......................... R$ 1.400,00      |
| (+) ICMS (0%) ......................... R$ 0,00          |
| (=) Total Cliente ..................... R$ 11.400,00      |
|                                                          |
| (-) DAS ................................ -R$ 1.400,00     |
| (-) ICMS ............................... -R$ 0,00        |
| (=) Receita Liquida ................... R$ 10.000,00      |
|                                                          |
| (-) Overhead (15%) .................... -R$ 1.500,00      |
| (-) Custos Diretos:                                      |
|     • Custo Motorista (Frete Base) .... -R$ 5.000,00     |
|     • Pedagio .......................... -R$ 500,00  NEW  |
|     • Carga/Descarga .................. -R$ 200,00       |
| (-) Custos Reais de Risco:                           NEW |
|     • Buonny Consulta ................. -R$ 13,76        |
|     • Buonny Monitoramento ............ -R$ 252,78       |
|                                                          |
| (=) Resultado Liquido ................. R$ 2.533,46      |
|     Margem: 22.2%  [████████████░░░] meta: 15%          |
|                                                          |
| ℹ Nota: GRIS/TSO/RCTR-C sao valores repassados ao       |
|   cliente para cobertura de seguro/risco. Nao sao custos |
|   do transportador. Custos reais de risco (Buonny) sao   |
|   despesas efetivas da operacao.                         |
+----------------------------------------------------------+
```

### 7.3 Badge de versao

Quando breakdown.version = '4.x':
```
+----------------------------------------------------------+
| ⚠ Calculo legado (v4) — GRIS/TSO/RCTR-C classificados   |
|   como custo. Clique "Recalcular" para atualizar.        |
+----------------------------------------------------------+
```

---

## 8. Integracao com Aprovacoes

### 8.1 ApprovalModal — suporte a risk_gate

Quando `approval_type = 'risk_gate'`:

```
+----------------------------------------------------------+
| Aprovacao de Risco — OS #OS-2026-0042                    |
+----------------------------------------------------------+
|                                                          |
|  [██ ALTA]  Valor carga: R$ 180.000                      |
|                                                          |
|  Resumo da avaliacao:                                    |
|  • Buonny: Aprovado (valido ate 15/06)                   |
|  • Monitoramento: Ativo                                  |
|  • GR: Documento uploaded                                |
|  • Rota: 12 pracas de pedagio                            |
|                                                          |
|  Custo de risco: R$ 308,64                               |
|                                                          |
|  Observacoes do solicitante:                             |
|  "Carga de valor alto, rota interestadual SC-SP..."      |
|                                                          |
|  Decisao:                                                |
|  [_______________________________________________]       |
|                                                          |
|  [Rejeitar]                            [Aprovar]         |
+----------------------------------------------------------+
```

### 8.2 ApprovalList — filtro risk_gate

- Novo filtro rapido "Risco" no seletor de tipos
- Badge de criticidade na listagem
- Contagem no sidebar/topbar (junto com outros pendentes)

---

## 9. Hooks necessarios

| Hook | Responsabilidade |
|------|-----------------|
| `useRiskEvaluation(entityType, entityId)` | CRUD + status da avaliacao |
| `useRiskPolicies()` | Listar apolices ativas |
| `useRiskPolicyRules(policyId)` | Regras de uma apolice |
| `useRiskServicesCatalog()` | Servicos disponiveis (Buonny) |
| `useEvaluateRisk()` | Mutation: chamar Edge `evaluate-risk` |
| `useBuonnyCheck()` | Mutation: chamar Edge `buonny-check` |
| `useRiskEvidence(evaluationId)` | Listar evidencias de uma avaliacao |
| `useRiskCosts(orderId?, tripId?)` | Custos reais de risco |
| `useTripRiskSummary(tripId)` | View `vw_trip_risk_summary` |
| `useOrderRiskStatus(orderId)` | View `vw_order_risk_status` |

---

## 10. data-testid

| Elemento | data-testid |
|---------|-------------|
| Tab Risco (OrderDetailModal) | `order-tab-risk` |
| Wizard container | `risk-wizard` |
| Wizard step indicator | `risk-wizard-step-{1-4}` |
| Botao Consultar Buonny | `risk-buonny-check-btn` |
| Badge status Buonny | `risk-buonny-status` |
| Badge criticidade | `risk-criticality-badge` |
| Checklist exigencias | `risk-requirements-checklist` |
| Botao Enviar Aprovacao | `risk-submit-approval-btn` |
| RiskStatusCard | `risk-status-card` |
| TripRiskPanel | `trip-risk-panel` |
| DRE v5 repasse risco | `dre-risk-repasse` |
| DRE v5 custo real risco | `dre-risk-custo-real` |
| Badge versao legado | `dre-legacy-badge` |
