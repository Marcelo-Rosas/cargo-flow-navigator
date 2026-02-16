-- =====================================================
-- Migrate shippers.id from bigint to UUID
-- Preserves data and updates quotes.shipper_id FK
-- No-op if shippers.id is already UUID
-- =====================================================

DO $$
DECLARE
  _id_type text;
BEGIN
  SELECT data_type INTO _id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'shippers' AND column_name = 'id';

  IF _id_type = 'uuid' THEN
    RAISE NOTICE 'shippers.id already UUID, skipping migration';
    RETURN;
  END IF;

  IF _id_type != 'bigint' AND _id_type IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected shippers.id type: %. Expected bigint.', _id_type;
  END IF;

  -- 1. Add new UUID column
  ALTER TABLE public.shippers ADD COLUMN IF NOT EXISTS id_uuid uuid;

  -- 2. Generate UUIDs for existing rows
  UPDATE public.shippers SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;
  ALTER TABLE public.shippers ALTER COLUMN id_uuid SET NOT NULL;

  -- 3. Add unique constraint
  ALTER TABLE public.shippers DROP CONSTRAINT IF EXISTS shippers_id_uuid_unique;
  ALTER TABLE public.shippers ADD CONSTRAINT shippers_id_uuid_unique UNIQUE (id_uuid);

  -- 4. Add temp column to quotes (if quotes has shipper_id bigint)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'shipper_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS shipper_id_uuid uuid;
    UPDATE public.quotes q
    SET shipper_id_uuid = s.id_uuid
    FROM public.shippers s
    WHERE q.shipper_id = s.id;
    ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_shipper_id_fkey;
    ALTER TABLE public.quotes DROP COLUMN IF EXISTS shipper_id;
    ALTER TABLE public.quotes RENAME COLUMN shipper_id_uuid TO shipper_id;
  END IF;

  -- 5. Restructure shippers
  ALTER TABLE public.shippers DROP CONSTRAINT IF EXISTS shippers_pkey;
  ALTER TABLE public.shippers DROP COLUMN IF EXISTS id;
  ALTER TABLE public.shippers RENAME COLUMN id_uuid TO id;
  ALTER TABLE public.shippers ADD PRIMARY KEY (id);
  ALTER TABLE public.shippers DROP CONSTRAINT IF EXISTS shippers_id_uuid_unique;
  ALTER TABLE public.shippers ALTER COLUMN id SET DEFAULT gen_random_uuid();

  -- 6. Add FK (only if quotes has shipper_id from step 4)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'shipper_id'
  ) THEN
    ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_shipper_id_fkey;
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_shipper_id_fkey
      FOREIGN KEY (shipper_id) REFERENCES public.shippers(id) ON DELETE SET NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
