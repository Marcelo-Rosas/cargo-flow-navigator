-- Load Composition v2: route-fit evaluation, trigger source, deduplication
-- Adds columns for real route evaluation and multi-trigger support

-- 1. New columns on load_composition_suggestions
ALTER TABLE load_composition_suggestions
  ADD COLUMN IF NOT EXISTS trigger_source text NOT NULL DEFAULT 'batch'
    CHECK (trigger_source IN ('batch', 'on_save', 'manual')),
  ADD COLUMN IF NOT EXISTS anchor_quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS technical_explanation text,
  ADD COLUMN IF NOT EXISTS delta_km_abs numeric(10,2),
  ADD COLUMN IF NOT EXISTS delta_km_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS base_km_total numeric(10,2),
  ADD COLUMN IF NOT EXISTS composed_km_total numeric(10,2),
  ADD COLUMN IF NOT EXISTS route_evaluation_model text DEFAULT 'mock_v1';

COMMENT ON COLUMN load_composition_suggestions.trigger_source IS 'batch | on_save | manual — origin of the analysis';
COMMENT ON COLUMN load_composition_suggestions.anchor_quote_id IS 'The quote that triggered on_save analysis (NULL for batch/manual)';
COMMENT ON COLUMN load_composition_suggestions.technical_explanation IS 'Human-readable explanation of viability for commercial team';
COMMENT ON COLUMN load_composition_suggestions.delta_km_abs IS 'Absolute difference in km between separate and composed routes';
COMMENT ON COLUMN load_composition_suggestions.delta_km_percent IS 'Percentage increase in km for composed vs longest individual route';
COMMENT ON COLUMN load_composition_suggestions.base_km_total IS 'Sum of individual route km (separate trips)';
COMMENT ON COLUMN load_composition_suggestions.composed_km_total IS 'Total km of composed route (single trip with waypoints)';
COMMENT ON COLUMN load_composition_suggestions.route_evaluation_model IS 'mock_v1 | webrouter_v1 — method used for route evaluation';

-- 2. Deduplication: prevent duplicate suggestions for the same set of quotes
-- quote_ids must be sorted before insert to ensure consistent dedup
CREATE UNIQUE INDEX IF NOT EXISTS idx_lcs_dedup_quote_ids
  ON load_composition_suggestions (shipper_id, quote_ids)
  WHERE status NOT IN ('rejected', 'executed');

-- 3. Index for on_save lookups by anchor_quote_id
CREATE INDEX IF NOT EXISTS idx_lcs_anchor_quote
  ON load_composition_suggestions (anchor_quote_id)
  WHERE anchor_quote_id IS NOT NULL;

-- 4. Update the summary view to include new columns
DROP VIEW IF EXISTS load_composition_summary;
CREATE VIEW load_composition_summary AS
SELECT
  s.id,
  s.shipper_id,
  s.quote_ids,
  s.consolidation_score,
  s.estimated_savings_brl,
  s.status,
  s.trigger_source,
  s.technical_explanation,
  s.delta_km_abs,
  s.delta_km_percent,
  s.base_km_total,
  s.composed_km_total,
  s.route_evaluation_model,
  (SELECT COUNT(*) FROM load_composition_routings WHERE composition_id = s.id) as num_stops,
  s.created_at,
  s.approved_at
FROM load_composition_suggestions s
ORDER BY s.created_at DESC;

GRANT SELECT ON load_composition_summary TO authenticated;


