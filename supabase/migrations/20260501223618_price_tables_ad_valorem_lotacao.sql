-- Add per-table ad valorem override for lotação
-- When NULL, engine falls back to pricing_rules_config.ad_valorem_lotacao_percent
ALTER TABLE public.price_tables
  ADD COLUMN IF NOT EXISTS ad_valorem_lotacao_percent numeric(6,4) NULL;

COMMENT ON COLUMN public.price_tables.ad_valorem_lotacao_percent IS
'Percentual ad valorem (%) para lotação nesta tabela. Substitui GRIS+TSO. NULL = herdar de pricing_rules_config.';
