-- Migration aplicada via Supabase dashboard em 2026-04-11 e nunca commitada ao repo.
-- Causa: migration drift que quebrava o CI (Remote migration versions not found).
-- Recuperada via supabase_migrations.schema_migrations e commitada para restaurar sync.

CREATE POLICY "anon_read_petrobras_diesel_prices"
  ON petrobras_diesel_prices
  FOR SELECT
  TO anon
  USING (true);
