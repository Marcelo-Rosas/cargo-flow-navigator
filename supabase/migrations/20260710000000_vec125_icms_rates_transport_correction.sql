-- VEC-125: Corrigir icms_rates com alíquotas de TRANSPORTE (não mercadoria)
-- e remover icms_uf_* de pricing_rules_config (dead data — motor nunca lê essas chaves)
--
-- Regra ICMS para serviços de transporte (CT-e emitido em SC):
--   SC → Sul/Sudeste (PR, RS, SP, RJ, MG, ES, SC): 12%
--   SC → demais estados: 7%
--
-- Fonte: Lei Complementar 87/96 + tabela interestadual CONFAZ transporte

-- =====================================================
-- 1. CORRIGIR icms_rates — alíquotas de transporte para origem SC
-- =====================================================

-- Remove linhas com origin_state = SC para reinserir corrigidas
DELETE FROM icms_rates WHERE origin_state = 'SC';

-- SC → Sul/Sudeste: 12%
INSERT INTO icms_rates (origin_state, destination_state, rate_percent) VALUES
  ('SC', 'SC', 12),  -- intraestadual
  ('SC', 'PR', 12),
  ('SC', 'RS', 12),
  ('SC', 'SP', 12),
  ('SC', 'RJ', 12),
  ('SC', 'MG', 12),
  ('SC', 'ES', 12);

-- SC → demais estados: 7%
INSERT INTO icms_rates (origin_state, destination_state, rate_percent) VALUES
  ('SC', 'AC', 7),
  ('SC', 'AL', 7),
  ('SC', 'AM', 7),
  ('SC', 'AP', 7),
  ('SC', 'BA', 7),
  ('SC', 'CE', 7),
  ('SC', 'DF', 7),
  ('SC', 'GO', 7),
  ('SC', 'MA', 7),
  ('SC', 'MT', 7),
  ('SC', 'MS', 7),
  ('SC', 'PA', 7),
  ('SC', 'PB', 7),
  ('SC', 'PE', 7),
  ('SC', 'PI', 7),
  ('SC', 'RN', 7),
  ('SC', 'RO', 7),
  ('SC', 'RR', 7),
  ('SC', 'SE', 7),
  ('SC', 'TO', 7);

-- =====================================================
-- 2. REMOVER icms_uf_* de pricing_rules_config (dead data)
--    Motor nunca leu essas chaves — causa confusão no usuário
-- =====================================================

DELETE FROM pricing_rules_config
WHERE key IN (
  'icms_uf_mg',
  'icms_uf_pr',
  'icms_uf_rj',
  'icms_uf_rs',
  'icms_uf_sc',
  'icms_uf_sp'
);
