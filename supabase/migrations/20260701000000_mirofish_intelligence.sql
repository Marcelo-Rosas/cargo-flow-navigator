-- MiroFish Intelligence Integration
-- Stores market intelligence synced from MiroFish simulation reports
-- for use in commercial pipeline, Kanban badges, and Navi follow-ups.

-- ============================================================
-- Core: synced report metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS mirofish_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mirofish_report_id  TEXT UNIQUE NOT NULL,
  simulation_id       TEXT NOT NULL,
  title               TEXT,
  generated_at        TIMESTAMPTZ,
  synced_at           TIMESTAMPTZ DEFAULT now(),
  raw_insights        JSONB,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Route performance (denormalized for fast queries)
-- ============================================================
CREATE TABLE IF NOT EXISTS mirofish_route_insights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     UUID NOT NULL REFERENCES mirofish_reports(id) ON DELETE CASCADE,
  route         TEXT NOT NULL,
  avg_ticket    NUMERIC,
  volume_ctes   INTEGER,
  revenue       NUMERIC,
  avg_weight_kg NUMERIC,
  ntc_impact    NUMERIC,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mirofish_route_insights_route ON mirofish_route_insights(route);

-- ============================================================
-- Shipper profiles (enriches existing `shippers` table)
-- ============================================================
CREATE TABLE IF NOT EXISTS mirofish_shipper_insights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     UUID NOT NULL REFERENCES mirofish_reports(id) ON DELETE CASCADE,
  shipper_name  TEXT NOT NULL,
  shipper_id    UUID REFERENCES shippers(id),  -- optional link to CFN shipper
  ctes          INTEGER,
  revenue       NUMERIC,
  avg_ticket    NUMERIC,
  routes_count  INTEGER,
  churn_risk    TEXT CHECK (churn_risk IN ('low', 'medium', 'high')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Strategic recommendations
-- ============================================================
CREATE TABLE IF NOT EXISTS mirofish_recommendations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id      UUID NOT NULL REFERENCES mirofish_reports(id) ON DELETE CASCADE,
  action         TEXT NOT NULL,
  priority       TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  target_routes  TEXT[],
  status         TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'dismissed')),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mirofish_recommendations_priority ON mirofish_recommendations(priority, status);

-- ============================================================
-- Logistics traffic rules (viability & restrictions per city)
-- Populated via NotebookLM/Claude enrichment on quote creation
-- ============================================================
CREATE TABLE IF NOT EXISTS logistics_traffic_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city             TEXT NOT NULL,
  state            CHAR(2) NOT NULL,
  organ_name       TEXT NOT NULL,  -- e.g. "AMC", "CET-SP"
  full_name        TEXT,           -- e.g. "Autarquia Municipal de Trânsito"
  restriction_type TEXT,           -- e.g. "ZMRC", "Rodízio", "Horário"
  rules_summary    TEXT,           -- human-readable summary
  permit_info      TEXT,           -- how to get authorization
  source           TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai', 'notebooklm')),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (city, state, organ_name)
);

CREATE INDEX IF NOT EXISTS idx_logistics_traffic_rules_city_state ON logistics_traffic_rules(city, state);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE mirofish_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirofish_route_insights  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirofish_shipper_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirofish_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_traffic_rules  ENABLE ROW LEVEL SECURITY;

-- Read access for admin and comercial roles (idempotent: skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mirofish_reports'
      AND policyname = 'mirofish_reports_read'
  ) THEN
    CREATE POLICY "mirofish_reports_read" ON mirofish_reports
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'comercial')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mirofish_route_insights'
      AND policyname = 'mirofish_route_insights_read'
  ) THEN
    CREATE POLICY "mirofish_route_insights_read" ON mirofish_route_insights
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'comercial')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mirofish_shipper_insights'
      AND policyname = 'mirofish_shipper_insights_read'
  ) THEN
    CREATE POLICY "mirofish_shipper_insights_read" ON mirofish_shipper_insights
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'comercial')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mirofish_recommendations'
      AND policyname = 'mirofish_recommendations_read'
  ) THEN
    CREATE POLICY "mirofish_recommendations_read" ON mirofish_recommendations
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'comercial')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'logistics_traffic_rules'
      AND policyname = 'logistics_traffic_rules_read'
  ) THEN
    CREATE POLICY "logistics_traffic_rules_read" ON logistics_traffic_rules
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('admin', 'comercial', 'operacao')
        )
      );
  END IF;
END $$;

-- Write access only via service role (edge functions)
-- No INSERT/UPDATE/DELETE policies needed — service role bypasses RLS
