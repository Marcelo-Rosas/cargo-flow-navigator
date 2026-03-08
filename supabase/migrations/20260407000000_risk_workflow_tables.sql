-- Risk Workflow tables for Plan 04
-- Creates: risk_policies, risk_policy_rules, risk_services_catalog,
--          risk_evaluations, risk_evidence, risk_costs
-- Alters:  orders (add cargo_value, risk_evaluation_id)
-- Views:   vw_order_risk_status, vw_trip_risk_summary

-- ============================================================
-- 1. ENUM TYPES
-- ============================================================

CREATE TYPE risk_criticality AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE risk_evaluation_status AS ENUM ('pending', 'evaluated', 'approved', 'rejected', 'expired');

-- ============================================================
-- 2. TABLES
-- ============================================================

-- 2.1 risk_policies
CREATE TABLE risk_policies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  policy_type   TEXT NOT NULL,
  insurer       TEXT,
  endorsement   TEXT,
  risk_manager  TEXT,
  valid_from    DATE NOT NULL,
  valid_until   DATE,
  coverage_limit NUMERIC(15,2),
  deductible    NUMERIC(15,2),
  metadata      JSONB DEFAULT '{}',
  document_url  TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  created_by    UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE risk_policies IS 'Apolices de seguro e suas regras-mestre';

-- 2.2 risk_policy_rules
CREATE TABLE risk_policy_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id     UUID NOT NULL REFERENCES risk_policies(id) ON DELETE CASCADE,
  trigger_type  TEXT NOT NULL,
  trigger_config JSONB NOT NULL,
  criticality   risk_criticality NOT NULL,
  criticality_boost INT DEFAULT 0,
  requirements  JSONB NOT NULL DEFAULT '[]',
  description   TEXT,
  sort_order    INT DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_risk_policy_rules_policy ON risk_policy_rules(policy_id);
CREATE INDEX idx_risk_policy_rules_trigger ON risk_policy_rules(trigger_type);

COMMENT ON TABLE risk_policy_rules IS 'Regras de criticidade vinculadas a uma apolice';

