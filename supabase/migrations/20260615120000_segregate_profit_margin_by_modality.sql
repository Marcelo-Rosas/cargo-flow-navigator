-- Migration: Segregar margens alvo por modalidade (Lotação e Fracionado)
-- Contexto: Até agora a chave 'profit_margin_percent' servia tanto para Lotação quanto para
-- Fracionado. Esta migration adiciona as chaves específicas por modalidade.
-- A chave legada 'profit_margin_percent' é mantida como fallback para compatibilidade com
-- cotações salvas antes desta migration.

-- ============================================================
-- 1. Inserir 'profit_margin_lotacao_percent' (se não existir)
-- ============================================================
INSERT INTO pricing_rules_config (key, label, category, value_type, value, description, is_active, vehicle_type_id)
SELECT
  'profit_margin_lotacao_percent',
  'Margem Alvo Lotação (%)',
  'markup',
  'percentage',
  COALESCE(
    (SELECT value FROM pricing_rules_config WHERE key = 'profit_margin_percent' AND vehicle_type_id IS NULL LIMIT 1),
    15
  ),
  'Margem alvo de lucro para Lotação (FTL) — independente do Fracionado',
  true,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM pricing_rules_config WHERE key = 'profit_margin_lotacao_percent' AND vehicle_type_id IS NULL
);

-- ============================================================
-- 2. Inserir 'profit_margin_fracionado_percent' (se não existir)
-- ============================================================
INSERT INTO pricing_rules_config (key, label, category, value_type, value, description, is_active, vehicle_type_id)
SELECT
  'profit_margin_fracionado_percent',
  'Margem Alvo Fracionado (%)',
  'markup',
  'percentage',
  COALESCE(
    (SELECT value FROM pricing_rules_config WHERE key = 'profit_margin_percent' AND vehicle_type_id IS NULL LIMIT 1),
    15
  ),
  'Margem alvo de lucro para Fracionado (LTL) — independente da Lotação',
  true,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM pricing_rules_config WHERE key = 'profit_margin_fracionado_percent' AND vehicle_type_id IS NULL
);

-- ============================================================
-- 3. Manter 'profit_margin_percent' como chave legada (fallback)
-- Não excluir: cotações antigas e a Edge Function ainda usam como fallback.
-- ============================================================
