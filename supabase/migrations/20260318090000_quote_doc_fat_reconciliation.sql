begin;

-- 1) Extend document_type for quote receivable proofs
alter type public.document_type add value if not exists 'a_vista_fat';
alter type public.document_type add value if not exists 'saldo_fat';
alter type public.document_type add value if not exists 'a_prazo_fat';

-- 2) Quote payment proofs (Doc FAT)
create table if not exists public.quote_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  proof_type text not null check (proof_type in ('a_vista','adiantamento','saldo','a_prazo')),
  amount numeric,
  expected_amount numeric,
  status text not null default 'pending' check (status in ('pending','matched','mismatch')),
  extracted_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id)
);

create index if not exists ix_quote_payment_proofs_quote on public.quote_payment_proofs(quote_id);

drop trigger if exists update_quote_payment_proofs_updated_at on public.quote_payment_proofs;
create trigger update_quote_payment_proofs_updated_at
  before update on public.quote_payment_proofs
  for each row execute function public.update_updated_at_column();

create or replace view public.v_quote_payment_reconciliation as
with proof_sums as (
  select
    q.id as quote_id,
    coalesce(sum(qpp.amount) filter (where qpp.amount is not null), 0) as paid_amount,
    count(qpp.id) as proofs_count
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
  (abs(ps.paid_amount - coalesce(q.value, 0)) <= 1) as is_reconciled,
  ps.proofs_count
from public.quotes q
join proof_sums ps on ps.quote_id = q.id;

alter table public.quote_payment_proofs enable row level security;

create policy "Authenticated users can view quote_payment_proofs"
  on public.quote_payment_proofs for select to authenticated using (true);

create policy "Authenticated users can manage quote_payment_proofs"
  on public.quote_payment_proofs for all to authenticated using (true) with check (true);

commit;
