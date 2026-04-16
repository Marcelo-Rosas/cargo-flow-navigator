-- Adiciona constraint de unicidade em (origin_state, destination_state) sem valid_from.
-- Necessário para que 20260407100001 possa usar ON CONFLICT (origin_state, destination_state).
-- A constraint de 3 colunas (icms_rates_unique_route) criada em 20260206 não é suficiente
-- pois o ON CONFLICT deve corresponder exatamente às colunas da constraint.

ALTER TABLE public.icms_rates
  DROP CONSTRAINT IF EXISTS icms_rates_unique_route;

ALTER TABLE public.icms_rates
  ADD CONSTRAINT icms_rates_unique_pair UNIQUE (origin_state, destination_state);
