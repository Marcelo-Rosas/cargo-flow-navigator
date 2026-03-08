---
plan_number: 04
plan_slug: plan-04-risk-workflow-memoria-calculo-risco-seguro
version: v0.1.0
role: Analista de Produto + Engenheiro(a) de Software (Supabase + TypeScript)
focus: Risk Workflow Wizard + Memoria de Calculo (Risco/Seguro) + VG
created_at: 2026-03-07
depends_on:
  - plan-02-metodologia-precificacao-lotacao-vs-fracionado@v0.2.2
  - plan-03-auditoria-ui-mini-cards-vs-motor@v0.1.1
key_decisions:
  buonny_code_validity_days: 90
  buonny_source_of_truth: buonny-check
  policy_value_reference: sum_cargo_value
  vg_aggregation_rule: VG soma por OS
  ui_choice: UI-B Risk Workflow Wizard + trilha auditavel
  gate_stage_transition: documentacao -> coleta_realizada
  vg_gate: true
  dre_reclassification: GRIS/TSO/RCTR-C como receita de repasse, nao custo
  toll_in_direct_costs: true
  breakdown_version: "5.0-risk-aware"
artifacts:
  - plan.md (este arquivo)
  - risk-requirement-spec-v1.md
  - data-model.md
  - ui-spec.md
  - audit-trail.md
  - templates.md
  - audit.md (closeout — DoD + shape contract + drift-proofing)
---

# Plan 04 — Risk Workflow + Memoria de Calculo (Risco/Seguro) + VG

## 1. Contexto

### 1.1 Estado atual (provado nos Plans 02 e 03)

- **Motor de calculo** (`calculate-freight/index.ts`): calcula GRIS, TSO, RCTR-C como componentes percentuais sobre `cargo_value`. Gross-up hibrido (Asset-Light) gera `totalCliente`.
- **DRE atual** (`QuoteModalCostCompositionTab.tsx`): classifica GRIS/TSO/RCTR-C como "Custos Variaveis de Risco (s/ NF)" — **deducoes** da receita. Isso infla artificialmente o custo e comprime a margem.
- **Spread R$/km** (Plan 03, P0): usa `ntc_base` (= frete_peso + frete_valor + gris + tso + dispatchFee) como "Custo pago ao motorista" — semantica errada.
- **Buonny**: nenhuma integracao existente no codebase.
- **Apolice**: RC-DC (END 4011848 APOL 1005500008136) com inclusao de Gerenciadora Buonny.
- **Approvals**: sistema flexivel com `approval_requests`, `approval_rules`, `ai_insights`.
- **Trips/VG**: `trip_orders` com `apportion_key`, `trip_cost_items` com `scope` (TRIP/OS).
- **Documents**: `analise_gr` (Gerenciamento de Risco) ja existe como tipo de documento.

### 1.2 Problema

1. **Risco nao controlado estruturalmente**: a liberacao da OS para coleta depende de documentos (checklist manual), sem avaliacao de risco automatizada por apolice/Buonny.
2. **Semantica financeira incorreta**: GRIS/TSO/RCTR-C sao repassados ao cliente (receita), nao custos reais do transportador. O custo real do risco (Buonny, seguro efetivo) nao e rastreado.
3. **VG sem gate de risco**: viagens com multiplas OS podem ultrapassar limites de apolice sem alerta.
4. **Sem trilha auditavel**: nao ha registro de "quem avaliou, com base em que, quando" para compliance.

### 1.3 Decisoes de design (nao negociaveis)

| Decisao | Valor | Justificativa |
|---------|-------|---------------|
| Validade Buonny | 90 dias | Pratica de mercado; apolice exige consulta valida |
| Source of truth Buonny | Edge `buonny-check` | Unica fonte de dados do motorista/veiculo |
| Referencia valor apolice | `sum(cargo_value)` por OS/VG | Apolice cobre valor da carga, nao NF |
| VG agregacao | Soma por OS na trip | Trip pode ter N OS; risco avalia o conjunto |
| UI | UI-B Wizard + trilha auditavel | Mais robusto que checklist simples |
| Gate | `documentacao -> coleta_realizada` | Ultima etapa antes da coleta fisica |
| VG gate | `true` | Bloqueia todas as OS da trip se risco nao aprovado |
| GRIS/TSO/RCTR-C | Receita de repasse (nao custo) | Reflete realidade: cliente paga, transportador repassa |
| Pedagio | Custo direto (rentabilidade) | Motorista recebe pedagio; e custo real |
| Breakdown version | `5.0-risk-aware` | Versao nova para nao quebrar legado |

