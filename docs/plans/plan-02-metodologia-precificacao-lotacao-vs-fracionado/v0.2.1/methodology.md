---
plan_number: 02
plan_slug: plan-02-metodologia-precificacao-lotacao-vs-fracionado
version: v0.2.1
role: Analista de Produto + Engenheiro(a) de Software (Supabase + TypeScript)
focus: Metodologia de Precificação (Lotação vs Fracionado)
created_at: 2026-03-06
supersedes: v0.2.0
change_type: patch
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

## Plan 02 — Metodologia de Precificação (Lotação vs Fracionado) — v0.2.1

### O que mudou de v0.2.0 → v0.2.1

- **Novo arquivo**: `evidence-index.md` — índice de claims com fonte, comando de verificação e risco de fragilidade.
- **Search log (audit trail)**: comandos `rg` exatos usados na auditoria e resumo do que foi encontrado.
- **Glossário oficial de métricas**: definição, onde aparece no breakdown, onde na UI, semântica (total_cliente, receita_liquida, resultado_liquido, margem_percent, custos_diretos, custos_carreteiro, custo_motorista, ntc_base, pedágio).
- **Matriz por cenário**: Lotação e Fracionado com km rounding, min weight, baseCost, dispatch_fee, totals.total_cliente, profitability.margem_percent; riscos de drift e onde a divergência aparece na UI.
- **Provas negativas com método**: comandos `rg` exatos, diretórios, razão de "não usado".
- **Checklist pós-hardening**: validação do documento (claims com evidência, buscas registradas, divergências com mitigação sugerida).

---

### 1. Sumário executivo

O motor de precificação consolida uma metodologia única para cálculo de frete, diferenciando **Lotação (FTL)** e **Fracionado (LTL)** a partir de `price_tables.modality` (`'lotacao'` ou `'fracionado'`), utilizando sempre a mesma base de entrada (origem, destino, distância, peso, volume, valor da carga, tabela de preços e parâmetros fiscais) e compondo um `CalculateFreightResponse` com `meta`, `components`, `rates`, `totals` e `profitability`, que é persistido em `quotes.pricing_breakdown` (e, indiretamente, em `orders` e documentos financeiros), permitindo auditoria completa do cálculo.

**Índice de evidências**: ver [evidence-index.md](evidence-index.md).

---

### 2. Contrato de precedência (fonte da verdade) — Modalidade

#### Evidência: Edge usa exclusivamente `price_tables.modality`

- **Schema de input** — `supabase/functions/_shared/freight-schema.ts` → `calculateFreightInputSchema`: não inclui `modality` nem `freight_modality`.
- **Cálculo** — `supabase/functions/calculate-freight/index.ts` → handler: `supabase.from('price_tables').select('modality').eq('id', input.price_table_id)`; se `ptData?.modality === 'fracionado'`, define `modality = 'fracionado'`.

#### Evidência: TS local usa `input.modality` do formulário

- **QuoteForm.tsx**: campo `freight_modality`; debounced inclui `freightModality`; repassado como `modality` ao cálculo local.
- **freightCalculator.ts** → `calculateFreight`: `input.modality === 'fracionado'` em ltlMinWeightApplied e isLtl.

#### Risco de drift

- Se `freight_modality=lotacao` e tabela `price_tables.modality=fracionado`: TS = Lotação, Edge = Fracionado → divergência.
- Fluxo: QuoteForm (cálculo local) vs QuoteDetailModal (recalcula via Edge com `price_table_id`).

---

### 3. Metodologia LOTAÇÃO (FTL)

#### 3.1 Inputs e campos usados

- **Entrada HTTP** — `calculateFreightInputSchema`: obrigatórios (origin, destination, km_distance, weight_kg, volume_m3, cargo_value); opcionais (toll_value, price_table_id, vehicle_type_code, payment_term_code, etc.).
- **Supabase**: pricing_rules_config, pricing_parameters, vehicle_types, price_tables, price_table_rows, ltl_parameters, conditional_fees, waiting_time_rules, antt_floor_rates, icms_rates, tac_rates, payment_terms.
- **Persistência** — QuoteForm salva quotes.weight, volume, cubage_weight, billable_weight, price_table_id, vehicle_type_id, payment_term_id, km_distance, toll_value, cargo_value, value, pricing_breakdown.

#### 3.2 Seleção da faixa de km

