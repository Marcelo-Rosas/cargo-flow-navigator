-- Backfill expected_amount for existing payment_proofs (PRD v2.0)
-- Replicates logic from process-payment-proof: adiantamento = carreteiro * advance% / 100,
-- saldo = carreteiro * (100 - advance%) / 100 or carreteiro when no payment term

begin;

update public.payment_proofs pp
set expected_amount = calc.expected
from (
  select
    pp2.id,
    case pp2.proof_type
      when 'adiantamento' then
        (o.carreteiro_real * coalesce(pt.advance_percent, 0) / 100)
      when 'saldo' then
        case
          when o.carrier_payment_term_id is not null
            then (o.carreteiro_real * (100 - coalesce(pt.advance_percent, 0)) / 100)
          else o.carreteiro_real
        end
      else null
    end as expected
  from public.payment_proofs pp2
  join public.orders o on o.id = pp2.order_id
  left join public.payment_terms pt on pt.id = o.carrier_payment_term_id
  where pp2.expected_amount is null
    and o.carreteiro_real is not null
    and o.carreteiro_real > 0
    and pp2.proof_type in ('adiantamento', 'saldo')
) calc
where pp.id = calc.id
  and calc.expected is not null;

commit;
