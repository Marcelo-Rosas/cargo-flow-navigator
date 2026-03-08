# Plan 04 — Auditoria de Fechamento v0.1.0

> Data: 2026-03-08
> Versao: v0.1.0 (closeout)

---

## 1. DoD Verificado

### 1.1 Gate `documentacao -> coleta_realizada` com `risk_gate`

**Status: IMPLEMENTADO**

- **SQL**: `supabase/migrations/20260407000100_risk_gate_validate_transition.sql`
  - Funcao `validate_transition` bloqueia transicao `documentacao -> coleta_realizada` (linhas 82-128)
  - Checks: (1) risk_evaluation approved, (2) trip risk approved se em viagem, (3) Buonny evidence valida (expires_at > now())
- **Frontend**: `src/hooks/useWorkflowTransitions.ts:66-93` — `useValidateTransition` chama RPC `validate_transition`

### 1.2 VG Gate bloqueia OS quando trip nao aprovada

**Status: IMPLEMENTADO**

- **SQL**: Mesmo `validate_transition` — linhas 100-112 checam `trip_id` e `risk_evaluations` da trip
- **Frontend**: `src/components/modals/TripDetailModal.tsx:144-195`
  - Painel VG mostra "Liberado" (verde) / "Pendente" (amarelo)
  - Soma `cargo_value` por OS (linha 76)

### 1.3 Wizard Buonny com validade 90 dias + evidencia

**Status: IMPLEMENTADO**

- **Frontend**: `src/components/risk/RiskWorkflowWizard.tsx:79-82`
  - Busca evidence `buonny_check` + status `valid`
  - Checa `expires_at > new Date()` (validade configurada na criacao)
- **Approval**: Linhas 130-143 — auto-approve se LOW/MEDIUM + requisitos atendidos + Buonny valido

### 1.4 DRE v5 — Semantica correta

**Status: IMPLEMENTADO**

- **Arquivo**: `src/components/modals/quote-detail/QuoteModalCostCompositionTab.tsx`
  - GRIS/TSO/RCTR-C/Ad Valorem como **Repasse de Risco** (receita, nao custo) — linhas 317-358
  - Pedagio em **Custos Diretos** — linhas 372-378
  - Custos Reais de Risco (RCTR-C 0,015% + RC-DC 0,015%) como deducao — linhas 424-452
  - Nota de Auditoria DRE v5 — linhas 496-507

### 1.5 Spread R$/km usa custoMotorista

**Status: IMPLEMENTADO**

- **Arquivo**: `src/lib/freightCalculator.ts`
  - `custoMotorista = fretePeso` (nao ntc_base que inclui GRIS/TSO)
  - Edge: `calculate-freight/index.ts:777` — `const custoMotorista = frete_peso`

### 1.6 v4 retrocompatibilidade + badge + botao Recalcular

**Status: IMPLEMENTADO**

- **Arquivo**: `src/components/modals/quote-detail/QuoteModalCostCompositionTab.tsx:139-154`
  - Badge v5/v4 com versao — linha 141
  - Botao "Recalcular (v5)" quando `!isV5 && onRecalculate` — linhas 150-154
- **QuoteDetailModal**: `src/components/modals/QuoteDetailModal.tsx:357-399`
  - `handleRecalcular` chama Edge, reconstroi breakdown v5

### 1.7 Trilha auditavel: risk_evidence + approval_request

**Status: IMPLEMENTADO**

- **SQL**: `validate_transition` checa `risk_evidence` + `risk_evaluations`
- **Wizard**: Salva evidencias via `useRiskEvidence` (StepBuonny)
- **Approval**: Status `evaluated` gera necessidade de aprovacao gerencial; `approved` libera gate
- **Docs**: `audit-trail.md` documenta fluxo completo

### 1.8 Badges risco no header OS + banner VG

**Status: IMPLEMENTADO**

- **OrderDetailModal**: `src/components/modals/OrderDetailModal.tsx:188` — `useOrderRiskStatus`
- **TripDetailModal**: Painel VG com badge criticidade + status gate — linhas 144-195

