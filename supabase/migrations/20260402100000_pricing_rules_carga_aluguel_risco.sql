-- Novas categorias e regras: Carga e Descarga, Aluguel, Taxas de Risco (GRIS/TSO/RCTR-C)

-- 1. Adicionar novos valores ao enum pricing_rule_category (PostgreSQL 9.1+)
DO $$ BEGIN
  ALTER TYPE pricing_rule_category ADD VALUE 'carga_descarga';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE pricing_rule_category ADD VALUE 'aluguel';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Inserir regras de Carga e Descarga
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
    'loading_unloading_fixed',
    'Valor fixo de carga e descarga (R$)',
    'carga_descarga',
    'fixed',
    0.0,
    0.0,
    99999.99,
    NULL,
    '{"description": "Valor fixo padrão para carga/descarga quando não definido por item"}'::jsonb
  )
ON CONFLICT (key, vehicle_type_id) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  value = COALESCE(pricing_rules_config.value, EXCLUDED.value),
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- 3. Inserir regras de Aluguel
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
    'equipment_rental_forklift',
    'Diária empilhadeira (R$)',
    'aluguel',
    'fixed',
    0.0,
    0.0,
    99999.99,
    NULL,
    '{"description": "Valor diário padrão para aluguel de empilhadeira"}'::jsonb
  )
ON CONFLICT (key, vehicle_type_id) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  value = COALESCE(pricing_rules_config.value, EXCLUDED.value),
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- 4. Inserir taxas de risco (GRIS, TSO, RCTR-C) na categoria imposto para edição na aba Impostos
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
    'gris_percent',
    'GRIS (%)',
    'imposto',
    'percentage',
    0.3,
    0.0,
    10.0,
    NULL,
    '{"description": "Alíquota GRIS sobre valor da NF (NTC)"}'::jsonb
  ),
  (
    'tso_percent',
    'TSO (%)',
    'imposto',
    'percentage',
    0.0,
    0.0,
    10.0,
    NULL,
    '{"description": "Alíquota TSO sobre valor da NF (NTC)"}'::jsonb
  ),
  (
    'cost_value_percent',
    'RCTR-C / Frete Valor (%)',
    'imposto',
    'percentage',
    0.0,
    0.0,
    10.0,
    NULL,
    '{"description": "Alíquota RCTR-C sobre valor da NF (NTC)"}'::jsonb
  )
ON CONFLICT (key, vehicle_type_id) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  value = COALESCE(pricing_rules_config.value, EXCLUDED.value),
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value,
  metadata = EXCLUDED.metadata,
  updated_at = now();
