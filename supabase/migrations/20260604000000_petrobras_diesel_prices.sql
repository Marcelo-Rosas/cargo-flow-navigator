-- Petrobras diesel prices (scraped daily from precos.petrobras.com.br)
-- Note: 20260409235959 creates this table earlier in the sequence for migrations
-- that reference it in April. All DDL here is idempotent.
CREATE TABLE IF NOT EXISTS petrobras_diesel_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uf text NOT NULL,                          -- 'BR', 'SP', 'RJ', etc.
  preco_medio numeric(6,3) NOT NULL,         -- R$/L
  parcela_petrobras numeric(6,3),
  parcela_impostos_federais numeric(6,3),
  parcela_icms numeric(6,3),
  parcela_biodiesel numeric(6,3),
  parcela_distribuicao numeric(6,3),
  periodo_coleta text,                       -- "08/03/2026 a 14/03/2026"
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(uf, periodo_coleta)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_petrobras_diesel_uf_fetched ON petrobras_diesel_prices (uf, fetched_at DESC);

-- RLS
ALTER TABLE petrobras_diesel_prices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'petrobras_diesel_prices' AND policyname = 'authenticated_read'
  ) THEN
    CREATE POLICY "authenticated_read" ON petrobras_diesel_prices
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Service role can insert/update (Edge Function)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'petrobras_diesel_prices' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON petrobras_diesel_prices
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