### 1.9 Edge response inclui risk_pass_through e risk_costs

**Status: IMPLEMENTADO**

- **Edge**: `supabase/functions/calculate-freight/index.ts:938-944`
  - `risk_pass_through: { gris, tso, rctrc, ad_valorem, total }`
- **Types**: `supabase/functions/_shared/freight-types.ts:172-184`
  - `risk_pass_through` + `risk_costs` (items[] + total)
- **Client**: `src/types/freight.ts:110-122` — espelho 1:1

### 1.10 pedagio_charge_type preparado para ICMS

**Status: IMPLEMENTADO (prep only)**

- **Migration**: `supabase/migrations/20260408000000_pedagio_charge_type_prep.sql`
  - Enum: `VALE_PEDAGIO_EMBARCADOR`, `PEDAGIO_DEBITADO_CTE`, `RATEIO_FRACIONADO`
  - Coluna nullable em `orders` + `pedagio_debitado_no_cte BOOLEAN`

### 1.11 Feature flag FORBID_CONDITIONAL_FEES

**Status: IMPLEMENTADO**

- **Edge**: `supabase/functions/calculate-freight/index.ts:508-521`
  - Consulta `pricing_parameters` WHERE key = `FORBID_CONDITIONAL_FEES`
  - Se `'true'` → ignora `input.conditional_fees`, `conditionalFeesTotal = 0`
  - Se OFF → comportamento legado preservado (busca `conditional_fees` table)
- **Frontend**: `src/components/modals/QuoteDetailModal.tsx:379`
  - v5: conditional_fees NOT sent to Edge function

---

## 2. Shape Contract — Edge (snake_case) vs StoredPricingBreakdown (camelCase)

| Campo Edge | Campo Stored | Onde mapeia | Fallback | Min Version |
|---|---|---|---|---|
| `risk_pass_through.gris` | `riskPassThrough.gris` | useCalculateFreight:227 | 0 | v5 |
| `risk_pass_through.tso` | `riskPassThrough.tso` | useCalculateFreight:228 | 0 | v5 |
| `risk_pass_through.rctrc` | `riskPassThrough.rctrc` | useCalculateFreight:229 | 0 | v5 |
| `risk_pass_through.ad_valorem` | `riskPassThrough.adValorem` | useCalculateFreight:230 | 0 | v5 |
| `risk_pass_through.total` | `riskPassThrough.total` | useCalculateFreight:231 | calculated | v5 |
| `risk_costs` | `riskCosts` | useCalculateFreight:226 | undefined | v5 |
| `profitability.profit_margin_target` | `rates.targetMarginPercent` | useCalculateFreight:220 | 15 | v5 |
| `profitability.receita_liquida` | `profitability.receitaLiquida` | useCalculateFreight:203 | calculated | v5 |
| `profitability.custo_motorista` | `profitability.custoMotorista` | useCalculateFreight:199 | 0 | v5 |
| `profitability.regime_fiscal` | `profitability.regimeFiscal` | useCalculateFreight:209 | undefined | v5 |
| `rates.ad_valorem_percent` | `rates.adValoremPercent` | useCalculateFreight:217 | undefined | v5 |
| `components.ad_valorem` | `components.adValorem` | useCalculateFreight:181 | 0 | v4+ |
| `components.dispatch_fee` | `components.dispatchFee` | useCalculateFreight:184 | 0 | v5 |

**Contrato UI**:
- `QuoteModalCostCompositionTab` usa `breakdown.components?.X ?? 0` para todos os campos — safe para v4 (undefined → 0)
- `riskPassThrough` e `riskCosts` sao opcionais (`?.`) — v4 breakdowns nao quebram

---

## 3. Conditional Fees — Policy Decision

### Flag ON (`FORBID_CONDITIONAL_FEES = 'true'`)
- Edge **ignora** `input.conditional_fees` completamente
- `conditionalFeesTotal = 0`, `conditionalFeesBreakdown = {}`
- Taxas gerenciadas exclusivamente via `pricing_rules_config` (Taxas Adicionais UI)

