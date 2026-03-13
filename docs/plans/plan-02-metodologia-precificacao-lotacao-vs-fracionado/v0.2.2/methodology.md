---
plan_number: 02
plan_slug: plan-02-metodologia-precificacao-lotacao-vs-fracionado
version: v0.2.2
role: Analista de Produto + Engenheiro(a) de Software (Supabase + TypeScript)
focus: Metodologia de Precificação (Lotação vs Fracionado)
created_at: 2026-03-06
supersedes: v0.2.1
change_type: patch
code_version: 1e297d7a7e85107235524b2f829c8895c608bb87
schema_tables_used:
  - price_tables
  - price_table_rows
  - quotes
  - orders
  - payment_terms
  - pricing_parameters
  - pricing_rules_config
  - conditional_fees
  - icms_rates
  - antt_floor_rates
  - tac_rates
  - ltl_parameters
  - waiting_time_rules
  - vehicle_types
code_entrypoints:
  - supabase/functions/calculate-freight/index.ts
  - supabase/functions/_shared/freight-schema.ts
  - supabase/functions/_shared/freight-types.ts
  - supabase/functions/price-row/index.ts
  - supabase/functions/calculate-distance-webrouter/index.ts
  - src/lib/freightCalculator.ts
  - src/hooks/useCalculateFreight.ts
  - src/hooks/usePriceTableRows.ts
  - src/hooks/usePricingRules.ts
  - src/components/forms/QuoteForm.tsx
  - src/components/forms/quote-form/QuoteFormWizard.tsx
  - src/components/modals/QuoteDetailModal.tsx
  - src/components/pricing/FreightSimulator.tsx
---

## Plan 02 — Metodologia de Precificação (Lotação vs Fracionado) — v0.2.2

### O que mudou de v0.2.1 → v0.2.2

- **Nova seção**: Contract / Shape — chaves reais de `CalculateFreightResponse` (Edge) e `StoredPricingBreakdown` (persistido); tabela snake_case ↔ camelCase.
- **Breaking doc fixes (patch)**: `buildStoredBreakdownFromEdgeResponse` **não** copia `receita_liquida` nem `custo_motorista` para profitability; UI deriva `receitaLiquida` quando ausente (`totalCliente - das - icms`). `totals.receita_bruta` na Edge é atribuído com valor de `receitaLiquida` (linha 887) — semântica divergente do nome.
- **Glossário à prova de contestação**: campo exato (path real), arquivo UI + trecho literal, observação semântica.
- **Evidence index**: comandos `rg` e `Select-String` (PowerShell), "o que espera ver", risco de fragilidade.

---

### 1. Sumário executivo

O motor de precificação consolida uma metodologia única para cálculo de frete, diferenciando **Lotação (FTL)** e **Fracionado (LTL)** a partir de `price_tables.modality`, compondo um `CalculateFreightResponse` com `meta`, `components`, `rates`, `totals` e `profitability`, persistido em `quotes.pricing_breakdown` via `StoredPricingBreakdown`.

**Índice de evidências**: [evidence-index.md](evidence-index.md).

---

### 2. Contract / Shape

#### 2.1 CalculateFreightResponse (Edge — snake_case)

Chaves retornadas (fonte: `supabase/functions/_shared/freight-types.ts`, `tests/fixtures/calculate_freight_ok.json`):

- **meta**: route_uf_label, km_band_label, km_status, margin_status, margin_percent, cubage_factor, cubage_weight_kg, billable_weight_kg, km_band_used, price_table_row_id, ntc_base, antt_piso_carreteiro, ltl_min_weight_applied, original_weight_kg
- **components**: base_cost, base_freight, toll, gris, tso, rctrc, ad_valorem, tde, tear, dispatch_fee, conditional_fees_total, waiting_time_cost, das_provision, aluguel_maquinas
- **rates**: das_percent, icms_percent, gris_percent, tso_percent, cost_value_percent, markup_percent, overhead_percent, tac_percent, payment_adjustment_percent
- **totals**: receita_bruta, das, icms, tac_adjustment, payment_adjustment, total_impostos, total_cliente
- **profitability**: custos_carreteiro, custo_motorista, custos_servicos, custos_descarga, custos_diretos, receita_liquida, margem_bruta, overhead, resultado_liquido, margem_percent, profit_margin_target, regime_fiscal

