-- VEC-126: Migrar chaves restantes de pricing_parameters → pricing_rules_config
-- pricing_parameters será depreciado; pricing_rules_config é a única fonte de verdade.

INSERT INTO pricing_rules_config (key, label, category, value_type, value, is_active, metadata)
VALUES
  (
    'correction_factor_inctf',
    'Fator de Correção INCTF/NTC',
    'ntc',
    'fixed',
    0.7202,
    true,
    '{"description": "Fator de correção INCTF/DECOPE/NTC (Dez/2025). Ajusta valores conforme metodologia NTC."}'
  ),
  (
    'das_provision_min_value',
    'Provisão DAS mínima por frete (R$)',
    'imposto',
    'fixed',
    0,
    true,
    '{"description": "Valor mínimo da provisão DAS por frete. Provisão = max(receita × das_provision_percent/100, este valor)."}'
  ),
  (
    'das_provision_percent',
    'Provisão DAS (%)',
    'imposto',
    'percentage',
    0,
    true,
    '{"description": "Provisão DAS percentual. Zerada no Lucro Presumido."}'
  ),
  (
    'forbid_conditional_fees',
    'Bloquear Taxas Condicionais',
    'taxa',
    'fixed',
    0,
    true,
    '{"description": "1 = bloqueia todas as taxas condicionais no cálculo. 0 = taxas condicionais ativas."}'
  )
ON CONFLICT (key) DO NOTHING;
