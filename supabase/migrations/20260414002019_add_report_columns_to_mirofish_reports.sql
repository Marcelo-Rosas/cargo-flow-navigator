-- Add report lifecycle columns to mirofish_reports
-- Wrapped in DO block: mirofish_reports only exists in production (created
-- outside migrations), so preview branches skip gracefully.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mirofish_reports'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE mirofish_reports
    ADD COLUMN IF NOT EXISTS period_type text,
    ADD COLUMN IF NOT EXISTS period_start date,
    ADD COLUMN IF NOT EXISTS period_end date,
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed',
    ADD COLUMN IF NOT EXISTS summary text,
    ADD COLUMN IF NOT EXISTS sections jsonb,
    ADD COLUMN IF NOT EXISTS simulation_requirement text,
    ADD COLUMN IF NOT EXISTS agents_count integer,
    ADD COLUMN IF NOT EXISTS completed_at timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS error text;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'mirofish_reports'
      AND indexname = 'idx_mirofish_reports_period_type'
  ) THEN
    CREATE INDEX idx_mirofish_reports_period_type ON mirofish_reports (period_type);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'mirofish_reports'
      AND indexname = 'idx_mirofish_reports_status'
  ) THEN
    CREATE INDEX idx_mirofish_reports_status ON mirofish_reports (status);
  END IF;

  ALTER TABLE mirofish_reports ENABLE ROW LEVEL SECURITY;
END $$;
