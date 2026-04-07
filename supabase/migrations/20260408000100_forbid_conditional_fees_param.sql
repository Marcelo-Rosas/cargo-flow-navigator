-- =====================================================
-- Feature flag: FORBID_CONDITIONAL_FEES
-- Plan 04 v0.1.0 — Transition plan for conditional_fees
--
-- When set to 'true', the calculate-freight Edge function
-- ignores input.conditional_fees. v5 clients manage fees
-- locally via extras.conditionalFees (Taxas Adicionais).
--
-- Current usage points (for reference):
-- - QuoteForm.tsx: computes conditional fees locally via extras.conditionalFees
-- - FreightSimulator.tsx: sends conditional_fees to Edge (testing tool)
-- - QuoteDetailModal.tsx: no longer sends conditional_fees (removed in F13)
-- - calculate-freight/index.ts: queries conditional_fees table when input provided
-- - AdditionalFeesSection.tsx: UI for selecting conditional fees
-- =====================================================

INSERT INTO public.pricing_parameters (key, value, unit, description)
VALUES (
  'FORBID_CONDITIONAL_FEES',
  0,
  'boolean_0_1',
  'Quando true (=1), o motor Edge ignora input.conditional_fees. Quando false (=0), comportamento legado.'
)
ON CONFLICT (key) DO NOTHING;


