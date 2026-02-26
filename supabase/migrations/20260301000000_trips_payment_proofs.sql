-- =====================================================
-- Trips, Trip Orders, Trip Cost Items, Payment Proofs
-- Aggregation of OS + reconciliation support
-- =====================================================

begin;

-- -----------------------------------------------------
-- trips
-- -----------------------------------------------------

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  trip_number text not null unique,
  vehicle_plate text not null,
  driver_id uuid not null references public.drivers(id),
  vehicle_type_id uuid references public.vehicle_types(id),
  departure_at timestamptz,
  status_operational text not null default 'aberta'
    check (status_operational in ('aberta','em_transito','finalizada','cancelada')),
  financial_status text not null default 'open'
    check (financial_status in ('open','closing','closed')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references auth.users(id)
);

create index if not exists ix_trips_plate_driver_status
  on public.trips(vehicle_plate, driver_id, status_operational);

create index if not exists ix_trips_financial_status
  on public.trips(financial_status);

-- Trigger for updated_at
drop trigger if exists update_trips_updated_at on public.trips;
create trigger update_trips_updated_at
  before update on public.trips
  for each row execute function public.update_updated_at_column();

-- -----------------------------------------------------
-- orders / documents: driver_id + trip_id
-- -----------------------------------------------------

alter table public.orders
  add column if not exists driver_id uuid references public.drivers(id),
  add column if not exists trip_id uuid references public.trips(id);

create index if not exists ix_orders_driver_id on public.orders(driver_id);
create index if not exists ix_orders_trip_id on public.orders(trip_id);

alter table public.documents
  add column if not exists trip_id uuid references public.trips(id);

create index if not exists ix_documents_trip_id on public.documents(trip_id);

-- -----------------------------------------------------
-- trip_orders
-- -----------------------------------------------------

create table if not exists public.trip_orders (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  apportion_key text not null default 'revenue'
    check (apportion_key in ('revenue','weight','volume','km','equal','manual')),
  apportion_factor numeric not null default 0,
  manual_percent numeric,
  created_at timestamptz not null default now(),
  unique (trip_id, order_id)
);

create index if not exists ix_trip_orders_trip on public.trip_orders(trip_id);
create index if not exists ix_trip_orders_order on public.trip_orders(order_id);

-- -----------------------------------------------------
-- trip_cost_items
-- -----------------------------------------------------

create table if not exists public.trip_cost_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  scope text not null check (scope in ('TRIP','OS')),
  category text not null check (category in (
    'pedagio','carreteiro','descarga','carga','das','icms',
    'gris','tso','seguro','overhead','combustivel','diaria',
    'manutencao','outros','vpo_pedagio'
  )),
  description text,
  amount numeric not null default 0,
  currency text not null default 'BRL',
  source text not null default 'manual'
    check (source in ('breakdown','manual','api','xml')),
  reference_key text,
  reference_id uuid,
  idempotency_key text unique,
  is_frozen boolean not null default false,
  manually_edited_at timestamptz,
  manually_edited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_scope_order_consistency check (
    (scope = 'TRIP' and order_id is null) or
    (scope = 'OS' and order_id is not null)
  )
);

create index if not exists ix_trip_cost_items_trip_scope
  on public.trip_cost_items(trip_id, scope);

create index if not exists ix_trip_cost_items_order
  on public.trip_cost_items(order_id);

-- Trigger for updated_at
drop trigger if exists update_trip_cost_items_updated_at on public.trip_cost_items;
create trigger update_trip_cost_items_updated_at
  before update on public.trip_cost_items
  for each row execute function public.update_updated_at_column();

-- -----------------------------------------------------
-- payment_proofs
-- -----------------------------------------------------