**Observação**: Em `calculate-freight/index.ts` L887, `totals.receita_bruta` é atribuído com `receitaLiquida` (totalCliente - totalImpostos). O nome sugere "receita bruta" mas o valor é receita líquida de impostos. Documentar como divergência semântica.

#### 2.2 StoredPricingBreakdown (persistido em quotes.pricing_breakdown — camelCase)

Chaves (fonte: `src/lib/freightCalculator.ts` interface StoredPricingBreakdown):

- **meta**: routeUfLabel, kmBandLabel, kmStatus, marginStatus, marginPercent, kmBandUsed, tollPlazas, ltlMinWeightApplied, originalWeightKg, antt, etc.
- **weights**: cubageWeight, billableWeight, tonBillable
- **components**: baseCost, baseFreight, toll, aluguelMaquinas, gris, tso, rctrc, adValorem, tde, tear, dispatchFee, conditionalFeesTotal, waitingTimeCost, dasProvision
- **totals**: receitaBruta, das, icms, totalImpostos, totalCliente
- **profitability**: custoMotorista?, custosCarreteiro, custosDescarga, custoServicos?, custosDiretos, receitaLiquida?, margemBruta, overhead, resultadoLiquido, margemPercent
- **rates**: dasPercent, icmsPercent, grisPercent, tsoPercent, costValuePercent, markupPercent, overheadPercent, targetMarginPercent

**Prova**: `buildStoredBreakdownFromEdgeResponse` (useCalculateFreight.ts L188–196) mapeia `response.profitability.resultado_liquido` → `resultadoLiquido`, `margem_percent` → `margemPercent`, mas **não** mapeia `receita_liquida` nem `custo_motorista`. StoredPricingBreakdown.profitability aceita receitaLiquida e custoMotorista como opcionais; quando vêm da Edge, ficam ausentes no objeto retornado. A UI deriva receitaLiquida quando necessário.

#### 2.3 Mapeamento snake_case ↔ camelCase

| Edge (snake_case) | StoredPricingBreakdown (camelCase) |
|-------------------|-----------------------------------|
| totals.receita_bruta | totals.receitaBruta |
| totals.total_cliente | totals.totalCliente |
| totals.total_impostos | totals.totalImpostos |
| totals.tac_adjustment | totals.tacAdjustment (não há em Stored; vem de response) |
| totals.payment_adjustment | totals.paymentAdjustment |
| profitability.resultado_liquido | profitability.resultadoLiquido |
| profitability.receita_liquida | profitability.receitaLiquida (opcional; buildStoredBreakdownFromEdgeResponse **não** copia) |
| profitability.custo_motorista | profitability.custoMotorista (opcional; buildStoredBreakdownFromEdgeResponse **não** copia) |
| profitability.custos_carreteiro | profitability.custosCarreteiro |
| profitability.custos_diretos | profitability.custosDiretos |
| profitability.margem_percent | profitability.margemPercent |
| profitability.margem_bruta | profitability.margemBruta |
| components.dispatch_fee | components.dispatchFee |
| meta.toll_plazas | meta.tollPlazas (vem de existingBreakdown, não da Edge) |

---

### 3. Contrato de precedência — Modalidade

- **Edge**: usa exclusivamente `price_tables.modality`; schema não aceita modality/freight_modality.
- **TS**: usa `input.modality` vindo de `debounced.freightModality` (QuoteForm).
- **Risco**: freight_modality ≠ price_tables.modality → divergência TS vs Edge.

