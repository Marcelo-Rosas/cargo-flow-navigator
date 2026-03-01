-- Cash flow summary view: aggregates FAT (receivables) and PAG (payables) by period
-- Skeleton for fluxo de caixa report

begin;

create or replace view public.v_cash_flow_summary as
with doc_periods as (
  select
    fd.id,
    fd.type,
    fd.status,
    fd.total_amount,
    date_trunc('month', coalesce(
      (select min(i.due_date) from public.financial_installments i where i.financial_document_id = fd.id),
      fd.created_at
    ))::date as period
  from public.financial_documents fd
),
installment_sums as (
  select
    fd.id,
    sum(fi.amount) filter (where fi.status = 'baixado') as settled,
    sum(fi.amount) filter (where fi.status = 'pendente') as pending
  from public.financial_documents fd
  left join public.financial_installments fi on fi.financial_document_id = fd.id
  group by fd.id
)
select
  dp.period,
  dp.type,
  dp.status,
  count(*)::int as doc_count,
  coalesce(sum(dp.total_amount), 0)::numeric as total_amount,
  coalesce(sum(isum.settled), 0)::numeric as settled_amount,
  coalesce(sum(isum.pending), 0)::numeric as pending_amount
from doc_periods dp
left join installment_sums isum on isum.id = dp.id
group by dp.period, dp.type, dp.status;

-- RLS: view inherits from underlying tables; grant select to authenticated
grant select on public.v_cash_flow_summary to authenticated;

commit;
