-- Create kanban views for financial documents
-- Depends on tables: public.financial_documents, public.financial_installments, public.quotes, public.orders

begin;

create or replace view public.financial_documents_kanban as
select
  d.id,
  d.owner_id,
  d.type,
  d.code,
  d.status,
  d.source_type,
  d.source_id,
  d.erp_status,
  d.erp_reference,
  d.total_amount,
  d.notes,
  d.created_at,
  d.updated_at,

  exists (
    select 1
    from public.financial_installments i
    where i.financial_document_id = d.id
      and i.status = 'pendente'
      and i.due_date < current_date
  ) as is_overdue,

  (select count(*) from public.financial_installments i where i.financial_document_id = d.id) as installments_total,

  (select count(*) from public.financial_installments i where i.financial_document_id = d.id and i.status = 'pendente') as installments_pending,

  (select count(*) from public.financial_installments i where i.financial_document_id = d.id and i.status = 'baixado') as installments_settled,

  (select min(i.due_date)
   from public.financial_installments i
   where i.financial_document_id = d.id
     and i.status = 'pendente') as next_due_date

from public.financial_documents d;

-- Receber (FAT) view enriched with quote fields for card rendering
create or replace view public.financial_receivable_kanban as
select
  k.*, 
  q.client_name,
  q.origin,
  q.destination,
  q.value as quote_value
from public.financial_documents_kanban k
join public.quotes q on q.id = k.source_id
where k.type = 'FAT';

-- Pagar (PAG) view enriched with order fields for card rendering
create or replace view public.financial_payable_kanban as
select
  k.*,
  o.client_name,
  o.origin,
  o.destination,
  o.value as order_value,
  o.carreteiro_real,
  o.carreteiro_antt
from public.financial_documents_kanban k
join public.orders o on o.id = k.source_id
where k.type = 'PAG';

commit;
