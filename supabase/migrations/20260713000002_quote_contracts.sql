-- quote_contracts: tracks every contract PDF generated for a quote
-- Supports versioning (re-emission creates a new version) and future signature tracking

CREATE TABLE IF NOT EXISTS quote_contracts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id             uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  version              int  NOT NULL DEFAULT 1,
  pdf_storage_path     text NOT NULL,
  pdf_file_name        text,
  pdf_size_bytes       bigint,
  generated_at         timestamptz NOT NULL DEFAULT now(),
  generated_by         uuid REFERENCES auth.users(id),
  -- Signature tracking (populated when a signature provider is configured)
  signature_status     text NOT NULL DEFAULT 'pending'
    CHECK (signature_status IN ('pending','sent','signed','rejected','expired')),
  signature_provider   text,
  signature_envelope_id text,
  signature_metadata   jsonb NOT NULL DEFAULT '{}',
  signed_at            timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_contracts_quote_id
  ON quote_contracts (quote_id, version DESC);

ALTER TABLE quote_contracts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read contracts for quotes they have access to
DROP POLICY IF EXISTS "quote_contracts_select" ON quote_contracts;
CREATE POLICY "quote_contracts_select" ON quote_contracts
  FOR SELECT TO authenticated USING (true);

-- Only service_role inserts/updates (Edge Function uses service role key)
-- No explicit INSERT/UPDATE policy: service_role bypasses RLS

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_quote_contracts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quote_contracts_updated_at ON quote_contracts;
CREATE TRIGGER quote_contracts_updated_at
  BEFORE UPDATE ON quote_contracts
  FOR EACH ROW EXECUTE FUNCTION update_quote_contracts_updated_at();
