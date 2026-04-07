-- Migration: Create load_composition_discount_breakdown table
-- Purpose: Track discount proposals per shipper in consolidated loads
-- Respects margin rules while maximizing competitiveness

CREATE TABLE IF NOT EXISTS load_composition_discount_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  composition_id UUID NOT NULL,

  -- Quote & Shipper
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  shipper_id UUID NOT NULL REFERENCES shippers(id) ON DELETE CASCADE,

  -- Financial Metrics
  original_quote_price_brl INTEGER NOT NULL, -- centavos
  original_freight_cost_brl INTEGER NOT NULL, -- custo real do frete
  original_margin_brl INTEGER NOT NULL, -- price - cost
  original_margin_percent FLOAT NOT NULL,

  -- Discount Calculation
  max_discount_allowed_brl INTEGER NOT NULL, -- máximo sem violar margem mínima
  discount_offered_brl INTEGER NOT NULL DEFAULT 0, -- desconto real oferecido
  discount_percent FLOAT NOT NULL DEFAULT 0,

  -- Final Numbers
  final_quote_price_brl INTEGER NOT NULL, -- price - discount
  final_margin_brl INTEGER NOT NULL, -- final_price - cost
  final_margin_percent FLOAT NOT NULL,

  -- Rules Applied
  margin_rule_source TEXT, -- 'global' | 'customer' | 'pricing_table'
  minimum_margin_percent_applied FLOAT NOT NULL,
  discount_strategy TEXT, -- 'equal_share' | 'proportional_to_original' | 'weighted_by_weight'

  -- Status
  is_feasible BOOLEAN DEFAULT TRUE,
  validation_warnings TEXT[] DEFAULT '{}',

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX idx_discount_composition ON load_composition_discount_breakdown(composition_id);
CREATE INDEX idx_discount_quote ON load_composition_discount_breakdown(quote_id);
CREATE INDEX idx_discount_shipper ON load_composition_discount_breakdown(shipper_id);

-- RLS Policy
ALTER TABLE load_composition_discount_breakdown ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_discounts" ON load_composition_discount_breakdown
  FOR SELECT USING (
    auth.uid() = created_by OR
    auth.uid() IN (
      SELECT user_id
      FROM profiles
      WHERE perfil IN ('admin', 'financeiro')
    )
  );

CREATE POLICY "insert_own_discounts" ON load_composition_discount_breakdown
  FOR INSERT WITH CHECK (
    auth.uid() = created_by OR
    auth.uid() IN (
      SELECT user_id
      FROM profiles
      WHERE perfil IN ('admin', 'financeiro')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_discount_breakdown_timestamp
  BEFORE UPDATE ON load_composition_discount_breakdown
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- View: Summary of discounts per composition
CREATE OR REPLACE VIEW load_composition_discount_summary AS
SELECT
  composition_id,
  COUNT(*) as shipper_count,
  SUM(original_quote_price_brl) as total_original_price,
  SUM(discount_offered_brl) as total_discount_offered,
  SUM(final_quote_price_brl) as total_final_price,
  AVG(final_margin_percent) as avg_final_margin_percent,
  MIN(final_margin_percent) as min_final_margin_percent,
  ARRAY_AGG(DISTINCT margin_rule_source) as margin_rules_applied
FROM load_composition_discount_breakdown
GROUP BY composition_id;

-- Comment for documentation
COMMENT ON TABLE load_composition_discount_breakdown IS
  'Stores calculated discount proposals for each quote in a load composition.
   Respects minimum margin rules while maximizing competitiveness.
   Can be used to generate discount notifications to shippers.';

COMMENT ON COLUMN load_composition_discount_breakdown.discount_strategy IS
  'Strategy used to allocate discount:
   - equal_share: divide economy equally
   - proportional_to_original: higher original price = higher discount
   - weighted_by_weight: higher weight = higher discount';

DO $$
BEGIN
  IF to_regclass('public.load_composition_suggestions') IS NOT NULL THEN
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