---

## 2. Arquitetura de alto nivel

```
                    +------------------+
                    |   Apolice/Regras |
                    |  (risk_policies) |
                    +--------+---------+
                             |
                             v
+--------+    +---------+   +------------------+    +-----------+
| Quote  |--->| Order   |-->| Risk Evaluation  |--->| Approval  |
|        |    | (OS)    |   | (risk_evaluations)|   | Request   |
+--------+    +----+----+   +------------------+    +-----+-----+
                   |                                       |
                   v                                       v
              +----+----+                            +-----+-----+
              |  Trip   |                            | Gate:      |
              |  (VG)   |                            | doc->coleta|
              +---------+                            +-----------+
                   |
                   v
              +----+----+
              | VG Risk |
              | Eval    |
              +---------+
```

### 2.1 Fluxo resumido

1. **OS criada** (a partir de quote ou manual) → stage `ordem_criada`
2. **Transicao para `documentacao`** → Risk Evaluation criada automaticamente
3. **Wizard de Risco** (UI-B):
   - Passo 1: Status Buonny (consulta motorista/veiculo)
   - Passo 2: Regras aplicaveis (criticidade por apolice + valor + rota)
   - Passo 3: Evidencias (GR, rota, documentos)
   - Passo 4: Enviar para Aprovacao
4. **Gate** (`documentacao -> coleta_realizada`):
   - `approval_request` com `approval_type = 'risk_gate'`
   - Admin/operacao aprova no menu Aprovacoes
   - Liberacao: transicao permitida
5. **VG**: se OS esta em trip, avaliacao considera soma de `cargo_value` de todas as OS da trip

---

## 3. Fases de implementacao

### Fase 0 — Spec & Model (sem mudar producao)

| Task | Entregavel | Status |
|------|-----------|--------|
| Risk Requirement Spec v1 | `risk-requirement-spec-v1.md` | Este plano |
| Modelo de dados | `data-model.md` | Este plano |
| UI Spec (Wizard) | `ui-spec.md` | Este plano |
| Audit trail spec | `audit-trail.md` | Este plano |
| Templates spec | `templates.md` | Este plano |

### Fase 1 — Persistencia + Risk Evaluation (backend)

| Task | Detalhes |
|------|---------|
| 1.1 Criar tabelas | `risk_policies`, `risk_policy_rules`, `risk_services_catalog`, `risk_evaluations`, `risk_evidence`, `risk_costs` |
| 1.2 RLS e policies | Leitura para todos; escrita para admin/operacao |
| 1.3 Seed data | Apolice RC-DC inicial + servicos Buonny (Consulta R$ 13,76; Cadastro R$ 42,10; Monitoramento R$ 252,78) |
| 1.4 Edge `buonny-check` | Stub inicial com interface definida (SOAP wrapper futuro) |
| 1.5 Edge `evaluate-risk` | Calcula criticidade por OS e por VG; retorna exigencias |
| 1.6 Approval rule seed | `risk_gate` para entity_type `order`, trigger `stage = documentacao` |
| 1.7 `validate_transition` update | RPC passa a checar `risk_gate` aprovado antes de liberar `documentacao -> coleta_realizada` |

### Fase 2 — UI-B Risk Workflow Wizard + Gate Aprovacoes

| Task | Detalhes |
|------|---------|
| 2.1 `RiskWorkflowWizard` component | 4 passos dentro de `OrderDetailModal` (tab "Risco") |
| 2.2 `RiskStatusCard` | Card resumo no OrderDetailModal (criticidade, status Buonny, custos) |
| 2.3 `useRiskEvaluation` hook | CRUD + refetch de `risk_evaluations` |
| 2.4 Integracao Aprovacoes | `approval_type = 'risk_gate'`; ApprovalModal mostra evidencias de risco |
| 2.5 VG Risk Panel | No TripDetailModal: soma cargo_value, lista OS, criticidade consolidada |
| 2.6 QuoteDetailModal risk card | Card "Risco/Seguro" com custos estimados + repasse vs real |

