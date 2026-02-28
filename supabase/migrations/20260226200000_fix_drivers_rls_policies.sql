-- =============================================================
-- Migration: Fix drivers RLS policies
-- Date: 2026-02-26
-- Purpose:
--   Replace legacy "Comercial and Admin can create drivers" policy
--   (which uses has_any_role with non-existent 'comercial' profile)
--   with proper has_profile-based policies using current user_profile enum:
--   admin, operacional, financeiro
-- Note: Run only if public.drivers exists (table may be created later by trips migration)
-- =============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'drivers'
  ) THEN
    -- 1. Drop legacy policies
    DROP POLICY IF EXISTS "Comercial and Admin can create drivers" ON public.drivers;
    DROP POLICY IF EXISTS "drivers_select" ON public.drivers;
    DROP POLICY IF EXISTS "drivers_insert" ON public.drivers;
    DROP POLICY IF EXISTS "drivers_update" ON public.drivers;
    DROP POLICY IF EXISTS "drivers_delete" ON public.drivers;

    -- 2. Enable RLS
    ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

    -- 3. Recreate proper role-based policies
    CREATE POLICY "drivers_select" ON public.drivers
      FOR SELECT TO authenticated
      USING (true);

    CREATE POLICY "drivers_insert" ON public.drivers
      FOR INSERT TO authenticated
      WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

    CREATE POLICY "drivers_update" ON public.drivers
      FOR UPDATE TO authenticated
      USING (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]))
      WITH CHECK (public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[]));

    CREATE POLICY "drivers_delete" ON public.drivers
      FOR DELETE TO authenticated
      USING (public.is_admin());
  END IF;
END $$;
