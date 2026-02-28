-- Enrich financial kanban views with pricing, cargo, toll and payment term data
-- DROP+CREATE needed because column order changed (PG doesn't allow reorder with CREATE OR REPLACE)

begin;

drop view if exists public.financial_receivable_kanban;
drop view if exists public.financial_payable_kanban;

-- FAT view: enriched with quote pricing, cargo, toll and payment term
create view public.financial_receivable_kanban as
select
  k.*,
  q.client_name,
  q.origin,
  q.destination,
  q.origin_cep,
  q.destination_cep,
  q.value         as quote_value,
  q.cargo_type,
  q.weight,
  q.volume,
  q.km_distance,
  q.freight_type,
  q.freight_modality,
  q.toll_value,
  q.pricing_breakdown,
  q.shipper_name,
  vt.name         as vehicle_type_name,
  vt.code         as vehicle_type_code,
  vt.axes_count,
  pt.name         as payment_term_name,
  pt.code         as payment_term_code,
  pt.days         as payment_term_days,
  pt.adjustment_percent as payment_term_adjustment,
  pt.advance_percent    as payment_term_advance
from public.financial_documents_kanban k
join public.quotes q on q.id = k.source_id
left join public.vehicle_types vt on vt.id = q.vehicle_type_id
left join public.payment_terms pt on pt.id = q.payment_term_id
where k.type = 'FAT';

-- PAG view: enriched with order pricing, cargo, toll and payment term
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
left join public.vehicle_types vt on vt.id = o.vehicle_type_id
left join public.payment_terms pt on pt.id = o.payment_term_id
where k.type = 'PAG';

commit;
