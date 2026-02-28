-- PRD v2.0 Phase 2: v_trip_financial_details - previsto vs real por OS, inclui Avulsas

-- View por ordem: trip (quando vinculada) ou avulsa (trip_id null)
-- Inclui previsto (breakdown/trip_cost_items) e real (orders columns)
create or replace view public.v_trip_financial_details as
select
  o.id as order_id,
  o.os_number,
  o.trip_id,
  t.trip_number,
  t.vehicle_plate,
  t.status_operational as trip_status,
  o.value as receita_prevista,
  o.value as receita_real,
  coalesce((o.pricing_breakdown->'components'->>'toll')::numeric, 0) as pedagio_previsto,
  coalesce(o.pedagio_real, 0) as pedagio_real,
  coalesce((o.pricing_breakdown->'profitability'->>'custosDescarga')::numeric, 0) as descarga_previsto,
  coalesce(o.descarga_real, 0) as descarga_real,
  coalesce((o.pricing_breakdown->'profitability'->>'custosCarreteiro')::numeric, 0) as carreteiro_previsto,
  coalesce(o.carreteiro_real, 0) as carreteiro_real,
  coalesce((o.pricing_breakdown->'components'->>'gris')::numeric, 0) as gris_previsto,
  coalesce((o.pricing_breakdown->'components'->>'tso')::numeric, 0) as tso_previsto,
  case when o.trip_id is null then true else false end as is_avulsa
from public.orders o
left join public.trips t on t.id = o.trip_id
where o.value is not null and o.value > 0;
