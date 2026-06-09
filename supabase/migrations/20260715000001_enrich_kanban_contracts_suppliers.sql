-- Enrich financial kanban views with carrier (supplier) and contract data
-- Adds: carrier_name to PAG view, contract info to FAT view

begin;

drop view if exists public.financial_receivable_kanban;
drop view if exists public.financial_payable_kanban;

-- FAT view: enriched with quote pricing, cargo, toll, payment term and contract info
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
  pt.advance_percent    as payment_term_advance,
  -- Contract info: latest version per quote
  qc.pdf_storage_path is not null as has_contract,
  qc.pdf_storage_path as contract_pdf_path,
  qc.version          as contract_version,
  qc.signature_status as contract_signature_status
from public.financial_documents_kanban k
join public.quotes q on q.id = k.source_id
left join public.vehicle_types vt on vt.id = q.vehicle_type_id
left join public.payment_terms pt on pt.id = q.payment_term_id
left join lateral (
  select pdf_storage_path, version, signature_status
  from public.quote_contracts
  where quote_id = k.source_id
  order by version desc
  limit 1
) qc on true
where k.type = 'FAT';

-- PAG view: enriched with order pricing, cargo, toll, payment term and carrier (supplier)
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
  pt.advance_percent    as payment_term_advance,
  -- Carrier (supplier) info
  d.name          as carrier_name,
  d.phone         as carrier_phone
from public.financial_documents_kanban k
join public.orders o on o.id = k.source_id
left join public.vehicle_types vt on vt.id = o.vehicle_type_id
left join public.payment_terms pt on pt.id = o.payment_term_id
left join public.drivers d on d.id = o.driver_id
where k.type = 'PAG';

commit;