- **Edge**: `kmBand = Math.ceil(Number(input.km_distance))`; seleção `r.km_from <= kmBand && r.km_to >= kmBand`.
- **Hook (B)**: usePriceTableRowByKmRange recebe ceil do QuoteForm; query `.lte('km_from', kmRounded).gte('km_to', kmRounded)`.
- **TS (A)**: `kmBandUsed = Math.round(Number(input.kmDistance))` para validação; condição `kmBandUsed < kmFrom || kmBandUsed > kmTo` → OUT_OF_RANGE. **Divergência**: round pode rejeitar faixa que Edge aceita.

#### 3.3–3.9 Peso faturável, base cost, pedágio, adicionais, impostos, markup, piso ANTT

Preservados da v0.2.0. Edge: cubageFactor de paramsMap; billableWeightKg = max(weight, cubage); baseCost = (billable/1000)*costPerTon. Pedágio: toll = input.toll_value ?? 0; tollPlazas de calculate-distance-webrouter/extractTollPlazas; toll_routes não entra no motor. GRIS, TSO, conditional_fees, waiting_time; DAS, ICMS, TAC, payment_terms; gross-up; antt_floor_rates.

---

### 4. Metodologia FRACIONADO (LTL)

#### 4.1–4.6

- **Detecção**: price_tables.modality = 'fracionado'.
- **ltl_parameters**: usados gris_percent, gris_min, gris_min_cargo_limit, min_tso, dispatch_fee; não usados min_freight, min_freight_cargo_limit, cubage_factor, correction_factor.
- **Peso**: trava 1.000 kg; ltl_min_weight_applied, original_weight_kg.
- **Base cost**: getLtlWeightColumn → weight_rate_10..200 ou weight_rate_above_200; baseCost = billableWeightKg × ratePerKg.
- **dispatch_fee**: ltlParams?.dispatch_fee ?? 102.9.
- **Impostos e persistência**: mesma lógica que Lotação.

---

### 5. Search log (audit trail)

Comandos `rg` usados na auditoria e resumo do resultado.

| Comando | O que procurou | Resumo |
|---------|----------------|--------|
| `rg "modality|freight_modality|price_tables.modality" supabase/functions/ src/lib/ src/components/` | Uso de modalidade | Edge: `price_tables.modality`; TS: `input.modality` via `debounced.freightModality`; schema sem modality |
| `rg "kmBandUsed|Math\.ceil|Math\.round" supabase/functions/calculate-freight/ src/lib/freightCalculator.ts src/hooks/usePriceTableRows.ts` | KM rounding | Edge: `Math.ceil`; TS: `Math.round` para validação; QuoteForm: ceil para hook |
| `rg "buildStoredBreakdown|buildStoredBreakdownFromEdgeResponse" src/` | Build de breakdown | freightCalculator.ts: `buildStoredBreakdown`; useCalculateFreight: `buildStoredBreakdownFromEdgeResponse`; QuoteForm e QuoteDetailModal usam ambos |
| `rg "toll_value|tollPlazas|extractTollPlazas|toll_routes" supabase/functions/ src/` | Pedágio | Motor: `input.toll_value`; tollPlazas: `extractTollPlazas` em calculate-distance-webrouter; toll_routes: usePricingRules, usePricingMutations; não no motor |
| `rg "min_freight|min_freight_cargo_limit|correction_factor" supabase/functions/calculate-freight/ src/lib/` | Provas negativas | min_freight/cargo_limit: carregados em ltlParams, não em fórmula; correction_factor: motor usa correction_factor_inctf de pricing_parameters, não ltl_parameters |
| `rg "total_cliente|totalCliente|receita_liquida|resultado_liquido|margem_percent|custos_diretos|custos_carreteiro|custo_motorista|ntc_base" supabase/functions/ src/` | Glossário de métricas | Encontrados em freight-types, calculate-freight, freightCalculator, useCalculateFreight, QuoteDetailModal, FreightSimulator |

---

### 6. Glossário oficial de métricas

