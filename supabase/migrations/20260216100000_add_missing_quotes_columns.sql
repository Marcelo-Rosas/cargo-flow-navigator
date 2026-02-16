-- Add columns to quotes that may be missing (fixes PGRST204 ColumnNotFound)
-- Must run AFTER create_shippers (shipper_id FK)
-- Also forces PostgREST schema cache reload

BEGIN;

-- Shipper-related (shipper_id matches shippers.id type: bigint or uuid)
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS shipper_id bigint REFERENCES public.shippers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipper_name text,
  ADD COLUMN IF NOT EXISTS shipper_email text;

-- CEP and freight type (if not already added elsewhere)
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS origin_cep text,
  ADD COLUMN IF NOT EXISTS destination_cep text,
  ADD COLUMN IF NOT EXISTS freight_type text;

COMMIT;

-- Reload PostgREST schema cache so it picks up new columns
NOTIFY pgrst, 'reload schema';
