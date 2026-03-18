-- Reports — Métricas por rota (UF origem -> UF destino)
-- Fonte: public.orders_rs_per_km (OS reais com km_distance e carreteiro_real)
--
-- Chave de rota:
-- - origin_uf e destination_uf são extraídos de orders.origin/destination via regex "- UF"
-- - route_key = origin_uf || '->' || destination_uf
--
-- Entregáveis:
-- 1) Tabela CRUD: public.route_metrics_config (metas/limites por rota)
-- 2) RPC: public.get_route_metrics(p_from, p_to, p_vehicle_type_id) retornando agregados (avg, p50, p90, avg_km, avg_paid, count)

create table if not exists public.route_metrics_config (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  origin_uf text not null check (origin_uf ~ '^[A-Z]{2}$'),
  destination_uf text not null check (destination_uf ~ '^[A-Z]{2}$'),
  vehicle_type_id uuid null references public.vehicle_types(id) on delete set null,

  is_active boolean not null default true,
  target_rs_per_km numeric null,
  min_rs_per_km numeric null,
  max_rs_per_km numeric null,
  notes text null,

  constraint route_metrics_config_unique unique (origin_uf, destination_uf, vehicle_type_id)
);

create index if not exists route_metrics_config_route_idx
  on public.route_metrics_config (origin_uf, destination_uf);

create index if not exists route_metrics_config_vehicle_type_idx
  on public.route_metrics_config (vehicle_type_id);

-- keep updated_at fresh
drop trigger if exists trg_route_metrics_config_updated_at on public.route_metrics_config;
create trigger trg_route_metrics_config_updated_at
before update on public.route_metrics_config
for each row execute function public.update_updated_at_column();

-- RPC: métricas agregadas por UF origem/destino
create or replace function public.get_route_metrics(
  p_from timestamptz,
  p_to timestamptz,
  p_vehicle_type_id uuid default null
)
returns table (
  route_key text,
  origin_uf text,
  destination_uf text,
  vehicle_type_id uuid,
  vehicle_type_name text,
  orders_count integer,
  avg_rs_per_km numeric,
  p50_rs_per_km numeric,
  p90_rs_per_km numeric,
  avg_km numeric,
  avg_paid numeric
)
language sql
stable
as $$
  with base as (
    select
      -- extração de UF robusta (ex.: "... - SC, 88371-880")
      (regexp_match(o.origin, '-\\s*([A-Z]{2})'))[1] as origin_uf,
      (regexp_match(o.destination, '-\\s*([A-Z]{2})'))[1] as destination_uf,
      o.vehicle_type_id,
      o.vehicle_type_name,
      o.km_distance,
      o.carreteiro_real,
      o.rs_per_km,
      o.order_date
    from public.orders_rs_per_km o
    where o.order_date >= p_from
      and o.order_date <= p_to
      and (p_vehicle_type_id is null or o.vehicle_type_id = p_vehicle_type_id)
  )
  select
    (b.origin_uf || '->' || b.destination_uf) as route_key,
    b.origin_uf,
    b.destination_uf,
    b.vehicle_type_id,
    max(b.vehicle_type_name) as vehicle_type_name,
    count(*)::int as orders_count,
    avg(b.rs_per_km)::numeric as avg_rs_per_km,
    percentile_cont(0.5) within group (order by b.rs_per_km) as p50_rs_per_km,
    percentile_cont(0.9) within group (order by b.rs_per_km) as p90_rs_per_km,
    avg(b.km_distance)::numeric as avg_km,
    avg(b.carreteiro_real)::numeric as avg_paid
  from base b
  where b.origin_uf is not null and b.destination_uf is not null
  group by b.origin_uf, b.destination_uf, b.vehicle_type_id
  order by avg_rs_per_km desc nulls last;
$$;

-- RLS
alter table public.route_metrics_config enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'route_metrics_config'
      and policyname = 'route_metrics_config_select_authenticated'
  ) then
    create policy route_metrics_config_select_authenticated
      on public.route_metrics_config
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'route_metrics_config'
      and policyname = 'route_metrics_config_write_authenticated'
  ) then
    create policy route_metrics_config_write_authenticated
      on public.route_metrics_config
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end
$$;

