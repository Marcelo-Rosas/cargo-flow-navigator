-- =====================================================
-- Migração Regime Tributário: Simples Nacional → Lucro Presumido
-- Vigência: abril/2026
--
-- Alíquotas LP (Transporte Rodoviário de Cargas):
--   PIS:   0,65% cumulativo (destacado na NF)
--   COFINS: 3,00% cumulativo (destacado na NF)
--   IRPJ:  1,20% efetiva (8% presunção × 15% alíquota)
--   CSLL:  1,08% efetiva (12% presunção × 9% alíquota)
--   ICMS:  interestadual 7% ou 12% / interna 17-18% (tabela icms_rates)
--   DAS:   0% (não existe no LP)
-- =====================================================

-- 1. Desativar Simples Nacional
UPDATE public.pricing_rules_config
SET value = 0.0,
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{description}',
      '"Regime Simples Nacional desativado — migrado para Lucro Presumido em abril/2026"'
    ),
    updated_at = now()
WHERE key = 'regime_simples_nacional' AND vehicle_type_id IS NULL;

-- 2. Zerar DAS (não existe no LP)
UPDATE public.pricing_rules_config
SET value = 0.0,
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{description}',
      '"DAS zerada — Lucro Presumido não usa DAS. Mantida para retrocompatibilidade."'
    ),
    updated_at = now()
WHERE key = 'das_percent' AND vehicle_type_id IS NULL;

-- 3. Inserir flag Lucro Presumido
INSERT INTO public.pricing_rules_config (
  key, label, category, value_type, value, min_value, max_value, vehicle_type_id, metadata
) VALUES (
  'regime_lucro_presumido',
  'Regime Lucro Presumido',
  'imposto',
  'fixed',
  1.0,
  0.0,
  1.0,
  NULL,
  '{"description": "Se ativo (1), impostos calculados individualmente: PIS, COFINS, IRPJ, CSLL, ICMS"}'::jsonb
)
ON CONFLICT (key, vehicle_type_id) DO UPDATE SET
  value = 1.0,
  label = EXCLUDED.label,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- 4. PIS (cumulativo, destacado na NF)
INSERT INTO public.pricing_rules_config (
  key, label, category, value_type, value, min_value, max_value, vehicle_type_id, metadata
) VALUES (
  'pis_percent',
  'PIS (%)',
  'imposto',
  'percentage',
  0.65,
  0.0,
  10.0,
  NULL,
  '{"description": "PIS cumulativo sobre receita bruta — destacado na NF de frete"}'::jsonb
)
ON CONFLICT (key, vehicle_type_id) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- 5. COFINS (cumulativo, destacado na NF)
INSERT INTO public.pricing_rules_config (
  key, label, category, value_type, value, min_value, max_value, vehicle_type_id, metadata
) VALUES (
  'cofins_percent',
  'COFINS (%)',
  'imposto',
  'percentage',
  3.00,
  0.0,
  10.0,
  NULL,
  '{"description": "COFINS cumulativo sobre receita bruta — destacado na NF de frete"}'::jsonb
)
ON CONFLICT (key, vehicle_type_id) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- 6. IRPJ efetivo (provisão, NÃO destacado na NF)
INSERT INTO public.pricing_rules_config (
  key, label, category, value_type, value, min_value, max_value, vehicle_type_id, metadata
) VALUES (
  'irpj_effective_percent',
  'IRPJ Efetivo (%)',
  'imposto',
  'percentage',
  1.20,
  0.0,
  10.0,
  NULL,
  '{"description": "IRPJ: 8% presunção × 15% alíquota = 1,20% efetiva. Adicional de 0,80% tratado na contabilidade trimestral."}'::jsonb
)
ON CONFLICT (key, vehicle_type_id) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- 7. CSLL efetivo (provisão, NÃO destacado na NF)
INSERT INTO public.pricing_rules_config (
  key, label, category, value_type, value, min_value, max_value, vehicle_type_id, metadata
) VALUES (
  'csll_effective_percent',
  'CSLL Efetivo (%)',
  'imposto',
  'percentage',
  1.08,
  0.0,
  10.0,
  NULL,
  '{"description": "CSLL: 12% presunção × 9% alíquota = 1,08% efetiva."}'::jsonb
)
ON CONFLICT (key, vehicle_type_id) DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- 8. Atualizar pricing_parameters (legado, lido como fallback)
UPDATE public.pricing_parameters
SET value = 0,
    description = 'Regime tributário: 0 = Não é Simples Nacional (migrado para LP em abril/2026). Mantido para retrocompatibilidade.'
WHERE key = 'tax_regime_simples';

UPDATE public.pricing_parameters
SET value = 0,
    description = 'Provisão DAS zerada — Lucro Presumido não usa DAS.'
WHERE key = 'das_provision_percent';

INSERT INTO public.pricing_parameters (key, value, unit, description)
VALUES (
  'tax_regime_lucro_presumido',
  1,
  NULL,
  'Regime tributário: 1 = Lucro Presumido (PIS/COFINS/IRPJ/CSLL individuais + ICMS por UF).'
)
ON CONFLICT (key) DO UPDATE SET
  value = 1,
  description = EXCLUDED.description;
