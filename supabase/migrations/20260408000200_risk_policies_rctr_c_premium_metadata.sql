-- =====================================================
-- F22: Seed RCTR-C policy + premium_rate metadata
-- Plan 04 — Ad Valorem Lotação
--
-- Dados extraídos das apólices Berkley:
-- RCTR-C: Apólice 1005400015107, taxa 0,015% por averbação
-- RC-DC:  Apólice 1005500008136, taxa 0,015% por averbação
-- Total seguro por embarque: 0,03% sobre valor NF
-- =====================================================

-- 1. Seed RCTR-C policy (a apólice RC-DC já existe)
INSERT INTO public.risk_policies (
  code, name, policy_type, insurer, endorsement, risk_manager,
  valid_from, coverage_limit, metadata
)
VALUES (
  'RCTRC-1005400015107',
  'RCTR-C Apolice 1005400015107',
  'RCTR-C',
  'Berkley International do Brasil Seguros SA',
  NULL,
  'Buonny',
  '2025-03-25',
  2500000.00,
  jsonb_build_object(
    'premium_rate_percent', 0.015,
    'ramo', '54 - RCTR-C',
    'processo_susep', '15414.000199/2010-61',
    'proposta', '88655556',
    'vigencia_ate', '2026-03-31',
    'corretora_lider', 'Korsa Adm. e Corretora de Seguros Ltda',
    'coberturas_adicionais', ARRAY['avarias_particulares', 'limpeza_pista']
  )
)
ON CONFLICT (code) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  insurer = EXCLUDED.insurer,
  coverage_limit = EXCLUDED.coverage_limit,
  updated_at = now();

-- 2. Update RC-DC policy with premium_rate metadata
UPDATE public.risk_policies
SET
  insurer = 'Berkley International do Brasil Seguros SA',
  metadata = jsonb_build_object(
    'premium_rate_percent', 0.015,
    'premium_min_monthly', 1000.00,
    'premium_min_monthly_iof_percent', 7.38,
    'ramo', '55 - RCF-DC',
    'processo_susep', '15414.004941/2011-99',
    'proposta', '894799211',
    'vigencia_ate', '2026-03-31',
    'corretora_lider', 'Korsa Adm. e Corretora de Seguros Ltda',
    'gerenciadoras_autorizadas', ARRAY[
      'ANGELLIRA', 'BRK TECNOLOGIA', 'GF RISK', 'GLOBAL 5',
      'GOLDEN SERVICE', 'GUEP', 'J&C', 'OPENTECH', 'OTNET',
      'RASTER', 'TECNORISK'
    ]
  ),
  updated_at = now()
WHERE code = 'RCDC-1005500008136';
