-- Fix v_quote_payment_reconciliation: use SUM(qpp.expected_amount) when proofs
-- have individual expected amounts, falling back to q.value (full COT) only when
-- no proofs have expected_amount filled.
--
-- Mirrors v_order_payment_reconciliation pattern (which already does this correctly
-- for PAG via payment_proofs.expected_amount vs carreteiro_real).
--
-- Before this fix, expected_amount was always q.value regardless of proof breakdown,
-- causing adiantamento/a_vista proofs that individually reconcile to appear as
-- divergent because their expected_amount (~R$300) != q.value (R$1.000).

begin;

create or replace view public.v_quote_payment_reconciliation as
with proof_sums as (
  select
    q.id as quote_id,
    -- Use sum of per-proof expected_amounts when any proof has it filled;
    -- fall back to q.value (full COT) only when all expected_amounts are null.
    coalesce(
      nullif(
        coalesce(sum(qpp.expected_amount) filter (where qpp.expected_amount is not null), 0),
        0
      ),
      max(coalesce(q.value, 0))
    ) as expected_amount,
    coalesce(sum(qpp.amount) filter (where qpp.amount is not null), 0) as paid_amount,
    count(qpp.id) as proofs_count,
    -- all proofs have amount filled
    (count(qpp.id) = count(qpp.amount)) as all_amounts_filled,
    -- count of proofs with |delta| > 1 and no justification reason
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
  q.id            as quote_id,
  q.quote_code,
  ps.expected_amount,
  ps.paid_amount,
  (ps.paid_amount - ps.expected_amount) as delta_amount,
  (
    abs(ps.paid_amount - ps.expected_amount) <= 1
    or (ps.proofs_count > 0 and ps.all_amounts_filled and ps.unjustified_count = 0)
  ) as is_reconciled,
  ps.proofs_count
from public.quotes q
join proof_sums ps on ps.quote_id = q.id;

commit;