### Fase 3 — Memoria de Calculo / DRE / Rentabilidade (refactor)

| Task | Detalhes |
|------|---------|
| 3.1 StoredPricingBreakdown v5 | Novo campo `riskCosts`, reclassificacao de GRIS/TSO/RCTR-C |
| 3.2 Edge `calculate-freight` update | Novo bloco `risk_costs` na resposta; `profitability` com nova formula |
| 3.3 `buildStoredBreakdownFromEdgeResponse` fix | Mapear todos os GAPs do Plan 03 (custo_motorista, receita_liquida, profit_margin_target, regime_fiscal) |
| 3.4 DRE refactor | Nova semantica: repasse risco como receita; pedagio em custos diretos |
| 3.5 Retrocompatibilidade | Fallbacks para breakdown v4; "Recalcular" recomendado para upgrade |

### Fase 4 — Documentos oficiais (PDF/email) + padronizacao

| Task | Detalhes |
|------|---------|
| 4.1 Edge `generate-risk-report` | PDF com dados da avaliacao, rota, evidencias |
| 4.2 Edge `generate-route-report` | PDF com roteirizacao Webrouter, paradas, pedagios |
| 4.3 Email templates | Notificacao de aprovacao pendente; resultado da avaliacao |
| 4.4 fabrica-de-temas | Padronizacao visual Vectra Cargo nos PDFs |

### Fase 5 — Ad Valorem Lotacao + Seguro Efetivo (entregue 2026-03-08)

> Implementacao do custo de risco para Lotacao (FTL) baseado nas apolices reais.

| Task | Detalhes | Status |
|------|---------|--------|
| F22: RCTR-C policy seed | Seed apolice RCTR-C (1005400015107) + premium_rate metadata em ambas apolices | DONE |
| F23: Ad Valorem rule | `ad_valorem_lotacao_percent` em `pricing_rules_config` (Central de Riscos, editavel) | DONE |
| F24: freightCalculator.ts | Ad Valorem para lotacao, zero GRIS/TSO, incluir em custoServicos | DONE |
| F25: Edge calculate-freight | Resolve `ad_valorem_lotacao_percent`, zero GRIS/TSO para lotacao, adValorem em risk_pass_through | DONE |
| F26: Frontend DRE | Ad Valorem row em composicao + Repasse de Risco na DRE | DONE |
| F27: StoredPricingBreakdown | Persist `adValoremPercent` em rates + `adValorem` em riskPassThrough | DONE |

#### Regras Ad Valorem

- **Lotacao (FTL)**: `adValorem = cargo_value * ad_valorem_lotacao_percent / 100` (default 0.03%)
  - GRIS = 0, TSO = 0 (substituidos pelo Ad Valorem)
  - Ad Valorem incluso em `custoServicos` e `risk_pass_through`
- **Fracionado (LTL)**: Ad Valorem = 0; GRIS/TSO mantidos com percentuais NTC de mercado
- **Fonte**: `pricing_rules_config` (editavel na Central de Riscos)
- **Baseline**: RCTR-C 0,015% + RC-DC 0,015% = 0,03% (apolices Berkley)

### Fase 6 — ICMS/VPO Prep (entregue 2026-03-08)

| Task | Detalhes | Status |
|------|---------|--------|
| pedagio_charge_type | Enum 3 valores + colunas nullable em orders | DONE |
| calcularBaseICMS | Helper em freightCalculator.ts (mode A/B) | DONE |
| icmsMode em breakdown | Persiste em meta.icmsMode | DONE |

> **Nota**: UI seletor e calculo mode B nao implementados (Plan 05+).

---

## 4. Nova semantica financeira (DRE v2)

### 4.1 Antes (v4 — atual)

```
(+) Total Cliente (Faturamento Bruto)
(-) DAS
(-) ICMS
(=) Receita Liquida

(-) Overhead
(-) Custo Motorista (frete_peso)                    ← custo direto
(-) Pedagio                                          ← custo direto (mas nao em custosDiretos)
(-) GRIS/TSO/RCTR-C/TDE/TEAR/Despacho              ← "custos de risco" (ERRADO: sao repasse)
(-) Aluguel Maquinas
(-) Carga/Descarga

(=) Resultado Liquido
```

