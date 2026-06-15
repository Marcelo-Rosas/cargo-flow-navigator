-- Garante no máximo uma linha em company_settings (singleton por tenant).
-- Guard pra preview branches: company_settings e criada por
-- 20260713000000_company_settings.sql (timestamp posterior).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_settings'
  ) THEN
    RAISE NOTICE 'company_settings does not exist yet — skipping singleton column';
    RETURN;
  END IF;

  ALTER TABLE public.company_settings
    ADD COLUMN IF NOT EXISTS singleton boolean NOT NULL DEFAULT true;

  CREATE UNIQUE INDEX IF NOT EXISTS company_settings_singleton_idx
    ON public.company_settings (singleton);
END $$;
