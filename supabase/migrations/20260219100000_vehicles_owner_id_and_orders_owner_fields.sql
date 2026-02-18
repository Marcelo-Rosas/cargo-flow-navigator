-- Add owner_id to vehicles (FK to owners)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.owners(id);

-- Optional: snapshot of owner on order (like driver_name/driver_phone)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone TEXT;

CREATE INDEX IF NOT EXISTS idx_vehicles_owner_id ON public.vehicles(owner_id);