**Problema**: GRIS/TSO/RCTR-C sao cobrados DO CLIENTE e repassados a seguradora. Nao sao custo da operacao. Classificar como custo comprime a margem artificialmente.

### 4.2 Depois (v5 — proposta consolidada)

**Objetivo:** manter `totalCliente` como "preco final" **quando possivel**, mas corrigir a semantica e os derivados para refletirem:
- repasse de risco como **receita de repasse** (nao custo),
- custo real de risco/seguro como **custo** (Buonny + premio real apolices),
- pedagio como **custo direto** (quando pago pela operacao),
- e refletir impactos fiscais (ICMS/VPO) sem drift.

#### 4.2.1 Reclassificacao de itens (regra contabil do app)

**(A) Repasse (nao e custo operacional)**
- GRIS, TSO, RCTR-C (componentes calculados e cobrados do cliente para cobrir risco/seguro)
- Observacao: esses valores NAO devem reduzir resultado liquido como "custos variaveis".
  Devem ser tratados como "Receita de Repasse de Risco" e reconciliados contra "Custo Real do Risco".

**(B) Custo real (sai da Vectra)**
- Buonny (por OS/por VG conforme regra)
  - Consulta: R$ 13,76 (obrigatorio)
  - Cadastro: R$ 42,10 (condicional: sem cadastro previo valido)
  - Monitoramento veiculo: R$ 252,78 (condicional por criticidade da apolice)
- Seguro (premio real por embarque)
  - RCTR-C: 0,015% sobre `cargo_value`
  - RC-DC: 0,015% sobre `cargo_value`
  - Total premio real (se ambos aplicaveis): 0,030% sobre `cargo_value`
  - Base: `cargo_value` (assumido = valor NF / valor averbado)

**(C) Custo direto operacional**
- Custo motorista (frete base / frete peso)
- Pedagogio (quando pago pela operacao)
- Descarga / aluguel de maquinas / estadia / demais custos operacionais

#### 4.2.2 DRE v5 (estrutura)

```
(+) Faturamento Bruto (Total Cliente) = totals.totalCliente
(-) Impostos
  • DAS (calculado sobre totalCliente)
  • ICMS (conforme base ICMS do CT-e; ver secao 4.5)
(=) Receita Liquida

(-) Overhead

(-) Custos Diretos Operacionais
  • Custo Motorista (Frete Base / frete_peso)
  • Pedagogio (se pago pela operacao)
  • Descarga
  • Aluguel Maquinas
  • Estadia/Waiting
  • Outros custos operacionais

(+) Receita de Repasse de Risco (nao afeta margem operacional por si so)
  • Ad Valorem (lotacao: substitui GRIS/TSO; fracionado: 0)
  • GRIS (fracionado: NTC mercado; lotacao: 0)
  • TSO (fracionado: NTC mercado; lotacao: 0)
  • RCTR-C (quando cobrado do cliente como componente)

(-) Custo Real de Risco / Seguro
  • Buonny (consulta/cadastro/monitoramento) — conforme regras
  • Premio Real Seguro: RCTR-C 0,015% + RC-DC 0,015% = 0,030% sobre cargo_value
  • Outros custos reais de risco (futuro)

(=) Resultado Liquido
(=) Margem % = resultadoLiquido / totalCliente
```

### 4.3 Impacto numerico (exemplo)

| Metrica | v4 (atual) | v5 (proposta) | Delta |
|---------|-----------|--------------|-------|
| Total Cliente | R$ 10.000 | R$ 10.000 | 0 |
| Receita Liquida | R$ 8.400 | R$ 8.400 | 0 |
| GRIS+TSO+RCTR-C (repasse) | -R$ 650 (custo) | R$ 0 (nao deduz) | +R$ 650 |
| Custo real risco (Buonny) | R$ 0 | -R$ 13,76 | -R$ 13,76 |
| Pedagio | R$ 0 (fora custos) | -R$ 500 (custo direto) | -R$ 500 |
| Resultado Liquido | R$ 1.250 | R$ 1.386,24 | +R$ 136,24 |
| Margem % | 12,5% | 13,86% | +1,36pp |

> **totalCliente nao muda**. A reclassificacao muda apenas a apresentacao e o resultado liquido.

### 4.4 Regras de retrocompatibilidade

