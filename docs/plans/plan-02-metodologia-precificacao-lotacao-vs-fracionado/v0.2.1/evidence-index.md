# Evidence Index — Plan 02 v0.2.1

Índice de evidências para auditoria do documento de metodologia. Cada claim deve ser verificável via comando `rg` e âncoras estáveis (função, chave, interface).

---

## 1. Modalidade e precedência

| Claim | Fonte | Como verificar | Risco de fragilidade |
|-------|-------|----------------|----------------------|
| O schema de input da Edge **não aceita** `modality` nem `freight_modality` | `supabase/functions/_shared/freight-schema.ts` → `calculateFreightInputSchema` | `rg "modality|freight_modality" supabase/functions/_shared/freight-schema.ts` → não encontra; schema define apenas `origin`, `destination`, `km_distance`, etc. | Baixo — schema Zod é contrato explícito |
| Edge deriva modalidade de `price_tables.modality` | `supabase/functions/calculate-freight/index.ts` → handler: `supabase.from('price_tables').select('modality').eq('id', input.price_table_id)` | `rg "from\('price_tables'\).*modality|ptData\?\.modality" supabase/functions/calculate-freight/` | Baixo — query direta na tabela |
| TS local usa `input.modality` vindo do form | `src/lib/freightCalculator.ts` → `calculateFreight` usa `input.modality`; QuoteForm passa `debounced.freightModality` | `rg "input\.modality|freightModality" src/lib/freightCalculator.ts src/components/forms/QuoteForm.tsx` | Médio — depende de fluxo de form; `modality` pode divergir de `price_tables.modality` |
| Filtro de tabelas por modalidade | `QuoteForm.tsx` → `priceTables?.filter((t) => !watchedFreightModality \|\| t.modality === watchedFreightModality)` | `rg "t\.modality === watchedFreightModality" src/components/forms/QuoteForm.tsx` | Médio — UI filtra, mas não garante que `freight_modality` e tabela selecionada sejam coerentes |

---

## 2. KM rounding e seleção de faixa

| Claim | Fonte | Como verificar | Risco de fragilidade |
|-------|-------|----------------|----------------------|
| Edge usa `Math.ceil` para kmBand | `calculate-freight/index.ts` → `const kmBand = Math.ceil(Number(input.km_distance))` | `rg "Math\.ceil.*km|kmBand = Math\.ceil" supabase/functions/calculate-freight/` | Baixo |
| TS usa `Math.round` para validação da faixa | `freightCalculator.ts` → `calculateFreight`: `kmBandUsed = Math.round(Number(input.kmDistance \|\| 0))` | `rg "kmBandUsed = Math\.round" src/lib/freightCalculator.ts` | Alto — divergência: TS pode rejeitar faixa que Edge aceita (ex.: 500,3 → ceil 501 vs round 500) |
| QuoteForm passa ceil ao hook de faixa | `QuoteForm.tsx` → `debouncedKmBand = Math.ceil(Number(debounced.kmDistance \|\| 0))` | `rg "debouncedKmBand|Math\.ceil.*kmDistance" src/components/forms/QuoteForm.tsx` | Baixo — alinhado à Edge |
| usePriceTableRowByKmRange usa `Math.round` no arg recebido | `usePriceTableRows.ts` → `const kmRounded = Math.round(kmDistance)` | `rg "kmRounded = Math\.round" src/hooks/usePriceTableRows.ts` | Médio — recebe ceil do QuoteForm, round(ceil)=ceil; mas se outro caller passar valor raw, round difere de ceil |

---

## 3. Pedágio e tollPlazas

| Claim | Fonte | Como verificar | Risco de fragilidade |
|-------|-------|----------------|----------------------|
| Motor usa só `input.toll_value` | `calculate-freight/index.ts` → `const toll = input.toll_value ?? 0` | `rg "toll_value|toll = input" supabase/functions/calculate-freight/index.ts` | Baixo |
| `toll_routes` **não** entra no motor | — | `rg "toll_routes" supabase/functions/calculate-freight/` → sem matches | Baixo — ausência comprovada |
| `extractTollPlazas` em calculate-distance-webrouter | `supabase/functions/calculate-distance-webrouter/index.ts` → `function extractTollPlazas(rota)` extrai de `rota.informacaoPedagios.result.pedagios` | `rg "extractTollPlazas|informacaoPedagios" supabase/functions/calculate-distance-webrouter/` | Baixo |
| Client preserva `tollPlazas` em meta | `useCalculateFreight.ts` → `buildStoredBreakdownFromEdgeResponse`: `tollPlazas: existingBreakdown?.meta?.tollPlazas` | `rg "tollPlazas.*existingBreakdown" src/hooks/useCalculateFreight.ts` | Alto — `tollPlazas` vêm de `existingBreakdown`, não da resposta da Edge; se recalcular sem existing, perde praças |
| `toll_value` persistido em quotes/orders | `quotes.toll_value`, `orders.toll_value` em migrations e QuoteForm | `rg "toll_value" supabase/migrations/ src/components/forms/QuoteForm.tsx` | Baixo |

