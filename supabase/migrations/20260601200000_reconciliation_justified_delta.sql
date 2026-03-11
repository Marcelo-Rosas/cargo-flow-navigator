-- Update reconciliation view: mark as reconciled when all divergent proofs
-- have a delta_reason filled (justified divergence), not just exact match.

begin;

create or replace view public.v_quote_payment_reconciliation as
with proof_sums as (
  select
    q.id as quote_id,
    coalesce(sum(qpp.amount) filter (where qpp.amount is not null), 0) as paid_amount,
    count(qpp.id) as proofs_count,
    -- all proofs have amount filled
    (count(qpp.id) = count(qpp.amount)) as all_amounts_filled,
    -- count of proofs with |delta| > 1 and no reason
    count(*) filter (
      where qpp.amount is not null
        and abs(coalesce(qpp.amount, 0) - coalesce(qpp.expected_amount, 0)) > 1
        and qpp.delta_reason is null
    ) as unjustified_count
  from public.quotes q
  left join public.quote_payment_proofs qpp on qpp.quote_id = q.id
  group by q.id
)
select
  q.id as quote_id,
  q.quote_code,
  coalesce(q.value, 0) as expected_amount,
  ps.paid_amount,
  (ps.paid_amount - coalesce(q.value, 0)) as delta_amount,
  (
    abs(ps.paid_amount - coalesce(q.value, 0)) <= 1
    or (ps.proofs_count > 0 and ps.all_amounts_filled and ps.unjustified_count = 0)
  ) as is_reconciled,
  ps.proofs_count
from public.quotes q
join proof_sums ps on ps.quote_id = q.id;

commit;
