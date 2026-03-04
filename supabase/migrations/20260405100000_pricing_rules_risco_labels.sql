-- Reclassificar regras de risco para categoria \"Risco / Seguros\" e ajustar labels amigáveis

UPDATE public.pricing_rules_config
SET label = 'GRIS – Gerenciamento de Risco (%)'
WHERE key = 'gris_percent';

UPDATE public.pricing_rules_config
SET label = 'TSO – Seguro Obrigatório (%)'
WHERE key = 'tso_percent';

UPDATE public.pricing_rules_config
SET label = 'RCTR-C / Frete Valor – Riscos e Seguros (%)'
WHERE key = 'cost_value_percent';

