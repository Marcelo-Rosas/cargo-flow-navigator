-- =============================================================
-- Migration 0094: Consolidate RLS policies for core tables
-- Date: 2026-03-22
-- Tables: quotes, orders, drivers, vehicles
--
-- Purpose:
--   Consolidate scattered RLS policies into a single source of truth.
--   Ensures consistent role-based access using has_profile() helper
--   with the user_profile enum: admin, operacional, financeiro.
--
-- Access Matrix:
--   ┌──────────┬────────┬─────────────┬────────────┐
--   │ Table    │ SELECT │ INSERT/UPD  │ DELETE     │
--   ├──────────┼────────┼─────────────┼────────────┤
--   │ quotes   │ all    │ all 3       │ admin only │
--   │ orders   │ all    │ all 3       │ admin only │
--   │ drivers  │ all    │ admin+oper  │ admin only │
--   │ vehicles │ all    │ admin+oper  │ admin only │
--   └──────────┴────────┴─────────────┴────────────┘
--
-- Notes:
--   - "all 3" = admin, operacional, financeiro
--   - "admin+oper" = admin, operacional (frota é domínio operacional)
--   - financeiro não precisa inserir/editar motoristas ou veículos
-- =============================================================

SET statement_timeout = '60s';

-- =============================================================
-- 1. QUOTES
-- =============================================================
-- Drop all existing policies (from various migrations)
DROP POLICY IF EXISTS "quotes_select" ON public.quotes;
DROP POLICY IF EXISTS "quotes_insert" ON public.quotes;
DROP POLICY IF EXISTS "quotes_update" ON public.quotes;
DROP POLICY IF EXISTS "quotes_delete" ON public.quotes;
DROP POLICY IF EXISTS "Full access quotes" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated users can view quotes" ON public.quotes;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_select" ON public.quotes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "quotes_insert" ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[])
  );

CREATE POLICY "quotes_update" ON public.quotes
  FOR UPDATE TO authenticated
  USING (
    public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[])
  )
  WITH CHECK (
    public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[])
  );

CREATE POLICY "quotes_delete" ON public.quotes
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- =============================================================
-- 2. ORDERS
-- =============================================================
DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;
DROP POLICY IF EXISTS "orders_delete" ON public.orders;
DROP POLICY IF EXISTS "Full access orders" ON public.orders;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select" ON public.orders
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "orders_insert" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[])
  );

CREATE POLICY "orders_update" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[])
  )
  WITH CHECK (
    public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[])
  );

CREATE POLICY "orders_delete" ON public.orders
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- =============================================================
-- 3. DRIVERS
-- =============================================================
DROP POLICY IF EXISTS "drivers_select" ON public.drivers;
DROP POLICY IF EXISTS "drivers_insert" ON public.drivers;
DROP POLICY IF EXISTS "drivers_update" ON public.drivers;
DROP POLICY IF EXISTS "drivers_delete" ON public.drivers;
DROP POLICY IF EXISTS "Comercial and Admin can create drivers" ON public.drivers;

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drivers_select" ON public.drivers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "drivers_insert" ON public.drivers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_profile(ARRAY['admin','operacional']::public.user_profile[])
  );

CREATE POLICY "drivers_update" ON public.drivers
  FOR UPDATE TO authenticated
  USING (
    public.has_profile(ARRAY['admin','operacional']::public.user_profile[])
  )
  WITH CHECK (
    public.has_profile(ARRAY['admin','operacional']::public.user_profile[])
  );

CREATE POLICY "drivers_delete" ON public.drivers
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- =============================================================
-- 4. VEHICLES
-- =============================================================
DROP POLICY IF EXISTS "vehicles_select" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_insert" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_update" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_delete" ON public.vehicles;
DROP POLICY IF EXISTS "Authenticated users can view vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Authenticated users can insert vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Authenticated users can update vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Authenticated users can delete vehicles" ON public.vehicles;

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "vehicles_insert" ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_profile(ARRAY['admin','operacional']::public.user_profile[])
  );

CREATE POLICY "vehicles_update" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (
    public.has_profile(ARRAY['admin','operacional']::public.user_profile[])
  )
  WITH CHECK (
    public.has_profile(ARRAY['admin','operacional']::public.user_profile[])
  );

CREATE POLICY "vehicles_delete" ON public.vehicles
  FOR DELETE TO authenticated
  USING (public.is_admin());
