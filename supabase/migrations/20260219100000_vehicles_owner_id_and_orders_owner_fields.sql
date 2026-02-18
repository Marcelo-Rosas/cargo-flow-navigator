-- Add owner_id to vehicles (FK to owners) and owner snapshot to orders.
-- Run only if tables exist so db push does not fail on remotes that lack vehicles/orders.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'owners'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vehicles'
  ) THEN
    ALTER TABLE public.vehicles
      ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.owners(id);
    CREATE INDEX IF NOT EXISTS idx_vehicles_owner_id ON public.vehicles(owner_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orders'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS owner_name TEXT,
      ADD COLUMN IF NOT EXISTS owner_phone TEXT;
  END IF;
END $$;
