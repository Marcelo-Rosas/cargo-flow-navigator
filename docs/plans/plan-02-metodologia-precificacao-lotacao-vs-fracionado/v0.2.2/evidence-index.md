# Evidence Index — Plan 02 v0.2.2

Índice de evidências para auditoria. Cada claim deve ser verificável via `rg` (Linux/mac) ou `Select-String` (PowerShell). Fonte: arquivo + função/contexto. Commit: 1e297d7a7e85107235524b2f829c8895c608bb87.

---

## 1. Modalidade e precedência

| Claim | Fonte | rg (Linux/mac) | Select-String (PowerShell) | O que espera ver | Risco de fragilidade |
|-------|-------|----------------|---------------------------|------------------|----------------------|
| Schema **não** aceita modality/freight_modality | freight-schema.ts → calculateFreightInputSchema | `rg -n "modality|freight_modality" supabase/functions/_shared/freight-schema.ts` | `Select-String -Path "supabase/functions/_shared/freight-schema.ts" -Pattern "modality|freight_modality"` | Sem matches; schema define origin, destination, km_distance, toll_value, price_table_id, etc. | Baixo — contrato Zod explícito |
| Edge deriva modalidade de price_tables | calculate-freight/index.ts handler | `rg -n "from\('price_tables'\)|ptData\?\.modality" supabase/functions/calculate-freight/index.ts` | `Select-String -Path "supabase/functions/calculate-freight/index.ts" -Pattern "price_tables|ptData"` | Linha com `.from('price_tables').select('modality')`; `if (ptData?.modality === 'fracionado') modality = 'fracionado'` | Baixo |
| TS usa input.modality do form | freightCalculator.ts; QuoteForm.tsx | `rg -n "input\.modality|freightModality" src/lib/freightCalculator.ts src/components/forms/QuoteForm.tsx` | `Select-String -Path "src/lib/freightCalculator.ts","src/components/forms/QuoteForm.tsx" -Pattern "input\.modality|freightModality"` | `input.modality === 'fracionado'`; `modality: debounced.freightModality` | Médio — modality pode divergir de price_tables.modality |

---

## 2. KM rounding

| Claim | Fonte | rg | Select-String | O que espera ver | Risco |
|-------|-------|-----|---------------|------------------|-------|
| Edge usa Math.ceil | calculate-freight/index.ts | `rg -n "Math\.ceil" supabase/functions/calculate-freight/index.ts` | `Select-String -Path "supabase/functions/calculate-freight/index.ts" -Pattern "Math\.ceil"` | `kmBand = Math.ceil(Number(input.km_distance))` | Baixo |
| TS usa Math.round para validação | freightCalculator.ts | `rg -n "kmBandUsed = Math\.round" src/lib/freightCalculator.ts` | `Select-String -Path "src/lib/freightCalculator.ts" -Pattern "kmBandUsed = Math\.round"` | `kmBandUsed = Math.round(Number(input.kmDistance || 0))` | Alto — TS pode rejeitar faixa que Edge aceita |

---

## 3. Contract / Shape — campos reais

| Claim | Fonte | rg | Select-String | O que espera ver | Risco |
|-------|-------|-----|---------------|------------------|-------|
| CalculateFreightResponse tem profitability.receita_liquida | freight-types.ts; calculate-freight/index.ts | `rg -n "receita_liquida" supabase/functions/_shared/freight-types.ts supabase/functions/calculate-freight/index.ts` | `Select-String -Path "supabase/functions/_shared/freight-types.ts","supabase/functions/calculate-freight/index.ts" -Pattern "receita_liquida"` | FreightProfitability.receita_liquida?; linha `receita_liquida: receitaLiquida` no handler | Baixo |
| buildStoredBreakdownFromEdgeResponse **não** copia receita_liquida | useCalculateFreight.ts | `rg -n "receitaLiquida|receita_liquida" src/hooks/useCalculateFreight.ts` | `Select-String -Path "src/hooks/useCalculateFreight.ts" -Pattern "receitaLiquida|receita_liquida"` | profitability mapeia custosCarreteiro, custosDescarga, custosDiretos, margemBruta, overhead, resultadoLiquido, margemPercent; **não** receitaLiquida | Alto — UI deve derivar quando ausente |
| StoredPricingBreakdown.profitability.receitaLiquida opcional | freightCalculator.ts | `rg -n "receitaLiquida\?" src/lib/freightCalculator.ts` | `Select-String -Path "src/lib/freightCalculator.ts" -Pattern "receitaLiquida"` | `receitaLiquida?: number` na interface StoredPricingBreakdown.profitability | Baixo |

