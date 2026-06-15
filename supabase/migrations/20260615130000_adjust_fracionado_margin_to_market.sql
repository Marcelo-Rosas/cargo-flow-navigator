-- =============================================================================
-- Ajuste de margem alvo do FRACIONADO para alinhar ao preco de mercado
-- =============================================================================
-- Contexto (benchmark COT-2026-06-0007, 2026-06-15):
--   modality=fracionado, peso 500kg (billable 1t LTL), km=1201
--   custos diretos = R$ 1.991,80
--   regimeFiscal=normal, overhead=15%, icms=12%, das=0%
--   profit_margin_percent=30% (legado, unico)
--   taxaBruta atual = (15 + 12 + 30) / 100 = 0,57
--   precoFinal     = 1991,80 / (1 - 0,57) = R$ 4.632 (saved value R$ 4.638)
--   marginPercent obtido = 38,4% (ABOVE_TARGET, sobre-precificado vs mercado LTL)
--
-- Alvo competitivo LTL (~R$ 3.600 para 1t / 1201km):
--   taxaBruta alvo  = 1 - 1991,80 / 3600 = 0,447
--   profit_margin_fracionado_percent = 44,7 - 15 - 12 = 17,7% -> arredondado 18%
--
-- Lotacao FICA inalterada em 30% (FTL nao apresentou o mesmo sintoma).
--
-- Schema nota: pricing_rules_config NAO tem coluna `description`; descricao livre
-- vive em metadata.description (jsonb).
--
-- IMPORTANTE: este SQL eh idempotente. Funciona em qualquer ordem com a
-- migration 20260615120000 (segregacao).
-- =============================================================================

-- 1) profit_margin_fracionado_percent = 18 (alvo competitivo)
INSERT INTO public.pricing_rules_config
  (key, label, category, value_type, value, metadata, is_active, vehicle_type_id)
VALUES
  (
    'profit_margin_fracionado_percent',
    'Margem Alvo Fracionado (%)',
    'markup',
    'percentage',
    18,
    jsonb_build_object('description', 'Margem alvo de lucro para Fracionado (LTL) — ajustada para preco competitivo de mercado (benchmark COT-2026-06-0007)'),
    true,
    NULL
  )
ON CONFLICT (key, vehicle_type_id) DO UPDATE
SET value      = EXCLUDED.value,
    metadata   = EXCLUDED.metadata,
    is_active  = EXCLUDED.is_active,
    updated_at = NOW();

-- 2) profit_margin_lotacao_percent = 30 (mantem o valor legado)
INSERT INTO public.pricing_rules_config
  (key, label, category, value_type, value, metadata, is_active, vehicle_type_id)
VALUES
  (
    'profit_margin_lotacao_percent',
    'Margem Alvo Lotacao (%)',
    'markup',
    'percentage',
    30,
    jsonb_build_object('description', 'Margem alvo de lucro para Lotacao (FTL) — mantida em 30% (sem ajuste de mercado nesta rodada)'),
    true,
    NULL
  )
ON CONFLICT (key, vehicle_type_id) DO UPDATE
SET value      = EXCLUDED.value,
    metadata   = EXCLUDED.metadata,
    is_active  = EXCLUDED.is_active,
    updated_at = NOW();

-- =============================================================================
-- Validacao pos-aplicacao (rodar manualmente):
--   SELECT key, value, vehicle_type_id, is_active
--   FROM public.pricing_rules_config
--   WHERE key IN ('profit_margin_lotacao_percent', 'profit_margin_fracionado_percent')
--   ORDER BY key;
-- Esperado:
--   profit_margin_fracionado_percent | 18 | NULL | true
--   profit_margin_lotacao_percent    | 30 | NULL | true
-- =============================================================================