1. **Breakdown version check**: UI lê `breakdown.version`
   - `4.x` → exibe DRE v4 (legado, sem repasse)
   - `5.x` → exibe DRE v5 (nova semantica)
2. **Botao "Recalcular"**: atualiza para v5 e salva
3. **Quotes/OS antigos**: funcionam sem alteracao; badge "Calculo legado" quando v4
4. **Novos calculos**: sempre geram v5

### 4.5 ICMS + Vale-Pedagio (VPO) + impacto em DAS/margem

**Regra operacional do app (ponto critico):**
O determinante nao e o nome do campo, mas se o pedagio/VPO foi **debitado ao tomador no CT-e**.
Isso define se compoe o "preco do servico" e, portanto, a base tributavel.

#### 4.5.1 Campo obrigatorio no Wizard (drift-proof)
Adicionar selecao: **Tipo de cobranca do pedagio**
- (1) VPO antecipado pelo embarcador (fora do CT-e tributavel; registrar no MDF-e/DT-e)
- (2) Pedagogio cobrado no CT-e (entra na base ICMS do CT-e)
- (3) Fracionado com rateio (parcela de pedagio entra na base de cada CT-e; soma parcelas = pedagogio total)

#### 4.5.2 Rateio (quando aplicavel)
Quando `tipo_carga = FRACIONADA` ou quando a operacao exigir rateio:
`parcela_pedagio_item = (valor_frete_item / soma_valor_frete_itens) * pedagogio_total`

#### 4.5.3 Protecao de margem (decisao do produto)
Como DAS e calculada sobre `totalCliente`, quando o pedagogio entra no CT-e como componente do preco:
- `totalCliente` tende a aumentar (se incluir pedagogio como item cobrado),
- DAS aumenta,
- margem cai.
**Decisao:** proteger margem por markup:
o motor deve aceitar `markup_percent`/parametros para absorver aumento fiscal quando necessario.

---

## 5. Integracao com VG (Trips) — consolidado

### 5.1 Regra de agregacao

- **Fonte**: Quote (`cargo_value`) → deve ser clonado para OS.
- **Em VG (Trip)**: `sum(cargo_value)` por OS determina criticidade e requisitos.
- **Gate VG**: se qualquer OS exigir monitoramento, a VG inteira exige.
- **Transicao** `documentacao -> coleta_realizada`: bloqueada se `risk_gate` nao aprovado (e se VG: bloqueia todas as OS vinculadas).

```
Trip (VG)
  ├── OS 1: cargo_value = R$ 50.000 → criticidade BAIXA
  ├── OS 2: cargo_value = R$ 120.000 → criticidade MEDIA
  └── OS 3: cargo_value = R$ 300.000 → criticidade ALTA

  Soma VG: R$ 470.000 → criticidade VG = ALTA (threshold da apolice)
```

- Cada OS tem sua `risk_evaluation` individual
- A trip tem uma avaliacao consolidada (`risk_evaluations.entity_type = 'trip'`)
- Liberacao: todas as OS da trip devem ter risk_gate aprovado

### 5.2 Custos por OS vs por VG

- **Buonny e cobrado por OS** (mas se a OS entra em VG, o custo pode ser tratado como TRIP e rateado).
- **Wizard registra** o que foi aplicado e em qual nivel:
  - Consulta: obrigatorio (nivel OS)
  - Cadastro: condicional (nivel OS; reaproveitavel por 90 dias)
  - Monitoramento: condicional (nivel VG quando aplicavel)

- `trip_cost_items` com `category = 'risk'`:
  - `buonny_consulta` (scope: TRIP — pago 1x por viagem)
  - `buonny_cadastro` (scope: TRIP — pago 1x se necessario)
  - `buonny_monitoramento` (scope: TRIP — pago 1x por viagem)
- Rateio via `apportion_key` da `trip_orders`

---

## 6. Riscos do plano e mitigacao

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|-------------|---------|-----------|
| Buonny SOAP indisponivel | Media | Alto | Stub + modo degradado (aprovacao manual) |
| Quotes legadas com v4 | Certa | Medio | Fallback + badge "Calculo legado" |
| Margem v5 > v4 confunde usuario | Media | Medio | Tooltip + nota de auditoria na DRE |
| VG com muitas OS trava operacao | Baixa | Alto | Gate por OS individual + consolidacao async |
| Apolice muda regras | Media | Medio | `risk_policies` versionadas com `valid_from/valid_until` |
| Performance: N queries por VG | Baixa | Medio | View materializada `vw_trip_risk_summary` |