---

## 4. Pedágio e tollPlazas

| Claim | Fonte | rg | Select-String | O que espera ver | Risco |
|-------|-------|-----|---------------|------------------|-------|
| Motor usa só input.toll_value | calculate-freight/index.ts | `rg -n "toll_value|toll = input" supabase/functions/calculate-freight/index.ts` | `Select-String -Path "supabase/functions/calculate-freight/index.ts" -Pattern "toll_value|toll = input"` | `const toll = input.toll_value ?? 0` | Baixo |
| toll_routes não no motor | calculate-freight | `rg -n "toll_routes" supabase/functions/calculate-freight/` | `Select-String -Path "supabase/functions/calculate-freight/*.ts" -Pattern "toll_routes"` | Zero matches | Baixo |
| extractTollPlazas em calculate-distance-webrouter | calculate-distance-webrouter/index.ts | `rg -n "extractTollPlazas|informacaoPedagios" supabase/functions/calculate-distance-webrouter/index.ts` | `Select-String -Path "supabase/functions/calculate-distance-webrouter/index.ts" -Pattern "extractTollPlazas|informacaoPedagios"` | `function extractTollPlazas(rota)`; `rota.informacaoPedagios.result.pedagios` | Baixo |
| tollPlazas vem de existingBreakdown | useCalculateFreight.ts | `rg -n "tollPlazas" src/hooks/useCalculateFreight.ts` | `Select-String -Path "src/hooks/useCalculateFreight.ts" -Pattern "tollPlazas"` | `tollPlazas: existingBreakdown?.meta?.tollPlazas` | Alto — recalcular sem existing perde praças |

---

## 5. Provas negativas

| Claim | rg | Select-String | O que espera ver | Risco |
|-------|-----|---------------|------------------|-------|
| min_freight não entra em fórmula | `rg -n "min_freight" supabase/functions/calculate-freight/ src/lib/freightCalculator.ts` | `Select-String -Path "supabase/functions/calculate-freight/*.ts","src/lib/freightCalculator.ts" -Pattern "min_freight"` | Apenas em ltlParams e atribuição; **não** `baseCost = max(baseCost, min_freight)` | Campo carregado, fórmula ausente |
| ltl_parameters.correction_factor não usado | `rg -n "correction_factor" supabase/functions/calculate-freight/` | `Select-String -Path "supabase/functions/calculate-freight/*.ts" -Pattern "correction_factor"` | Motor usa `paramsMap.get('correction_factor_inctf')`; ltlRow.correction_factor não referenciado | ltl_parameters tem coluna; motor ignora |

---

## 6. UI — onde os campos aparecem

| Campo | rg | Select-String | O que espera ver |
|-------|-----|---------------|------------------|
| totalCliente | `rg -n "totalCliente" src/components/` | `Select-String -Path "src/components/**/*.tsx" -Pattern "totalCliente" -Recurse` | QuoteForm, QuoteDetailModal, PricingStep, QuoteModalLogisticsGrid, etc. |
| receitaLiquida | `rg -n "receitaLiquida" src/components/` | `Select-String -Path "src/components/**/*.tsx" -Pattern "receitaLiquida" -Recurse` | QuoteDetailModal, QuoteModalCostCompositionTab, QuoteModalFinancialSummary |
| resultadoLiquido | `rg -n "resultadoLiquido" src/components/` | `Select-String -Path "src/components/**/*.tsx" -Pattern "resultadoLiquido" -Recurse` | QuoteForm, QuoteDetailModal, FreightSimulator, PricingStep |
| margemPercent | `rg -n "margemPercent" src/components/` | `Select-String -Path "src/components/**/*.tsx" -Pattern "margemPercent" -Recurse` | QuoteCard, QuoteDetailModal, FinancialValuesBlock |
| custosCarreteiro | `rg -n "custosCarreteiro" src/` | `Select-String -Path "src/**/*.tsx" -Pattern "custosCarreteiro" -Recurse` | QuoteDetailModal, FinancialCostBreakdown, useDashboardStats |
