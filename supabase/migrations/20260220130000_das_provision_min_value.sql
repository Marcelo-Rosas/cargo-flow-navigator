-- =====================================================
-- Provisão DAS: valor mínimo por frete
-- provisao_das = max(receita × das_provision_percent/100, das_provision_min_value)
-- =====================================================

INSERT INTO public.pricing_parameters (key, value, unit, description)
VALUES
  (
    'das_provision_min_value',
    0,
    'BRL',
    'Valor mínimo da provisão DAS por frete (R$). Provisão = max(receita × das_provision_percent/100, este valor).'
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  unit = EXCLUDED.unit,
  description = EXCLUDED.description;
