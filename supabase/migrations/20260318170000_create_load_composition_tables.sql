-- Load Composition Engine — Schema
-- Phase 1: Tables for analyzing and suggesting load consolidation

-- 1. Main suggestions table
CREATE TABLE IF NOT EXISTS load_composition_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  shipper_id UUID NOT NULL REFERENCES shippers(id) ON DELETE CASCADE,

  -- Quotes involved (array of quote_ids)
  quote_ids UUID[] NOT NULL,

  -- Analysis & Scoring
  consolidation_score FLOAT NOT NULL DEFAULT 0,
  estimated_savings_brl INTEGER DEFAULT 0, -- in centavos
  distance_increase_percent FLOAT DEFAULT 0,

  -- Validation
  is_feasible BOOLEAN DEFAULT true,
  validation_warnings TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),

  -- Links to created resources
  created_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,

  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_load_comp_shipper ON load_composition_suggestions(shipper_id);
CREATE INDEX idx_load_comp_status ON load_composition_suggestions(status);
CREATE INDEX idx_load_comp_created_at ON load_composition_suggestions(created_at DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_load_composition_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER load_composition_suggestions_updated_at_trigger
BEFORE UPDATE ON load_composition_suggestions
FOR EACH ROW
EXECUTE FUNCTION update_load_composition_updated_at();

-- 2. Route segments (legs)
CREATE TABLE IF NOT EXISTS load_composition_routings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  composition_id UUID NOT NULL REFERENCES load_composition_suggestions(id) ON DELETE CASCADE,

  -- Route info
  route_sequence INTEGER NOT NULL, -- 1, 2, 3... order in the trip
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,

  -- Geography
  leg_distance_km FLOAT,
  leg_duration_min INTEGER,
  leg_polyline TEXT, -- encoded polyline for mapping

  -- Time windows
  pickup_window_start TIME,
  pickup_window_end TIME,
  estimated_arrival TIME,

  -- Validation
  is_feasible BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lc_routing_comp ON load_composition_routings(composition_id);
CREATE INDEX idx_lc_routing_quote ON load_composition_routings(quote_id);

-- 3. Financial metrics
CREATE TABLE IF NOT EXISTS load_composition_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  composition_id UUID NOT NULL REFERENCES load_composition_suggestions(id) ON DELETE CASCADE,

  -- Economic
  original_total_cost INTEGER, -- sum of separate freights (centavos)
  composed_total_cost INTEGER, -- consolidated freight cost (centavos)
  savings_brl INTEGER, -- original - composed
  savings_percent FLOAT, -- (savings / original) * 100

  -- Operational
  original_km_total FLOAT,
  composed_km_total FLOAT,
  km_efficiency_percent FLOAT, -- (original - composed) / original * 100

  -- Environmental (optional)
  co2_reduction_kg FLOAT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lc_metrics_comp ON load_composition_metrics(composition_id);

-- 4. RLS Policies (Row Level Security)
ALTER TABLE load_composition_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_composition_routings ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_composition_metrics ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view suggestions
CREATE POLICY load_comp_view ON load_composition_suggestions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert (via Edge Function)
CREATE POLICY load_comp_insert ON load_composition_suggestions
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow creator/approver to update
CREATE POLICY load_comp_update ON load_composition_suggestions
  FOR UPDATE
  USING (
    auth.uid() = created_by OR
    auth.uid() = approved_by OR
    auth.role() = 'service_role'
  )
  WITH CHECK (
    auth.uid() = created_by OR
    auth.uid() = approved_by OR
    auth.role() = 'service_role'
  );

-- RLS for routings (tied to parent suggestion)
CREATE POLICY lc_routings_view ON load_composition_routings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM load_composition_suggestions s
      WHERE s.id = composition_id
      AND auth.role() = 'authenticated'
    )
  );

CREATE POLICY lc_routings_insert ON load_composition_routings
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- RLS for metrics
CREATE POLICY lc_metrics_view ON load_composition_metrics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM load_composition_suggestions s
      WHERE s.id = composition_id
      AND auth.role() = 'authenticated'
    )
  );

CREATE POLICY lc_metrics_insert ON load_composition_metrics
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 5. View for quick summary
CREATE OR REPLACE VIEW load_composition_summary AS
SELECT
  s.id,
  s.shipper_id,
  s.quote_ids,
  s.consolidation_score,
  s.estimated_savings_brl,
  s.status,
  (SELECT COUNT(*) FROM load_composition_routings WHERE composition_id = s.id) as num_stops,
  s.created_at,
  s.approved_at
FROM load_composition_suggestions s
ORDER BY s.created_at DESC;

-- Grant permissions for authenticated users
GRANT SELECT ON load_composition_summary TO authenticated;
GRANT SELECT ON load_composition_suggestions TO authenticated;
GRANT SELECT ON load_composition_routings TO authenticated;
GRANT SELECT ON load_composition_metrics TO authenticated;


DO $$
BEGIN
  IF to_regclass('public.load_composition_discount_breakdown') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'load_composition_discount_breakdown_composition_id_fkey'
        AND conrelid = 'public.load_composition_discount_breakdown'::regclass
    ) THEN
      ALTER TABLE public.load_composition_discount_breakdown
      ADD CONSTRAINT load_composition_discount_breakdown_composition_id_fkey
      FOREIGN KEY (composition_id)
      REFERENCES public.load_composition_suggestions(id)
      ON DELETE CASCADE;
    END IF;
  END IF;
END
$$;

