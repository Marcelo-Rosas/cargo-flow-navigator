-- Garantir defaults de risco na Central sem sobrescrever configuração manual já válida
-- Regras: gris_percent=0.30, tso_percent=0.15, cost_value_percent=0.30

INSERT INTO public.pricing_rules_config (
  key,
  label,
  category,
  value_type,
  value,
  min_value,
  max_value,
  vehicle_type_id,
  is_active,
  metadata
)
VALUES
  (
    'gris_percent',
    'GRIS – Gerenciamento de Risco (%)',
    'risco',
    'percentage',
    0.30,
    0.00,
    10.00,
    NULL,
    true,
    '{"description": "Alíquota GRIS sobre valor da NF (NTC)", "synced_by": "20260406101000"}'::jsonb
  ),
  (
    'tso_percent',
    'TSO – Seguro Obrigatório (%)',
    'risco',
    'percentage',
    0.15,
    0.00,
    10.00,
    NULL,
    true,
    '{"description": "Alíquota TSO sobre valor da NF (NTC)", "synced_by": "20260406101000"}'::jsonb
  ),
  (
    'cost_value_percent',
    'RCTR-C / Frete Valor – Riscos e Seguros (%)',
    'risco',
    'percentage',
    0.30,
    0.00,
    10.00,
    NULL,
    true,
    '{"description": "Alíquota RCTR-C sobre valor da NF (NTC)", "synced_by": "20260406101000"}'::jsonb
  )
ON CONFLICT (key, vehicle_type_id) DO UPDATE
SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value,
  is_active = true,
  value = CASE
    WHEN public.pricing_rules_config.value IS NULL OR public.pricing_rules_config.value <= 0
      THEN EXCLUDED.value
    ELSE public.pricing_rules_config.value
  END,
  metadata = COALESCE(public.pricing_rules_config.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = now();