---

### 4–5. Metodologia LOTAÇÃO e FRACIONADO

Preservadas da v0.2.1 (seções 3–4). Sem alterações.

---

### 6. Search log (audit trail)

| Comando | O que procurou | Resumo |
|---------|----------------|--------|
| `rg -n "modality\|freight_modality" supabase/functions/_shared/ src/lib/ src/components/` | Schema e uso de modalidade | schema sem modality; Edge usa price_tables.modality; TS usa input.modality |
| `rg -n "kmBandUsed\|Math\.ceil\|Math\.round" supabase/functions/calculate-freight/ src/lib/freightCalculator.ts` | KM rounding | Edge ceil; TS round para validação |
| `rg -n "receita_liquida\|receitaLiquida\|custo_motorista\|custoMotorista" supabase/functions/ src/hooks/useCalculateFreight.ts` | Campos profitability | Edge retorna ambos; buildStoredBreakdownFromEdgeResponse **não** copia receita_liquida nem custo_motorista |

---

### 7. Glossário oficial de métricas (à prova de contestação)

| Termo | Definição | Campo exato (path real) | Onde na UI (arquivo + trecho) | Observação semântica |
|-------|-----------|-------------------------|-------------------------------|----------------------|
| **total_cliente** | Valor final ao cliente | `totals.total_cliente` (Edge); `totals.totalCliente` (StoredPricingBreakdown) | `QuoteForm.tsx` L1199: `value: calculationResult.totals.totalCliente`; `QuoteDetailModal.tsx` L209: `breakdown?.totals?.totalCliente ?? 0` | Persistido em quotes.value |
| **receita_liquida** | totalCliente - totalImpostos | `profitability.receita_liquida` (Edge); `profitability.receitaLiquida?` (StoredPricingBreakdown — opcional; buildStoredBreakdownFromEdgeResponse não copia) | `QuoteModalCostCompositionTab.tsx` L76-78: `(breakdown.profitability as { receitaLiquida?: number })?.receitaLiquida ?? totalCliente - das - icms` | UI deriva quando ausente |
| **resultado_liquido** | receitaLiquida - overhead - custosCarreteiro - custosDescarga | `profitability.resultado_liquido` (Edge); `profitability.resultadoLiquido` (Stored) | `QuoteForm.tsx` L2302: `formatCurrency(calculationResult.profitability.resultadoLiquido)`; `QuoteDetailModal.tsx` L237: `breakdown.profitability.resultadoLiquido` | |
| **margem_percent** | (resultadoLiquido / totalCliente) × 100 | `profitability.margem_percent` (Edge); `profitability.margemPercent` (Stored); `meta.margin_percent` (Edge) | `QuoteCard.tsx` L88: `breakdown?.meta?.marginPercent`; `QuoteDetailModal.tsx` L203: `breakdown?.profitability?.margemPercent` | |
| **custos_diretos** | custoMotorista + custoServicos + custosDescarga | `profitability.custos_diretos` (Edge); `profitability.custosDiretos` (Stored) | `FinancialCostBreakdown.tsx` L30: `profitability?.custosCarreteiro` (custosDiretos em outro componente) | |
| **custos_carreteiro** | = ntc_base (frete_peso + frete_valor + gris + tso + dispatchFee) | `profitability.custos_carreteiro` (Edge); `profitability.custosCarreteiro` (Stored) | `QuoteDetailModal.tsx` L214-216: `breakdown?.profitability?.custosCarreteiro ?? (breakdown?.profitability as { custos_carreteiro?: number })?.custos_carreteiro` | custo motorista = frete_peso; custos carreteiro = ntc_base |
| **custo_motorista** | = frete_peso (base cost) | `profitability.custo_motorista` (Edge); `profitability.custoMotorista?` (Stored — buildStoredBreakdownFromEdgeResponse não copia) | `QuoteDetailModal.tsx` L218-220: `(breakdown?.profitability as { custoMotorista?: number })?.custoMotorista ?? custosCarreteiroView` | Fallback para custosCarreteiro quando ausente |
| **ntc_base** | frete_peso + frete_valor + gris + tso + dispatchFee | `meta.ntc_base` (Edge) | Não exibido diretamente na UI principal | |
| **toll** / **tollPlazas** | Pedágio R$; praças por rota | `components.toll`; `meta.tollPlazas` (Stored, vem de existingBreakdown) | `QuoteDetailModal.tsx` L195: `breakdown?.meta?.tollPlazas ?? []`; `OrderDetailModal.tsx` L245: `pricingBreakdown?.meta?.tollPlazas ?? []` | toll = input.toll_value; tollPlazas de calculate-distance-webrouter |