---

## 7. Dependencias entre artefatos

```
plan.md (este)
  ├── risk-requirement-spec-v1.md  ← regras de negocio
  ├── data-model.md                ← DDL e payloads
  │     └── (depende de risk-requirement-spec-v1)
  ├── ui-spec.md                   ← componentes e estados
  │     └── (depende de data-model + risk-requirement-spec-v1)
  ├── audit-trail.md               ← gate + trilha
  │     └── (depende de data-model + ui-spec)
  └── templates.md                 ← PDFs e emails
        └── (depende de data-model + ui-spec)
```

---

## 8. Pontos de integracao com codigo existente

| Arquivo existente | Mudanca necessaria | Fase | Status |
|-------------------|-------------------|------|--------|
| `useCalculateFreight.ts` | Mapear GAPs 1-4 + `riskCosts` + `adValoremPercent` + `riskPassThrough.adValorem` | 3,5 | DONE |
| `calculate-freight/index.ts` | `risk_costs`, `risk_pass_through`, Ad Valorem lotacao, zero GRIS/TSO | 3,5 | DONE |
| `QuoteModalCostCompositionTab.tsx` | DRE v5 com repasse como receita + Ad Valorem row | 3,5 | DONE |
| `QuoteDetailModal.tsx` | `custoMotorista` direto + recalcular v5 | 3 | DONE |
| `OrderDetailModal.tsx` | Nova tab "Risco" com Wizard | 2 | DONE |
| `TripDetailModal.tsx` | Risk Panel consolidado + VG gate | 2 | DONE |
| `useWorkflowTransitions.ts` | Checar `risk_gate` approval antes de transicao | 1 | DONE |
| `ApprovalModal.tsx` | Suportar `approval_type = 'risk_gate'` com evidencias | 2 | DONE |
| `freight-types.ts` | `FreightProfitability` + `risk_pass_through.ad_valorem` + `ad_valorem_percent` | 3,5 | DONE |
| `freightCalculator.ts` | `StoredPricingBreakdown` v5 + `riskCosts` + `adValorem` + `calcularBaseICMS` | 3,5,6 | DONE |
| `src/types/freight.ts` | `CalculateFreightResponse` com `risk_costs` + `ad_valorem_percent` + `risk_pass_through.ad_valorem` | 3,5 | DONE |

---

## 9. Criterios de sucesso

- [x] Gate `documentacao -> coleta_realizada` bloqueado sem aprovacao de risco
- [x] Wizard de risco funcional em OrderDetailModal
- [x] VG mostra criticidade consolidada com soma de cargo_value
- [x] Buonny stub retorna status valido/expirado com validade 90 dias
- [x] DRE v5: GRIS/TSO/RCTR-C/Ad Valorem como receita de repasse
- [x] DRE v5: pedagio em custos diretos
- [x] DRE v5: custos reais de risco (RCTR-C 0,015% + RC-DC 0,015%) como deducao
- [x] Breakdown v4 continua funcionando (retrocompatibilidade)
- [ ] PDF de relatorio de risco gerado com fabrica-de-temas (Fase 4 — pendente)
- [x] Trilha auditavel: quem avaliou, quando, com base em que
- [x] Ad Valorem Lotacao: substitui GRIS/TSO para FTL, editavel na Central de Riscos
- [x] Shape contract 1:1 (Edge snake_case <-> Stored camelCase)
- [x] FORBID_CONDITIONAL_FEES feature flag funcional
- [x] pedagio_charge_type preparado (enum + colunas, sem UI)

## 10. O que NAO esta no Plan 04

- Motor fiscal completo / CT-e / SEFAZ
- UI seletor pedagio_charge_type
- Calculo ICMS mode B (proporcional por UF) — helper existe, wiring pendente
- Integracao real API Buonny (SOAP)
- Escolta / rastreamento ativo (GR nivel 3+)
- Dashboard de sinistralidade
- Relatorio de averbacoes
- PDF relatorio de risco (Fase 4)

> Detalhes de fechamento, evidencias e riscos residuais: ver `audit.md`.
