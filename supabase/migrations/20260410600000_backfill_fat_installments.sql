-- Backfill: create financial_installments for existing FAT documents that have none
-- This ensures v_cash_flow_summary correctly shows "Entradas" for old FATs

begin;

-- For each FAT document without installments, create a single "pendente" installment
-- using the document's total_amount and creation date as due_date
insert into public.financial_installments (
  financial_document_id,
  amount,
  due_date,
  payment_method,
  status
)
select
  fd.id,
  fd.total_amount,
  coalesce(
    -- Try to get advance_due_date from the linked quote
    (select q.advance_due_date from public.quotes q where q.id = fd.source_id and q.advance_due_date is not null limit 1),
    -- Fallback to balance_due_date
    (select q.balance_due_date from public.quotes q where q.id = fd.source_id and q.balance_due_date is not null limit 1),
    -- Fallback to document creation date
    fd.created_at::date
  ),
  'Pagamento Único (retroativo)',
  'pendente'
from public.financial_documents fd
where fd.type = 'FAT'
  and fd.total_amount > 0
  and not exists (
    select 1 from public.financial_installments fi
    where fi.financial_document_id = fd.id
  );

commit;