---

### 8. Provas negativas com método

| Item | Comando rg | Comando Select-String (PowerShell) | Conclusão |
|------|------------|-----------------------------------|-----------|
| min_freight | `rg -n "min_freight" supabase/functions/calculate-freight/ src/lib/freightCalculator.ts` | `Select-String -Path "supabase/functions/calculate-freight/*.ts","src/lib/freightCalculator.ts" -Pattern "min_freight"` | Carregado em ltlParams; não entra em fórmula |
| toll_routes no motor | `rg -n "toll_routes" supabase/functions/calculate-freight/` | `Select-String -Path "supabase/functions/calculate-freight/*.ts" -Pattern "toll_routes"` | Zero matches — motor não consulta |

---

### 9. Matriz por cenário (TS vs Edge)

Lotação: km rounding diverge (Edge ceil, TS round); baseCost e totals iguais. Fracionado: min weight LTL, dispatch_fee iguais. Onde a divergência aparece na UI: badge faixa km, bloqueio wizard; QuoteDetailModal ao recalcular.

---

### 10. Dicionário de configuração

pricing_parameters: cubage_factor, correction_factor_inctf, das_percent, markup_percent, overhead_percent, profit_margin_percent, carreteiro_percent, das_provision_min_value. pricing_rules_config: das_percent, markup_percent, overhead_percent, profit_margin_percent, regime_simples_nacional, excesso_sublimite, icms_default, icms_uf_XX, gris_percent, tso_percent, cost_value_percent. payment_terms: adjustment_percent (motor); advance_percent, days (UI).

---

### 11. MRE (Mínimo reprodutível)

Lotação: payload com origin, destination, km_distance 450, weight_kg 5000, volume_m3 10, cargo_value 50000, toll_value 0, price_table_id (lotação), payment_term_code D30. Esperado: status OK, base_cost > 0, dispatch_fee 0, total_cliente > 0. Fracionado: weight 200, volume 2, cargo 10000, price_table_id (fracionado). Esperado: billable_weight_kg 1000, ltl_min_weight_applied true, dispatch_fee > 0.

---

### 12. Mapa de Código

calculate-freight, freight-schema, freight-types, price-row, calculate-distance-webrouter, freightCalculator, useCalculateFreight, usePriceTableRows, usePricingRules, QuoteForm, QuoteFormWizard, QuoteDetailModal, FreightSimulator.

---

### 13. Gaps, dúvidas e riscos

1. min_freight, min_freight_cargo_limit não aplicados. 2. ltl_parameters.correction_factor não usado. 3. ltl_parameters.cubage_factor não usado. 4. toll_routes não entra no motor. 5. Origem de tollPlazas documentada. 6. TDE/TEAR desativados. 7. Risco de modalidade.

---

### 14. Checklist pós-hardening

- [x] Contract/Shape com chaves reais e mapeamento snake ↔ camel.
- [x] Glossário com campo exato, arquivo UI e trecho.
- [x] buildStoredBreakdownFromEdgeResponse: receita_liquida e custo_motorista não copiados — documentado.
- [x] Comandos rg e Select-String no evidence-index.
