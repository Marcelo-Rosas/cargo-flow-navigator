-- View trip_financial_summary: receita, custos e margem consolidada por viagem

create or replace view public.trip_financial_summary as
select
  t.id as trip_id,
  t.trip_number,
  t.vehicle_plate,
  t.driver_id,
  t.status_operational,
  t.financial_status,
  (select count(*) from public.trip_orders to2 where to2.trip_id = t.id)::int as orders_count,
  coalesce((select sum(o.value) from public.trip_orders to2 join public.orders o on o.id = to2.order_id where to2.trip_id = t.id), 0)::numeric as receita_bruta,
  coalesce((select sum(amount) from public.trip_cost_items where trip_id = t.id and scope = 'TRIP'), 0)::numeric as custos_trip,
  coalesce((select sum(amount) from public.trip_cost_items where trip_id = t.id and scope = 'OS'), 0)::numeric as custos_os,
  coalesce((select sum(amount) from public.trip_cost_items where trip_id = t.id), 0)::numeric as custos_diretos,
  (coalesce((select sum(o.value) from public.trip_orders to2 join public.orders o on o.id = to2.order_id where to2.trip_id = t.id), 0)
   - coalesce((select sum(amount) from public.trip_cost_items where trip_id = t.id), 0))::numeric as margem_bruta,
  case
    when (select coalesce(sum(o.value), 0) from public.trip_orders to2 join public.orders o on o.id = to2.order_id where to2.trip_id = t.id) > 0 then
      round(
        ((coalesce((select sum(o.value) from public.trip_orders to2 join public.orders o on o.id = to2.order_id where to2.trip_id = t.id), 0)
          - coalesce((select sum(amount) from public.trip_cost_items where trip_id = t.id), 0))
         / (select sum(o.value) from public.trip_orders to2 join public.orders o on o.id = to2.order_id where to2.trip_id = t.id) * 100)::numeric, 2)
    else null
  end as margem_percent
from public.trips t;
