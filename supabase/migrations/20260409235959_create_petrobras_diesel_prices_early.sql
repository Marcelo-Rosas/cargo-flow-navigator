-- Cria petrobras_diesel_prices antes das migrations 20260410000000/000100 que já
-- referenciam a tabela. A migration original (20260604000000) usa CREATE TABLE IF NOT EXISTS,
-- portanto é no-op quando a tabela já existe.
-- O campo source é incluído aqui pois 20260410000100 faz ADD COLUMN IF NOT EXISTS source.

CREATE TABLE IF NOT EXISTS petrobras_diesel_prices (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uf                          text NOT NULL,
  preco_medio                 numeric(6,3) NOT NULL,
  parcela_petrobras           numeric(6,3),
  parcela_impostos_federais   numeric(6,3),
  parcela_icms                numeric(6,3),
  parcela_biodiesel           numeric(6,3),
  parcela_distribuicao        numeric(6,3),
  periodo_coleta              text,
  fetched_at                  timestamptz NOT NULL DEFAULT now(),
  source                      text NOT NULL DEFAULT 'api',
  UNIQUE(uf, periodo_coleta)
);

CREATE INDEX IF NOT EXISTS idx_petrobras_diesel_uf_fetched
  ON petrobras_diesel_prices (uf, fetched_at DESC);

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

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'petrobras_diesel_prices' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON petrobras_diesel_prices
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
