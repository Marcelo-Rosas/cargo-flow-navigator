-- PRD v2.0: ensure_financial_document update on existing PAG,
-- trigger to sync total_amount when carreteiro_real changes,
-- hotfix for PAG documents with stale total_amount

begin;

-- 1. Fix ensure_financial_document: update total_amount when PAG already exists
create or replace function public.ensure_financial_document(
  doc_type public.financial_doc_type,
  source_id_in uuid,
  total_amount_in numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
  v_amount numeric;
  v_source_type public.financial_source_type;
begin
  if doc_type = 'FAT' then
    v_source_type := 'quote'::public.financial_source_type;
    if not exists (select 1 from public.quotes where id = source_id_in) then
      raise exception 'Quote not found: %', source_id_in;
    end if;
    select value, coalesce(quote_code, 'FAT-' || left(source_id_in::text, 8)) into v_amount, v_code
    from public.quotes where id = source_id_in;
  elsif doc_type = 'PAG' then
    v_source_type := 'order'::public.financial_source_type;
    if not exists (select 1 from public.orders where id = source_id_in) then
      raise exception 'Order not found: %', source_id_in;
    end if;
    select coalesce(carreteiro_real, value), coalesce(os_number, 'PAG-' || left(source_id_in::text, 8)) into v_amount, v_code
    from public.orders where id = source_id_in;
  else
    raise exception 'Invalid doc_type: %', doc_type;
  end if;

  v_amount := coalesce(total_amount_in, v_amount);

  select fd.id into v_id
  from public.financial_documents fd
  where fd.source_type = v_source_type and fd.source_id = source_id_in
  limit 1;

  if v_id is not null then
    update public.financial_documents
    set total_amount = v_amount
    where id = v_id;
    return jsonb_build_object('id', v_id, 'created', false);
  end if;

  insert into public.financial_documents (type, code, status, source_type, source_id, total_amount)
  values (doc_type, v_code, 'INCLUIR', v_source_type, source_id_in, v_amount)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'created', true);
end;
$$;

-- 2. Trigger: sync financial_documents.total_amount when orders.carreteiro_real changes
create or replace function public.sync_financial_doc_amount_on_carreteiro_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.carreteiro_real is distinct from old.carreteiro_real then
    update public.financial_documents
    set total_amount = new.carreteiro_real
    where source_type = 'order'
      and source_id = new.id
      and type = 'PAG';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_financial_doc_amount on public.orders;
create trigger trg_sync_financial_doc_amount
  after update of carreteiro_real on public.orders
  for each row
  execute function public.sync_financial_doc_amount_on_carreteiro_change();

-- 3. Hotfix: align total_amount of PAG documents with orders.carreteiro_real
-- (fixes OS-2026-02-0008 and any other stale PAGs)
update public.financial_documents fd
set total_amount = o.carreteiro_real
from public.orders o
where fd.source_type = 'order'
  and fd.source_id = o.id
  and fd.type = 'PAG'
  and o.carreteiro_real is not null
  and fd.total_amount is distinct from o.carreteiro_real;

commit;
