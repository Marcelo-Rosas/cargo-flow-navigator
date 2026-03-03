-- Motor Financeiro Híbrido: Configurações Fiscais (Simples vs Sublimite)
-- Adiciona profit_margin_percent e toggles regime_simples_nacional / excesso_sublimite

INSERT INTO public.pricing_rules_config (
  key,
  label,
  category,
  value_type,
  value,
  min_value,
  max_value,
  vehicle_type_id,
  metadata
) VALUES
  (
    'profit_margin_percent',
    'Margem de Lucro Alvo (%)',
    'markup',
    'percentage',
    15.0,
    0.0,
    100.0,
    NULL,
    '{"description": "Margem de lucro líquido desejada após overhead e custos diretos"}'::jsonb
  ),
  (
    'regime_simples_nacional',
    'Regime Simples Nacional',
    'imposto',
    'fixed',
    1.0,
    0.0,
    1.0,
    NULL,
    '{"description": "Se ativo (1), ICMS não é somado ao divisor Gross-up (já incluído na DAS)"}'::jsonb
  ),
  (
    'excesso_sublimite',
    'Excesso de Sublimite (R$ 3,6mi)',
    'imposto',
    'fixed',
    0.0,
    0.0,
    1.0,
    NULL,
    '{"description": "Se ativo (1), ICMS é calculado separadamente (Cálculo por Dentro)"}'::jsonb
  )
ON CONFLICT (key, vehicle_type_id) DO UPDATE SET
  label = EXCLUDED.label,
  value_type = EXCLUDED.value_type,
  value = COALESCE(pricing_rules_config.value, EXCLUDED.value),
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- Atualizar DAS para refletir alíquota efetiva (14%)
UPDATE public.pricing_rules_config
SET
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{description}',
    '"Alíquota efetiva DAS (Simples Nacional) ou DAS Federal (Sublimite)"'
  )
WHERE key = 'das_percent' AND vehicle_type_id IS NULL;
