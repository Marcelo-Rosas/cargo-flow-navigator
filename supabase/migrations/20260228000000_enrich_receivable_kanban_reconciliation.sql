-- Enrich financial_receivable_kanban with reconciliation data (FAT mirror of PAG)
-- Mirrors v_order_payment_reconciliation for PAG; uses v_quote_payment_reconciliation for FAT

begin;

drop view if exists public.financial_receivable_kanban;

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
  coalesce(r.expected_amount, 0)::numeric as expected_amount,
  coalesce(r.paid_amount, 0)::numeric    as paid_amount,
  coalesce(r.delta_amount, 0)::numeric   as delta_amount,
  coalesce(r.is_reconciled, false)       as is_reconciled,
  coalesce(r.proofs_count, 0)::int       as proofs_count,
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
left join public.v_quote_payment_reconciliation r on r.quote_id = q.id
left join public.vehicle_types vt on vt.id = q.vehicle_type_id
left join public.payment_terms pt on pt.id = q.payment_term_id
where k.type = 'FAT';

commit;