| Termo | Definição | Onde no breakdown | Onde na UI | Observação |
|-------|-----------|-------------------|------------|------------|
| **total_cliente** / **totalCliente** | Valor final ao cliente (receita_bruta + total_impostos) | `totals.total_cliente` | QuoteForm (value), QuoteDetailModal, FreightSimulator | FreightTotals; persistido em `quotes.value` |
| **receita_liquida** / **receitaLiquida** | totalCliente - totalImpostos | `profitability.receita_liquida` | QuoteDetailModal, FinancialDetailModal | FreightProfitability |
| **resultado_liquido** / **resultadoLiquido** | receitaLiquida - overhead - custosCarreteiro - custosDescarga | `profitability.resultado_liquido` | QuoteForm, QuoteDetailModal, FreightSimulator | |
| **margem_percent** / **marginPercent** | (resultadoLiquido / totalCliente) × 100 | `profitability.margem_percent`, `meta.margin_percent` | QuoteCard, QuoteDetailModal | getMarginStatus usa para ABOVE/BELOW/AT_TARGET |
| **custos_diretos** / **custosDiretos** | custoMotorista + custoServicos + custosDescarga | `profitability.custos_diretos` | FinancialCostBreakdown, OrderDetailModal | |
| **custos_carreteiro** / **custosCarreteiro** | = ntc_base (frete_peso + frete_valor + gris + tso + dispatchFee) | `profitability.custos_carreteiro` | QuoteDetailModal, FinancialCostBreakdown | NTC: custo carreteiro |
| **custo_motorista** / **custoMotorista** | = frete_peso (base cost NTC) | `profitability.custo_motorista` | QuoteDetailModal, QuoteModalLogisticsGrid | Em Lotação, custoMotorista = baseCost |
| **ntc_base** | frete_peso + frete_valor + gris + tso + dispatchFee | `meta.ntc_base` | Não exibido diretamente | Base NTC para custos carreteiro |
| **pedágio** (toll / toll_value / tollPlazas) | Valor R$ do pedágio; praças por rota | `components.toll`; `meta.tollPlazas` | QuoteDetailModal, OrderDetailModal (aba Pedágios), FinancialCard | toll = input.toll_value; tollPlazas de calculate-distance-webrouter |

**Não encontrado**: nenhum termo do glossário ficou sem referência no repo.

---

### 7. Provas negativas com método

Para cada item: comando `rg`, diretórios, conclusão.

| Item | Comando rg | Diretórios | Conclusão |
|------|------------|------------|-----------|
| min_freight | `rg "min_freight" supabase/functions/calculate-freight/ src/lib/freightCalculator.ts` | calculate-freight, freightCalculator | Aparece em `ltlParams.min_freight` e atribuição; **nenhuma** fórmula usa (ex.: `baseCost = max(baseCost, ltlParams.min_freight)`). Variável carregada, nunca entra em cálculo. |
| min_freight_cargo_limit | `rg "min_freight_cargo_limit" supabase/functions/calculate-freight/ src/lib/` | Idem | Carregado; não há `if cargo_value <= min_freight_cargo_limit`. |
| ltl_parameters.cubage_factor | `rg "cubage_factor" supabase/functions/calculate-freight/` | calculate-freight | Motor usa `paramsMap.get('cubage_factor')` (pricing_parameters). `ltlRow.cubage_factor` **não é referenciado**. |
| ltl_parameters.correction_factor | `rg "correction_factor" supabase/functions/calculate-freight/` | calculate-freight | Motor usa `paramsMap.get('correction_factor_inctf')`; `ltlRow.correction_factor` **não referenciado**. |
| toll_routes no motor | `rg "toll_routes" supabase/functions/calculate-freight/` | calculate-freight | **Zero matches**. Tabela existe; motor não consulta. |

---

### 8. Matriz por cenário (TS vs Edge)

#### Cenário 1 — Lotação

| Campo | Edge | TS | Risco de drift | Onde aparece na UI |
|-------|------|-----|----------------|--------------------|
| km rounding | ceil | round (validação) | Alto: km 500,3 → Edge aceita 501–1000; TS pode rejeitar | Badge faixa km; bloqueio envio no wizard |
| min weight LTL | N/A (lotação) | N/A | — | — |
| baseCost | (billableWeightKg/1000)*costPerTon | Idêntico | — | PricingStep, components.base_cost |
| dispatch_fee | 0 | 0 | — | — |
| totals.total_cliente | gross-up | Idêntico | — | QuoteForm value; QuoteDetailModal |
| profitability.margem_percent | (resultadoLiquido/totalCliente)*100 | Idêntico | — | QuoteCard, QuoteDetailModal |

#### Cenário 2 — Fracionado

