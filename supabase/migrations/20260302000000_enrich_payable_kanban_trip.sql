-- Enrich financial_payable_kanban with trip_id, trip_number and reconciliation data
-- Depends on: 20260301000000_trips_payment_proofs.sql (trips, v_order_payment_reconciliation)

begin;

drop view if exists public.financial_payable_kanban;

create view public.financial_payable_kanban as
select
  k.*,
  o.client_name,
  o.origin,
  o.destination,
  o.origin_cep,
  o.destination_cep,
  o.value         as order_value,
  o.carreteiro_real,
  o.carreteiro_antt,
  o.cargo_type,
  o.weight,
  o.volume,
  o.km_distance,
  o.freight_type,
  o.freight_modality,
  o.toll_value,
  o.pricing_breakdown,
  o.shipper_name,
  o.trip_id,
  t.trip_number,
  coalesce(r.expected_amount, 0)::numeric as expected_amount,
  coalesce(r.paid_amount, 0)::numeric    as paid_amount,
  coalesce(r.delta_amount, 0)::numeric   as delta_amount,
  coalesce(r.is_reconciled, false)       as is_reconciled,
  coalesce(r.proofs_count, 0)::int      as proofs_count,
  vt.name         as vehicle_type_name,
  vt.code         as vehicle_type_code,
  vt.axes_count,
  pt.name         as payment_term_name,
  pt.code         as payment_term_code,
  pt.days         as payment_term_days,
  pt.adjustment_percent as payment_term_adjustment,
  pt.advance_percent    as payment_term_advance
from public.financial_documents_kanban k
join public.orders o on o.id = k.source_id
left join public.trips t on t.id = o.trip_id
left join public.v_order_payment_reconciliation r on r.order_id = o.id
left join public.vehicle_types vt on vt.id = o.vehicle_type_id
left join public.payment_terms pt on pt.id = o.payment_term_id
where k.type = 'PAG';

commit;
