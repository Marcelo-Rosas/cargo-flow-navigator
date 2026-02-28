-- Create drivers and vehicles tables if they don't exist.
-- Required by fix_drivers_rls_policies, trips, and vehicles migrations.
-- These tables may exist in remote/linked projects but are missing in fresh local installs.

-- drivers (no dependencies)
create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  cnh text,
  cnh_category text,
  antt text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- vehicles (depends on drivers, owners, vehicle_types - all exist before this migration)
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null,
  plate_2 text,
  plate_mask text,
  plate_2_mask text,
  brand text,
  model text,
  color text,
  year integer,
  renavam text,
  driver_id uuid references public.drivers(id),
  owner_id uuid references public.owners(id),
  vehicle_type_id uuid references public.vehicle_types(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vehicles_plate on public.vehicles(plate);
create index if not exists idx_vehicles_driver_id on public.vehicles(driver_id);
create index if not exists idx_vehicles_owner_id on public.vehicles(owner_id);