### Flag OFF (default ou ausente)
- Comportamento legado preservado: Edge busca `conditional_fees` table por `code`
- Calcula sobre `conditionalFeeFreightBase` (correction + markup)
- Retorna breakdown detalhado

### Frontend v5
- `QuoteDetailModal` nao envia `conditional_fees` no payload v5 (linha 379)
- `FreightSimulator` ainda envia (para simulacao legacy)
- `PricingRulesManager` gerencia via nova UI "Taxas Adicionais"

---

## 4. ICMS / VPO — Status no Plan 04

### O que foi entregue
- **Enum `pedagio_charge_type`**: 3 valores (VPO, debitado CT-e, rateio fracionado)
- **Colunas em `orders`**: `pedagio_charge_type` (nullable), `pedagio_debitado_no_cte` (boolean)
- **`icmsMode` em StoredPricingBreakdown**: 'A' (fixo) ou 'B' (proporcional por UF)
- **`calcularBaseICMS()`**: helper em `freightCalculator.ts:631-648` — retorna mode, percent, value, base
- **Gross-up**: ICMS entra no divisor apenas quando `regimeFiscal != 'simples_nacional'`

### Fonte de verdade
- `pedagio_charge_type` persiste em `orders` (coluna SQL)
- `icmsMode` persiste em `breakdown.meta.icmsMode` (JSONB)

### O que NAO esta implementado (Plan 05+)
- UI para selecionar `pedagio_charge_type` na OS
- Logica de calculo diferenciado quando `PEDAGIO_DEBITADO_CTE` (ajuste base ICMS)
- Rateio fracionado automatico de pedagio por CT-e
- Calculo proporcional ICMS por UF (mode B) — helper existe, wiring pendente
- CT-e/SEFAZ integration

### Riscos
- Se o usuario marcar pedagio como "debitado no CT-e" sem o calculo implementado, base ICMS fica incorreta
- **Mitigacao**: colunas sao nullable, UI nao expoe seletor ainda

---

## 5. Seguro Efetivo (RCTR-C + RC-DC 0,015%)

### Formula
```
custo_seguro_por_embarque = cargo_value * (0.015% + 0.015%) = cargo_value * 0.03%
```

### Onde calcula
- **Client-side**: `freightCalculator.ts` — `adValorem = cargoValue * (adValoremLotacaoPercent / 100)` (lotacao)
- **Edge function**: `calculate-freight/index.ts` — mesma formula, resolve `adValoremLotacaoPercent` da Central de Riscos
- **DRE v5**: `QuoteModalCostCompositionTab.tsx:424-452` — exibe custo real hardcoded (0.015% RCTR-C + 0.015% RC-DC)

### Onde salva
- `pricing_breakdown.riskPassThrough.adValorem` — valor cobrado do cliente (lotacao)
- `pricing_breakdown.components.adValorem` — componente do calculo
- `pricing_breakdown.rates.adValoremPercent` — taxa aplicada

### Apolices (fonte)
- **RCTR-C**: Apolice 1005400015107, Berkley, 0.015% — `risk_policies` (seed F22)
- **RC-DC**: Apolice 1005500008136, Berkley, 0.015% — `risk_policies` (seed F22)
- Metadata inclui `premium_rate_percent` para auditoria

### Rateio VG
- `TripDetailModal` soma `cargo_value` por OS (linha 76)
- Custo seguro VG = soma(cargo_value_por_OS) * 0.03%
- Implementado via `vgSummary.totalRiskCost` (hook `useOrderRiskStatus`)

---

## 6. Cargo Value — Clone Quote -> OS -> VG

### Quote
- Persistido em `quotes.cargo_value` (campo SQL)
- Input do formulario: `QuoteForm.tsx:294` — `cargo_value: z.number().min(0)`
- Passado ao Edge: `QuoteDetailModal.tsx:372` — `cargo_value: Number(quote.cargo_value) || 0`

### Order (clone)
- `useOrders.tsx:49,88,133` — query seleciona `cargo_value` da quote associada
- `OrderDetailModal.tsx:1420` — passa `cargoValue={Number(order.quote?.cargo_value ?? 0)}` ao Wizard

