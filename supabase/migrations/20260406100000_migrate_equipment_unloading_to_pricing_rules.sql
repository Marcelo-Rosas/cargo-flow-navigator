-- Consolidar tabelas legadas de aluguel e carga/descarga na Central de Regras
-- Fonte: equipment_rental_rates + unloading_cost_rates -> pricing_rules_config

-- 1) Migrar aluguel (equipment_rental_rates)
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
SELECT
  er.code AS key,
  er.name AS label,
  'aluguel'::pricing_rule_category AS category,
  'fixed'::pricing_rule_value_type AS value_type,
  COALESCE(er.value, 0)::numeric(15,4) AS value,
  0::numeric(15,4) AS min_value,
  NULL::numeric(15,4) AS max_value,
  NULL::uuid AS vehicle_type_id,
  COALESCE(er.active, true) AS is_active,
  jsonb_strip_nulls(
    jsonb_build_object(
      'unit', COALESCE(NULLIF(er.unit, ''), 'dia'),
      'legacy_id', er.id,
      'legacy_table', 'equipment_rental_rates',
      'migrated_at', now()
    )
  ) AS metadata
FROM public.equipment_rental_rates er
ON CONFLICT (key, vehicle_type_id) DO UPDATE
SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  value = EXCLUDED.value,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value,
  is_active = EXCLUDED.is_active,
  metadata = COALESCE(public.pricing_rules_config.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = now();

-- 2) Migrar carga/descarga (unloading_cost_rates)
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
SELECT
  uc.code AS key,
  uc.name AS label,
  'carga_descarga'::pricing_rule_category AS category,
  'fixed'::pricing_rule_value_type AS value_type,
  COALESCE(uc.value, 0)::numeric(15,4) AS value,
  0::numeric(15,4) AS min_value,
  NULL::numeric(15,4) AS max_value,
  NULL::uuid AS vehicle_type_id,
  COALESCE(uc.active, true) AS is_active,
  jsonb_strip_nulls(
    jsonb_build_object(
      'unit', COALESCE(NULLIF(uc.unit, ''), 'unidade'),
      'legacy_id', uc.id,
      'legacy_table', 'unloading_cost_rates',
      'migrated_at', now()
    )
  ) AS metadata
FROM public.unloading_cost_rates uc
ON CONFLICT (key, vehicle_type_id) DO UPDATE
SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  value = EXCLUDED.value,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value,
  is_active = EXCLUDED.is_active,
  metadata = COALESCE(public.pricing_rules_config.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = now();

-- 3) Desativar seeds antigas conflitando com a nova modelagem por item
UPDATE public.pricing_rules_config
SET
  is_active = false,
  updated_at = now(),
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('deprecated_by_migration', '20260406100000')
WHERE vehicle_type_id IS NULL
  AND key IN ('loading_unloading_fixed', 'equipment_rental_forklift');
