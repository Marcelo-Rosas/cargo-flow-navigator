-- =============================================================
-- Migration: Vehicles RLS — acesso total para todos os perfis
-- Perfis: admin, comercial, operacional, financeiro
-- =============================================================

-- Drop policies genéricas existentes
DROP POLICY IF EXISTS "Authenticated users can update vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Authenticated users can insert vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Authenticated users can delete vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Authenticated users can view vehicles"  ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_select" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_insert" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_update" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_delete" ON public.vehicles;

-- Garante RLS habilitado
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- SELECT: todos os perfis autenticados podem visualizar
CREATE POLICY "vehicles_select"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: todos os 4 perfis
CREATE POLICY "vehicles_insert"
  ON public.vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_profile(ARRAY['admin','comercial','operacional','financeiro']::public.user_profile[])
  );

-- UPDATE: todos os 4 perfis
CREATE POLICY "vehicles_update"
  ON public.vehicles FOR UPDATE
  TO authenticated
  USING (
    public.has_profile(ARRAY['admin','comercial','operacional','financeiro']::public.user_profile[])
  )
  WITH CHECK (
    public.has_profile(ARRAY['admin','comercial','operacional','financeiro']::public.user_profile[])
  );

-- DELETE: todos os 4 perfis
CREATE POLICY "vehicles_delete"
  ON public.vehicles FOR DELETE
  TO authenticated
  USING (
    public.has_profile(ARRAY['admin','comercial','operacional','financeiro']::public.user_profile[])
  );
