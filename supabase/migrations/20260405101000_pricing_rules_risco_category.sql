-- Reclassificar GRIS, TSO e RCTR-C para categoria Risco / Seguros
UPDATE public.pricing_rules_config
SET category = 'risco'
WHERE key IN ('gris_percent', 'tso_percent', 'cost_value_percent');
