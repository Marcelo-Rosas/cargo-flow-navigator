-- =====================================================
-- Regime tributário e provisão DAS por frete (Simples Nacional)
-- tax_regime_simples: 1 = Simples, 0 = Normal
-- das_provision_percent: % sobre frete para provisão DAS (colchão)
-- =====================================================

INSERT INTO public.pricing_parameters (key, value, unit, description)
VALUES
  (
    'tax_regime_simples',
    1,
    NULL,
    'Regime tributário: 1 = Simples Nacional (ICMS 0%, DAS como provisão por frete), 0 = Normal. Default 1.'
  ),
  (
    'das_provision_percent',
    14.0,
    '%',
    'Provisão DAS por frete (colchão conservador). Default 14%. No Simples, totals.das = receita × este percentual.'
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  unit = EXCLUDED.unit,
  description = EXCLUDED.description;
