-- View de auditoria: divergências entre Cotação (COT) e Ordem de Serviço (OS)
-- Permite relatórios financeiros de impacto em margem, rentabilidade e pedágio.
-- Read-only; sem impacto em agentes que leem quotes/orders diretamente.

create or replace view public.v_quote_order_divergence as
select
  o.id                    as order_id,
  q.id                    as quote_id,
  o.os_number             as os_number,
  q.quote_code            as quote_code,
  o.client_name           as client_name,
  o.origin                as origin,
  o.destination           as destination,
  coalesce(q.value, 0)    as quote_value,
  coalesce(o.value, 0)    as order_value,
  coalesce(o.value, 0) - coalesce(q.value, 0) as delta_value,
  q.toll_value            as quote_toll_value,
  o.toll_value            as order_toll_value,
  coalesce(o.toll_value, 0) - coalesce(q.toll_value, 0) as delta_toll,
  q.km_distance           as quote_km,
  o.km_distance           as order_km,
  coalesce(o.km_distance, 0) - coalesce(q.km_distance, 0) as delta_km,
  vt_q.axes_count         as quote_axes_count,
  vt_o.axes_count         as order_axes_count,
  (vt_q.axes_count is not null
   and vt_o.axes_count is not null
   and vt_q.axes_count <> vt_o.axes_count) as axes_divergence,
  coalesce(
    (q.pricing_breakdown->'profitability'->>'margemPercent')::numeric,
    (q.pricing_breakdown->'profitability'->>'margem_percent')::numeric,
    (o.pricing_breakdown->'profitability'->>'margemPercent')::numeric,
    (o.pricing_breakdown->'profitability'->>'margem_percent')::numeric
  )                      as margem_percent_prevista,
  o.stage                 as order_stage,
  o.created_at            as order_created_at
from public.orders o
join public.quotes q on q.id = o.quote_id
left join public.vehicle_types vt_q on vt_q.id = q.vehicle_type_id
left join public.vehicle_types vt_o on vt_o.id = o.vehicle_type_id
where o.quote_id is not null;
