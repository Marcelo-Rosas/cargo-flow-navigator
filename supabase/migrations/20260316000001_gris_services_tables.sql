-- PRD v2.0 Phase 2: gris_services and order_gris_services for GRIS cost tracking

begin;

create table if not exists public.gris_services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  default_percent numeric default 0.30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_gris_services (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  gris_service_id uuid not null references public.gris_services(id) on delete restrict,
  amount_previsto numeric,
  amount_real numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, gris_service_id)
);

create index if not exists ix_order_gris_services_order on public.order_gris_services(order_id);

alter table public.gris_services enable row level security;
alter table public.order_gris_services enable row level security;

create policy "Authenticated can view gris_services"
  on public.gris_services for select to authenticated using (true);

create policy "Authenticated can view order_gris_services"
  on public.order_gris_services for select to authenticated using (true);

create policy "Authenticated with profile can manage gris_services"
  on public.gris_services for all to authenticated
  using (public.has_profile(array['admin','financeiro','operacional']::public.user_profile[]))
  with check (public.has_profile(array['admin','financeiro','operacional']::public.user_profile[]));

create policy "Authenticated with profile can manage order_gris_services"
  on public.order_gris_services for all to authenticated
  using (public.has_profile(array['admin','financeiro','operacional']::public.user_profile[]))
  with check (public.has_profile(array['admin','financeiro','operacional']::public.user_profile[]));

-- Seed default GRIS
insert into public.gris_services (code, name, default_percent)
values ('gris_ntc', 'GRIS NTC padrão', 0.30)
on conflict (code) do nothing;

commit;
