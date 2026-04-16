-- Add report lifecycle columns to mirofish_reports
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

CREATE INDEX IF NOT EXISTS idx_mirofish_reports_period_type ON mirofish_reports (period_type);
CREATE INDEX IF NOT EXISTS idx_mirofish_reports_status ON mirofish_reports (status);

ALTER TABLE mirofish_reports ENABLE ROW LEVEL SECURITY;
