-- =============================================================
-- Migration: Fix drivers RLS policies
-- Date: 2026-02-26
-- Purpose:
--   Replace legacy "Comercial and Admin can create drivers" policy
--   (which uses has_any_role with non-existent 'comercial' profile)
--   with proper has_profile-based policies using current user_profile enum:
--   admin, operacional, financeiro
-- =============================================================

-- ─────────────────────────────────────────────────────
-- 1. Drop legacy policies on drivers
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Comercial and Admin can create drivers" ON public.drivers;
DROP POLICY IF EXISTS "drivers_select" ON public.drivers;
DROP POLICY IF EXISTS "drivers_insert" ON public.drivers;
DROP POLICY IF EXISTS "drivers_update" ON public.drivers;
DROP POLICY IF EXISTS "drivers_delete" ON public.drivers;

-- ─────────────────────────────────────────────────────
-- 2. Enable RLS (idempotent)
-- ─────────────────────────────────────────────────────
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────
-- 3. Recreate proper role-based policies
-- ─────────────────────────────────────────────────────

-- All authenticated users can read drivers
CREATE POLICY "drivers_select" ON public.drivers
  FOR SELECT TO authenticated
  USING (true);

-- Admin, Operacional, Financeiro can insert drivers
CREATE POLICY "drivers_insert" ON public.drivers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

-- Admin, Operacional, Financeiro can update drivers
CREATE POLICY "drivers_update" ON public.drivers
  FOR UPDATE TO authenticated
  USING (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]))
  WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

-- Only Admin can delete drivers
CREATE POLICY "drivers_delete" ON public.drivers
  FOR DELETE TO authenticated
  USING (public.is_admin());
