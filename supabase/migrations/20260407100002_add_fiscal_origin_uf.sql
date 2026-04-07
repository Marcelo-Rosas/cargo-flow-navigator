-- =====================================================
-- UF Fiscal: estado de emissão do CT-e (sede da transportadora)
-- A Vectra Cargo é sediada em SC (Navegantes/Itajaí).
-- O ICMS interestadual é determinado pela UF fiscal, não pela UF de coleta.
--
-- Regra: SC → N/NE/CO/ES = 7%, SC → S/SE = 12%, SC → SC = 17%
-- =====================================================

INSERT INTO public.pricing_rules_config (
  key, label, category, value_type, value, min_value, max_value, vehicle_type_id, metadata
) VALUES (
  'fiscal_origin_uf',
  'UF Fiscal (emissão CT-e)',
  'imposto',
  'fixed',
  0.0,
  0.0,
  1.0,
  NULL,
  '{"description": "UF da sede para emissão do CT-e. Determina ICMS interestadual.", "uf": "SC"}'::jsonb
)
ON CONFLICT (key, vehicle_type_id) DO UPDATE SET
  label = EXCLUDED.label,
  metadata = EXCLUDED.metadata,
  updated_at = now();