-- 2.3 risk_services_catalog
CREATE TABLE risk_services_catalog (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  provider      TEXT NOT NULL,
  unit_cost     NUMERIC(10,2) NOT NULL,
  cost_type     TEXT NOT NULL DEFAULT 'fixed',
  scope         TEXT NOT NULL DEFAULT 'per_trip',
  required_when TEXT,
  validity_days INT,
  metadata      JSONB DEFAULT '{}',
  is_active     BOOLEAN DEFAULT true,
  valid_from    DATE DEFAULT CURRENT_DATE,
  valid_until   DATE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE risk_services_catalog IS 'Catalogo de servicos de gerenciamento de risco com custos';

-- 2.4 risk_evaluations
CREATE TABLE risk_evaluations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       TEXT NOT NULL,
  entity_id         UUID NOT NULL,
  policy_id         UUID REFERENCES risk_policies(id),
  criticality       risk_criticality NOT NULL DEFAULT 'LOW',
  status            risk_evaluation_status NOT NULL DEFAULT 'pending',
  cargo_value_evaluated NUMERIC(15,2),
  requirements      JSONB NOT NULL DEFAULT '[]',
  requirements_met  JSONB DEFAULT '{}',
  route_municipalities TEXT[],
  policy_rules_applied UUID[],
  evaluation_notes  TEXT,
  evaluated_by      UUID REFERENCES auth.users(id),
  evaluated_at      TIMESTAMPTZ,
  approval_request_id UUID,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_risk_evaluations_entity ON risk_evaluations(entity_type, entity_id);
CREATE INDEX idx_risk_evaluations_status ON risk_evaluations(status);
CREATE UNIQUE INDEX idx_risk_evaluations_active ON risk_evaluations(entity_type, entity_id)
  WHERE status NOT IN ('expired', 'rejected');

COMMENT ON TABLE risk_evaluations IS 'Avaliacao de risco por OS ou trip, com criticidade e exigencias';

-- 2.5 risk_evidence
CREATE TABLE risk_evidence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id   UUID NOT NULL REFERENCES risk_evaluations(id) ON DELETE CASCADE,
  evidence_type   TEXT NOT NULL,
  document_id     UUID REFERENCES documents(id),
  payload         JSONB NOT NULL DEFAULT '{}',
  status          TEXT DEFAULT 'valid',
  expires_at      TIMESTAMPTZ,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_risk_evidence_evaluation ON risk_evidence(evaluation_id);
CREATE INDEX idx_risk_evidence_type ON risk_evidence(evidence_type);

COMMENT ON TABLE risk_evidence IS 'Evidencias vinculadas a uma avaliacao de risco';

-- 2.6 risk_costs
CREATE TABLE risk_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
  trip_id         UUID REFERENCES trips(id),
  service_id      UUID NOT NULL REFERENCES risk_services_catalog(id),
  service_code    TEXT NOT NULL,
  unit_cost       NUMERIC(10,2) NOT NULL,
  quantity        INT DEFAULT 1,
  total_cost      NUMERIC(10,2) NOT NULL,
  scope           TEXT NOT NULL,
  apportioned     BOOLEAN DEFAULT false,
  evaluation_id   UUID REFERENCES risk_evaluations(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_risk_costs_order ON risk_costs(order_id);
CREATE INDEX idx_risk_costs_trip ON risk_costs(trip_id);

COMMENT ON TABLE risk_costs IS 'Custos reais de risco por OS/trip (Buonny, seguro efetivo)';

-- ============================================================
-- 3. ALTER EXISTING TABLES
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cargo_value NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS risk_evaluation_id UUID;

-- ============================================================
-- 4. VIEWS
-- ============================================================

CREATE OR REPLACE VIEW vw_order_risk_status AS
SELECT
  o.id AS order_id,
  o.os_number,
  o.stage,
  o.cargo_value,
  o.trip_id,
  re.id AS evaluation_id,
  re.criticality,
  re.status AS risk_status,
  re.requirements,
  re.requirements_met,
  re.approval_request_id,
  COALESCE(SUM(rc.total_cost), 0) AS total_risk_cost,
  EXISTS (
    SELECT 1 FROM risk_evidence rev
    WHERE rev.evaluation_id = re.id
    AND rev.evidence_type = 'buonny_check'
    AND rev.status = 'valid'
    AND rev.expires_at > now()
  ) AS buonny_valid
FROM orders o
LEFT JOIN risk_evaluations re ON re.entity_type = 'order' AND re.entity_id = o.id
  AND re.status NOT IN ('expired', 'rejected')
LEFT JOIN risk_costs rc ON rc.order_id = o.id
GROUP BY o.id, o.os_number, o.stage, o.cargo_value, o.trip_id,
  re.id, re.criticality, re.status, re.requirements, re.requirements_met, re.approval_request_id;

CREATE OR REPLACE VIEW vw_trip_risk_summary AS
SELECT
  t.id AS trip_id,
  t.trip_number,
  t.status_operational,
  COUNT(DISTINCT o.id) AS order_count,
  SUM(COALESCE(o.cargo_value, 0)) AS total_cargo_value,
  MAX(re.criticality::text) AS max_criticality,
  BOOL_AND(re.status = 'approved') AS all_orders_approved,
  re_trip.status AS trip_risk_status,
  re_trip.criticality AS trip_criticality,
  COALESCE(SUM(rc.total_cost), 0) AS total_risk_cost
FROM trips t
JOIN orders o ON o.trip_id = t.id
LEFT JOIN risk_evaluations re ON re.entity_type = 'order' AND re.entity_id = o.id
  AND re.status NOT IN ('expired', 'rejected')
LEFT JOIN risk_evaluations re_trip ON re_trip.entity_type = 'trip' AND re_trip.entity_id = t.id
  AND re_trip.status NOT IN ('expired', 'rejected')
LEFT JOIN risk_costs rc ON rc.trip_id = t.id
GROUP BY t.id, t.trip_number, t.status_operational, re_trip.status, re_trip.criticality;

-- ============================================================
-- 5. RLS POLICIES
-- ============================================================

ALTER TABLE risk_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_policy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_services_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_costs ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated users
CREATE POLICY "Authenticated users can view risk_policies"
  ON risk_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view risk_policy_rules"
  ON risk_policy_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view risk_services_catalog"
  ON risk_services_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view risk_evaluations"
  ON risk_evaluations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view risk_evidence"
  ON risk_evidence FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view risk_costs"
  ON risk_costs FOR SELECT TO authenticated USING (true);

-- Insert/Update: all authenticated users (operational role check deferred to app layer)
CREATE POLICY "Authenticated users can insert risk_evaluations"
  ON risk_evaluations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update risk_evaluations"
  ON risk_evaluations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert risk_evidence"
  ON risk_evidence FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can insert risk_costs"
  ON risk_costs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update risk_costs"
  ON risk_costs FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- 6. SEED DATA
-- ============================================================

-- 6.1 Default risk policy (Vectra Cargo RC-DC)
INSERT INTO risk_policies (code, name, policy_type, insurer, endorsement, risk_manager, valid_from, coverage_limit)
VALUES (
  'RCDC-1005500008136',
  'RC-DC Apolice 1005500008136',
  'RC-DC',
  'HDI Seguros',
  'END 4011848',
  'Buonny',
  '2026-01-01',
  500000.00
);

-- 6.2 Risk policy rules (cargo_value thresholds)
INSERT INTO risk_policy_rules (policy_id, trigger_type, trigger_config, criticality, requirements, description, sort_order)
SELECT
  p.id,
  vals.trigger_type,
  vals.trigger_config::jsonb,
  vals.criticality::risk_criticality,
  vals.requirements::jsonb,
  vals.description,
  vals.sort_order
FROM risk_policies p
CROSS JOIN (VALUES
  ('cargo_value', '{"min": 0, "max": 50000}', 'LOW', '["buonny_consulta"]', 'Valor ate R$ 50.000', 1),
  ('cargo_value', '{"min": 50001, "max": 150000}', 'MEDIUM', '["buonny_consulta", "buonny_cadastro"]', 'Valor R$ 50.001 - 150.000', 2),
  ('cargo_value', '{"min": 150001, "max": 500000}', 'HIGH', '["buonny_consulta", "buonny_cadastro", "monitoramento", "gr_doc"]', 'Valor R$ 150.001 - 500.000', 3),
  ('cargo_value', '{"min": 500001, "max": null}', 'CRITICAL', '["buonny_consulta", "buonny_cadastro", "monitoramento", "gr_doc", "rota_doc"]', 'Valor acima de R$ 500.000', 4),
  ('km_distance', '{"min": 1000}', 'MEDIUM', '[]', 'Distancia > 1.000 km: +1 nivel', 5)
) AS vals(trigger_type, trigger_config, criticality, requirements, description, sort_order)
WHERE p.code = 'RCDC-1005500008136';

-- Update km_distance rule to be a boost
UPDATE risk_policy_rules
SET criticality_boost = 1
WHERE trigger_type = 'km_distance'
AND policy_id = (SELECT id FROM risk_policies WHERE code = 'RCDC-1005500008136');

-- 6.3 Risk services catalog (Buonny)
INSERT INTO risk_services_catalog (code, name, provider, unit_cost, cost_type, scope, required_when, validity_days)
VALUES
  ('BUONNY_CONSULTA', 'Consulta Profissional Buonny', 'Buonny', 13.76, 'fixed', 'per_trip', 'always', 90),
  ('BUONNY_CADASTRO', 'Cadastro Motorista Buonny', 'Buonny', 42.10, 'fixed', 'per_driver', 'no_cadastro', NULL),
  ('BUONNY_MONITORAMENTO', 'Monitoramento Buonny', 'Buonny', 252.78, 'fixed', 'per_trip', 'high_critical', NULL);

-- 6.4 Approval rule for risk gate
INSERT INTO approval_rules (name, entity_type, trigger_condition, approval_type, approver_role, active)
VALUES (
  'Gate de risco para liberacao de coleta',
  'order',
  '{"stage": "documentacao", "risk_gate": true}'::jsonb,
  'risk_gate',
  'admin',
  true
);
