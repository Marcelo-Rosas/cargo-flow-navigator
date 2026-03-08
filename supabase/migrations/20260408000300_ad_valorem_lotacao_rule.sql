-- =====================================================
-- F23: Ad Valorem (Lotação) — Central de Riscos
-- Plan 04 — Custo Risco Lotação
--
-- Para LOTAÇÃO, o Ad Valorem substitui GRIS/TSO como
-- componente único de custo de risco. Taxa baseada nas
-- apólices RCTR-C (0,015%) + RC-DC (0,015%) = 0,03%.
--
-- O valor é editável na Central de Riscos e garante
-- cobertura mínima dos custos de seguro + GR (Buonny).
-- =====================================================

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
) VALUES (
  'ad_valorem_lotacao_percent',
  'Ad Valorem – Lotação (%)',
  'risco',
  'percentage',
  0.03,
  0.0,
  5.0,
  NULL,
  jsonb_build_object(
    'description', 'Alíquota Ad Valorem sobre valor da NF para Lotação (FTL). Substitui GRIS/TSO. Cobre prêmio seguro (RCTR-C + RC-DC) + custos GR.',
    'modality', 'lotacao',
    'replaces', ARRAY['gris_percent', 'tso_percent'],
    'baseline_rctr_c', 0.015,
    'baseline_rc_dc', 0.015,
    'baseline_total', 0.03,
    'editable', true
  )
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