create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  document_id uuid not null references public.documents(id) on delete cascade,
  proof_type text not null check (proof_type in ('adiantamento','saldo','outros')),
  method text check (method in ('pix','boleto','outro')),
  amount numeric,
  paid_at timestamptz,
  transaction_id text,
  payee_name text,
  payee_document text,
  extracted_fields jsonb not null default '{}'::jsonb,
  extraction_confidence numeric,
  status text not null default 'pending'
    check (status in ('pending','matched','mismatch')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id)
);

create index if not exists ix_payment_proofs_order on public.payment_proofs(order_id);
create index if not exists ix_payment_proofs_trip on public.payment_proofs(trip_id);

-- Trigger for updated_at
drop trigger if exists update_payment_proofs_updated_at on public.payment_proofs;
create trigger update_payment_proofs_updated_at
  before update on public.payment_proofs
  for each row execute function public.update_updated_at_column();

-- -----------------------------------------------------
-- Views: reconciliation by order and trip
-- -----------------------------------------------------

create or replace view public.v_order_payment_reconciliation as
select
  o.id as order_id,
  o.os_number,
  o.trip_id,
  coalesce(o.carreteiro_real, 0) as expected_amount,
  coalesce(o.carreteiro_real, 0) > 0 as has_expected_value,
  coalesce(sum(p.amount) filter (where p.amount is not null), 0) as paid_amount,
  (coalesce(sum(p.amount) filter (where p.amount is not null), 0)
   - coalesce(o.carreteiro_real, 0)) as delta_amount,
  (abs(coalesce(sum(p.amount) filter (where p.amount is not null), 0)
   - coalesce(o.carreteiro_real, 0)) <= 1) as is_reconciled,
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
  coalesce(sum(o.carreteiro_real), 0) as expected_amount,
  coalesce(sum(v.paid_amount), 0) as paid_amount,
  (coalesce(sum(v.paid_amount), 0) - coalesce(sum(o.carreteiro_real), 0)) as delta_amount,
  bool_and(v.is_reconciled) as all_orders_reconciled,
  (abs(coalesce(sum(v.paid_amount), 0) - coalesce(sum(o.carreteiro_real), 0)) <= 1) as total_reconciled,
  (bool_and(v.is_reconciled)
   and abs(coalesce(sum(v.paid_amount), 0) - coalesce(sum(o.carreteiro_real), 0)) <= 1) as trip_reconciled,
  max(v.last_paid_at) as last_paid_at
from public.trips t
join public.orders o on o.trip_id = t.id
join public.v_order_payment_reconciliation v on v.order_id = o.id
group by t.id, t.trip_number, t.status_operational, t.financial_status;

-- -----------------------------------------------------
-- RPC: generate_trip_number()
-- -----------------------------------------------------

create or replace function public.generate_trip_number()
returns text
language sql
as $$
  select 'VG-' || to_char(now(), 'YYYY-MM-') ||
    lpad((coalesce(max(substring(trip_number from 'VG-\d{4}-\d{2}-(\d+)')::int), 0) + 1)::text, 4, '0')
  from public.trips
  where trip_number like 'VG-' || to_char(now(), 'YYYY-MM-') || '%';
$$;

-- -----------------------------------------------------
-- RLS
-- -----------------------------------------------------

alter table public.trips enable row level security;
alter table public.trip_orders enable row level security;
alter table public.trip_cost_items enable row level security;
alter table public.payment_proofs enable row level security;

create policy "Authenticated users can view trips"
  on public.trips for select
  to authenticated
  using (true);

create policy "Authenticated users can manage trips"
  on public.trips for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can view trip_orders"
  on public.trip_orders for select
  to authenticated
  using (true);

create policy "Authenticated users can manage trip_orders"
  on public.trip_orders for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can view trip_cost_items"
  on public.trip_cost_items for select
  to authenticated
  using (true);

create policy "Authenticated users can manage trip_cost_items"
  on public.trip_cost_items for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can view payment_proofs"
  on public.payment_proofs for select
  to authenticated
  using (true);

create policy "Authenticated users can manage payment_proofs"
  on public.payment_proofs for all
  to authenticated
  using (true)
  with check (true);

commit;

