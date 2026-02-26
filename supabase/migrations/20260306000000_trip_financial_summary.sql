-- View trip_financial_summary: receita, custos e margem consolidada por viagem

create or replace view public.trip_financial_summary as
select
  t.id as trip_id,
  t.trip_number,
  t.vehicle_plate,
  t.driver_id,
  t.status_operational,
  t.financial_status,
  count(distinct to2.order_id) as orders_count,
  coalesce(sum(o.value), 0)::numeric as receita_bruta,
  coalesce(sum(tci_t.amount), 0)::numeric as custos_trip,
  coalesce(sum(tci_o.amount), 0)::numeric as custos_os,
  (coalesce(sum(tci_t.amount), 0) + coalesce(sum(tci_o.amount), 0))::numeric as custos_diretos,
  (coalesce(sum(o.value), 0) - coalesce(sum(tci_t.amount), 0) - coalesce(sum(tci_o.amount), 0))::numeric as margem_bruta,
  case
    when coalesce(sum(o.value), 0) > 0 then
      round(
        ((coalesce(sum(o.value), 0) - coalesce(sum(tci_t.amount), 0) - coalesce(sum(tci_o.amount), 0))
         / sum(o.value) * 100)::numeric, 2)
    else null
  end as margem_percent
from public.trips t
left join public.trip_orders to2 on to2.trip_id = t.id
left join public.orders o on o.id = to2.order_id
left join public.trip_cost_items tci_t on tci_t.trip_id = t.id and tci_t.scope = 'TRIP' and tci_t.order_id is null
left join public.trip_cost_items tci_o on tci_o.trip_id = t.id and tci_o.scope = 'OS'
group by t.id, t.trip_number, t.vehicle_plate, t.driver_id, t.status_operational, t.financial_status;