| Campo | Edge | TS | Risco de drift | Onde aparece na UI |
|-------|------|-----|----------------|--------------------|
| km rounding | ceil | round (validação) | Alto: mesmo que Lotação | Idem |
| min weight LTL | billableWeightKg = 1000 se < 1000 | Idêntico | Baixo — mesma lógica | meta.ltl_min_weight_applied |
| baseCost | billableWeightKg × ratePerKg | Idêntico | — | Idem |
| dispatch_fee | 102,9 (ou ltlParams) | Idêntico | Baixo — mesma fonte | components.dispatch_fee |
| totals.total_cliente | gross-up | Idêntico | — | Idem |
| profitability.margem_percent | Idêntico | Idêntico | — | Idem |

**Onde a divergência pode aparecer na UI**:
- **km rounding**: QuoteForm exibe faixa via `usePriceTableRowByKmRange` (que recebe ceil do QuoteForm); TS valida com round. Se TS retornar OUT_OF_RANGE e a Edge aceitar, o wizard bloqueia envio no client mas um recálculo via Edge poderia aceitar. Risco: usuário vê bloqueio local e, ao recalcular no modal, resultado diferente.
- **modalidade**: Se freight_modality ≠ price_tables.modality, TS e Edge divergem em dispatch_fee e min weight; total_cliente e margem_percent divergem. Aparece em QuoteDetailModal ao recalcular via Edge.

**Mitigação sugerida** (sem alterar código): alinhar kmBandUsed no TS para usar ceil quando a origem do dado for a mesma da Edge; validar modality do form com price_tables.modality antes de habilitar envio.

---

### 9. Dicionário de configuração (derivado por grep)

**pricing_parameters**: cubage_factor, correction_factor_inctf, das_percent, markup_percent, overhead_percent, profit_margin_percent, carreteiro_percent, das_provision_min_value. **pricing_rules_config**: das_percent, markup_percent, overhead_percent, profit_margin_percent, regime_simples_nacional, excesso_sublimite, icms_default, icms_uf_XX, gris_percent, tso_percent, cost_value_percent. **payment_terms**: adjustment_percent (motor); advance_percent, days (UI, não motor).

---

### 10. MRE (Mínimo reprodutível)

**Lotação**: payload com origin, destination, km_distance 450, weight_kg 5000, volume_m3 10, cargo_value 50000, toll_value 0, price_table_id (lotação), vehicle_type_code VUC, payment_term_code D30. Esperado: status OK, base_cost > 0, dispatch_fee 0, total_cliente > 0.

**Fracionado**: payload idêntico com weight 200, volume 2, cargo 10000, price_table_id (fracionado). Esperado: billable_weight_kg 1000, ltl_min_weight_applied true, dispatch_fee > 0.

---

### 11. Tabela comparativa Lotação vs Fracionado

Base cost: Lotação (cost_per_ton/1000 × peso); Fracionado (ratePerKg × peso). Peso: Lotação sem trava; Fracionado trava 1t. dispatch_fee: Lotação 0; Fracionado ltlParams ou 102,9. Persistência idêntica.

---

### 12. Mapa de Código

calculate-freight, freight-schema, freight-types, price-row, calculate-distance-webrouter, freightCalculator, useCalculateFreight, usePriceTableRows, usePricingRules, QuoteForm, QuoteFormWizard, QuoteDetailModal, FreightSimulator. Ver v0.2.0 seção 10 para detalhes.

---

### 13. Gaps, dúvidas e riscos

1. min_freight, min_freight_cargo_limit não aplicados. 2. ltl_parameters.correction_factor não usado. 3. ltl_parameters.cubage_factor não usado. 4. toll_routes não entra no motor. 5. Origem de tollPlazas documentada. 6. TDE/TEAR desativados. 7. Risco de modalidade (freight_modality vs price_tables.modality).

---

### 14. Checklist pós-hardening

- [x] Qualquer claim importante tem evidência no evidence-index.
- [x] Qualquer "não encontrado" tem busca registrada no Search log.
- [x] Qualquer divergência TS vs Edge tem risco descrito e sugestão de mitigação (sem alterar código).
- [x] Glossário de métricas inclui definição, breakdown e UI.
- [x] Provas negativas citam comando rg, diretórios e razão de "não usado".
- [x] Matriz por cenário cobre Lotação e Fracionado com campos-chave.
- [x] evidence-index.md existe e referencia claims, fontes e riscos de fragilidade.
