# Cálculo de Frete / Tabelas de Preço / ANTT / ICMS

**Full spec:** `docs/plans/plan-02-metodologia-precificacao-lotacao-vs-fracionado/v0.2.2/methodology.md`

## Entrypoints

| Camada | Arquivos |
|--------|----------|
| Edge | `supabase/functions/calculate-freight/`, `price-row/`, `calculate-distance-webrouter/` |
| Shared | `_shared/freight-schema.ts`, `freight-types.ts`, `pricing-rules.ts` |
| Client | `src/lib/freightCalculator.ts`, `src/hooks/useCalculateFreight.ts`, `usePriceTableRows.ts`, `usePricingRules.ts` |
| UI | `QuoteForm.tsx`, `QuoteFormWizard.tsx`, `QuoteDetailModal.tsx`, `FreightSimulator.tsx` |

## Tabelas

`price_tables`, `price_table_rows`, `pricing_parameters`, `pricing_rules_config`, `icms_rates`, `antt_floor_rates`, `ltl_parameters`, `conditional_fees`, `payment_terms`

## Contract (StoredPricingBreakdown)

- totals: totalCliente, das, icms, totalImpostos
- profitability: custosCarreteiro, resultadoLiquido, margemPercent
- meta: kmBandUsed, tollPlazas, marginPercent
