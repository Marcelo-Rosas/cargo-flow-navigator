-- Fix reconciliation views to use payment_proofs.expected_amount (PRD v2.0)
-- expected_amount = sum of proof expected_amount when available, fallback to carreteiro_real

begin;

create or replace view public.v_order_payment_reconciliation as
select
  o.id as order_id,
  o.os_number,
  o.trip_id,
  coalesce(
    nullif(coalesce(sum(p.expected_amount) filter (where p.expected_amount is not null), 0), 0),
    coalesce(o.carreteiro_real, 0)
  ) as expected_amount,
  coalesce(o.carreteiro_real, 0) > 0 as has_expected_value,
  coalesce(sum(p.amount) filter (where p.amount is not null), 0) as paid_amount,
  (coalesce(sum(p.amount) filter (where p.amount is not null), 0)
   - coalesce(
       nullif(coalesce(sum(p.expected_amount) filter (where p.expected_amount is not null), 0), 0),
       coalesce(o.carreteiro_real, 0)
     )) as delta_amount,
  (abs(coalesce(sum(p.amount) filter (where p.amount is not null), 0)
   - coalesce(
       nullif(coalesce(sum(p.expected_amount) filter (where p.expected_amount is not null), 0), 0),
       coalesce(o.carreteiro_real, 0)
     )) <= 1) as is_reconciled,
  count(p.id) as proofs_count,
  max(p.paid_at) as last_paid_at
from public.orders o
left join public.payment_proofs p on p.order_id = o.id
group by o.id, o.os_number, o.trip_id, o.carreteiro_real;

create or replace view public.v_trip_payment_reconciliation as
select
  t.id as trip_id,
  t.trip_number,
  t.status_operational,
  t.financial_status,
  count(o.id) as orders_count,
  coalesce(sum(v.expected_amount), 0) as expected_amount,
  coalesce(sum(v.paid_amount), 0) as paid_amount,
  (coalesce(sum(v.paid_amount), 0) - coalesce(sum(v.expected_amount), 0)) as delta_amount,
  bool_and(v.is_reconciled) as all_orders_reconciled,
  (abs(coalesce(sum(v.paid_amount), 0) - coalesce(sum(v.expected_amount), 0)) <= 1) as total_reconciled,
  (bool_and(v.is_reconciled)
   and abs(coalesce(sum(v.paid_amount), 0) - coalesce(sum(v.expected_amount), 0)) <= 1) as trip_reconciled,
  max(v.last_paid_at) as last_paid_at
from public.trips t
join public.orders o on o.trip_id = t.id
join public.v_order_payment_reconciliation v on v.order_id = o.id
group by t.id, t.trip_number, t.status_operational, t.financial_status;

commit;
