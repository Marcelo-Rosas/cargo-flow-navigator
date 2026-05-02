-- Tabela de alertas de cotações abaixo do Piso ANTT.
-- Usada para rastrear violações legado (stages avançados) sem alterar quote.value.

CREATE TABLE IF NOT EXISTS antt_violation_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id        uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  current_value   numeric NOT NULL,
  piso            numeric NOT NULL,
  gap             numeric GENERATED ALWAYS AS (piso - current_value) STORED,
  stage           text NOT NULL,
  detected_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES auth.users(id),
  resolution_note text
);

CREATE INDEX IF NOT EXISTS antt_violation_alerts_quote_id_idx ON antt_violation_alerts(quote_id);
CREATE INDEX IF NOT EXISTS antt_violation_alerts_resolved_at_idx ON antt_violation_alerts(resolved_at) WHERE resolved_at IS NULL;

ALTER TABLE antt_violation_alerts ENABLE ROW LEVEL SECURITY;

-- Leitura: apenas autenticados
CREATE POLICY "antt_alerts_select" ON antt_violation_alerts
  FOR SELECT TO authenticated USING (true);

-- Insert/Update: apenas service_role (via migrations e Edge Functions)
CREATE POLICY "antt_alerts_insert" ON antt_violation_alerts
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "antt_alerts_update" ON antt_violation_alerts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