### Trip/VG (soma)
- `TripDetailModal.tsx:76` — `totalCargoValue = orderRiskStatuses.reduce((sum, s) => sum + Number(s.cargo_value ?? 0), 0)`
- Exibido no painel VG: "Valor carga (soma)"

### Avaliacao de Risco
- `useRiskEvaluation.ts:212` — rules match por `cargo_value` range
- `useRiskEvaluation.ts:255` — `cargo_value_evaluated` salvo na avaliacao

---

## 7. UX Checklist

| Componente | Funcionalidade | Arquivo | Status |
|---|---|---|---|
| QuoteDetailModal | Badge v4/v5 + CTA Recalcular | QuoteModalCostCompositionTab:141-154 | OK |
| QuoteDetailModal | DRE v5 com semantica nova | QuoteModalCostCompositionTab:270-507 | OK |
| OrderDetailModal | Aba Risco com Wizard | OrderDetailModal:1416-1430 | OK |
| OrderDetailModal | Risk status badge no header | OrderDetailModal:188 | OK |
| TripDetailModal | Banner VG gate (Liberado/Pendente) | TripDetailModal:144-195 | OK |
| TripDetailModal | Soma cargo_value + custo risco | TripDetailModal:75-77 | OK |
| RiskWorkflowWizard | 4 steps + auto-approve LOW/MEDIUM | RiskWorkflowWizard:130-143 | OK |

---

## 8. Entrega Plan 04 — Resumo

### Entregue
- Risk Workflow Wizard (4 steps: Buonny, Criticidade, Evidencias, Aprovacao)
- Risk Gate SQL (`documentacao -> coleta_realizada`)
- VG Gate (trip-level, soma cargo por OS)
- DRE v5 semantica (receita vs custo de risco)
- Ad Valorem Lotacao (substitui GRIS/TSO, Central de Riscos editavel)
- Seguro efetivo 0,03% (RCTR-C + RC-DC) — seeds + calculo + display
- StoredPricingBreakdown v5 com risk_pass_through + risk_costs
- FORBID_CONDITIONAL_FEES flag
- pedagio_charge_type prep (enum + colunas)
- calcularBaseICMS helper
- v4 retrocompatibilidade (badge + recalcular)

### Preparado (nao entregue)
- UI seletor pedagio_charge_type
- Calculo ICMS mode B (proporcional por UF)
- PEDAGIO_DEBITADO_CTE impacto na base ICMS
- CT-e/SEFAZ integration

### Explicitamente fora do Plan 04
- Motor fiscal completo
- Emissao CT-e automatica
- Integracao SEFAZ
- Escolta/rastreamento ativo (Buonny GR nivel 3+)
- Dashboard de sinistralidade
- Relatorio de averbacoes

### Riscos residuais
1. **DRE custo real de risco hardcoded** (0.015% + 0.015%) no frontend — deveria ler de `risk_policies.metadata.premium_rate_percent`. Mitigacao: valor correto para apolices vigentes; atualizar quando renovar.
2. **Buonny simulado** (mock) — integracao real com API Buonny nao implementada. Mitigacao: wizard funciona com evidencia manual.
3. **ICMS mode B nao conectado** — helper existe mas sem wiring. Mitigacao: default mode A funciona corretamente.

### Checklist pos-deploy
- [ ] Rodar migrations 20260407* e 20260408* em sequencia
- [ ] Verificar seeds em risk_policies (RCTR-C + RC-DC)
- [ ] Verificar seed ad_valorem_lotacao_percent em pricing_rules_config
- [ ] Testar gate: OS com risk_evaluation approved transita; sem, bloqueia
- [ ] Testar VG: trip com todas OS approved libera; parcial bloqueia
- [ ] Testar recalcular v4->v5 em cotacao existente
- [ ] Testar lotacao: GRIS=0, TSO=0, Ad Valorem calculado
- [ ] Testar fracionado: GRIS/TSO NTC, Ad Valorem=0
- [ ] Confirmar FORBID_CONDITIONAL_FEES=true ignora fees legacy
