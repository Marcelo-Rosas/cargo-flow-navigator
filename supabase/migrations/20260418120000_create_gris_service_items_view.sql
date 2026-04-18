-- View: gris_service_items
-- Expõe os custos de GRIS por order_id para uso no hook useDreOperacionalReport.
-- Usa amount_real se disponível, caso contrário usa amount_previsto.
create or replace view gris_service_items
  with (security_invoker = true)
as
select
  order_id,
  coalesce(amount_real, amount_previsto) as amount
from order_gris_services;