---

## 4. Build e persistência do breakdown

| Claim | Fonte | Como verificar | Risco de fragilidade |
|-------|-------|----------------|----------------------|
| `buildStoredBreakdown` (cálculo local) | `src/lib/freightCalculator.ts` → `export function buildStoredBreakdown` | `rg "buildStoredBreakdown" src/lib/freightCalculator.ts` | Baixo |
| `buildStoredBreakdownFromEdgeResponse` (Edge → stored) | `src/hooks/useCalculateFreight.ts` → `export function buildStoredBreakdownFromEdgeResponse` | `rg "buildStoredBreakdownFromEdgeResponse" src/hooks/useCalculateFreight.ts` | Baixo |
| QuoteForm usa `buildStoredBreakdown` para persistir | `QuoteForm.tsx` → `buildStoredBreakdown(calculationResult, {...})` | `rg "buildStoredBreakdown" src/components/forms/QuoteForm.tsx` | Baixo |
| QuoteDetailModal usa `buildStoredBreakdownFromEdgeResponse` | `QuoteDetailModal.tsx` → import e chamada | `rg "buildStoredBreakdownFromEdgeResponse" src/components/modals/QuoteDetailModal.tsx` | Baixo |

---

## 5. Provas negativas (não usado)

| Claim | Busca realizada | Resultado | Risco |
|-------|-----------------|-----------|-------|
| `min_freight` não entra em fórmula | `rg "min_freight" supabase/functions/calculate-freight/ src/lib/freightCalculator.ts` | Encontrado apenas em `ltlParams` e atribuição; nenhum `baseCost = max(baseCost, ltlParams.min_freight)` ou similar | Campo carregado, fórmula ausente |
| `min_freight_cargo_limit` não usado | `rg "min_freight_cargo_limit" supabase/functions/calculate-freight/ src/lib/` | Idem — só carregamento | Campo carregado, condição ausente |
| `ltl_parameters.cubage_factor` não usado | `rg "cubage_factor" supabase/functions/calculate-freight/` | Motor usa `paramsMap.get('cubage_factor')` (pricing_parameters); `ltlRow.cubage_factor` não referenciado | ltl_parameters tem coluna; motor ignora |
| `ltl_parameters.correction_factor` não usado | `rg "correction_factor" supabase/functions/calculate-freight/` | Motor usa `paramsMap.get('correction_factor_inctf')`; `ltlRow.correction_factor` não referenciado | Idem |
| `toll_routes` não no motor | `rg "toll_routes" supabase/functions/calculate-freight/` | Sem matches | Tabela existe; motor não consulta |

---

## 6. Métricas e glossário (onde aparecem)

| Termo | Breakdown | UI | Observação |
|-------|-----------|-----|------------|
| `total_cliente` / `totalCliente` | `totals.total_cliente` (Edge); `totals.totalCliente` (useCalculateFreight) | QuoteForm (value), QuoteDetailModal, FreightSimulator, QuoteModalLogisticsGrid | Semântica: valor final ao cliente (receita_bruta + impostos) |
| `receita_liquida` / `receitaLiquida` | `profitability.receita_liquida` | QuoteDetailModal, FinancialDetailModal | totalCliente - totalImpostos |
| `resultado_liquido` / `resultadoLiquido` | `profitability.resultado_liquido` | QuoteForm, QuoteDetailModal, FreightSimulator, QuoteModalFinancialSummary | receitaLiquida - overhead - custosCarreteiro - custosDescarga |
| `margem_percent` / `marginPercent` | `profitability.margem_percent`, `meta.margin_percent` | QuoteCard, QuoteDetailModal, complianceCheckWorker, quoteProfitabilityWorker | (resultadoLiquido / totalCliente) * 100 |
| `custos_diretos` / `custosDiretos` | `profitability.custos_diretos` | FinancialCostBreakdown, OrderDetailModal | custoMotorista + custoServicos + custosDescarga |
| `custos_carreteiro` / `custosCarreteiro` | `profitability.custos_carreteiro` | QuoteDetailModal, FinancialCostBreakdown, useDashboardStats | = ntc_base (frete_peso + frete_valor + gris + tso + dispatchFee) |
| `custo_motorista` / `custoMotorista` | `profitability.custo_motorista` (Edge); TS usa `custoMotorista = baseCost`) | QuoteDetailModal, QuoteModalLogisticsGrid | = frete_peso (NTC: base cost) |
| `ntc_base` | `meta.ntc_base` | — | frete_peso + frete_valor + gris + tso + dispatchFee; não exibido diretamente na UI principal |
| `toll` / `toll_value` / `tollPlazas` | `components.toll`; `meta.tollPlazas` | QuoteDetailModal, OrderDetailModal (aba Pedágios), FinancialCard | toll = input.toll_value; tollPlazas de calculate-distance-webrouter |
