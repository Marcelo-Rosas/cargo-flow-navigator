-- Fix: ensure authenticated users can UPDATE vehicles.
-- The 406 PGRST116 error occurs because RLS blocks the update, returning 0 rows.

DO $$
BEGIN
  -- Only act if the vehicles table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vehicles'
  ) THEN
    -- Ensure RLS is enabled
    ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

    -- Drop existing update policy if any (to avoid duplicate)
    DROP POLICY IF EXISTS "Authenticated users can update vehicles" ON public.vehicles;

    -- Create UPDATE policy for authenticated users
    CREATE POLICY "Authenticated users can update vehicles"
      ON public.vehicles
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);

    -- Also ensure INSERT policy exists
    DROP POLICY IF EXISTS "Authenticated users can insert vehicles" ON public.vehicles;
    CREATE POLICY "Authenticated users can insert vehicles"
      ON public.vehicles
      FOR INSERT
      TO authenticated
      WITH CHECK (true);

    -- Also ensure DELETE policy exists
    DROP POLICY IF EXISTS "Authenticated users can delete vehicles" ON public.vehicles;
    CREATE POLICY "Authenticated users can delete vehicles"
      ON public.vehicles
      FOR DELETE
      TO authenticated
      USING (true);

    -- Ensure SELECT policy exists
    DROP POLICY IF EXISTS "Authenticated users can view vehicles" ON public.vehicles;
    CREATE POLICY "Authenticated users can view vehicles"
      ON public.vehicles
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
