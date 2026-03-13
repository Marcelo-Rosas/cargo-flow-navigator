---
document: Data Model
plan: plan-04-risk-workflow-memoria-calculo-risco-seguro
version: v0.1.0
created_at: 2026-03-07
---

# Data Model — Risk Workflow + Memoria de Calculo

## 1. Novas tabelas

### 1.1 `risk_policies` — Apolices e regras-mestre

```sql
CREATE TABLE risk_policies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,           -- ex: 'RCDC-1005500008136'
  name          TEXT NOT NULL,                  -- 'RC-DC Apolice 1005500008136'
  policy_type   TEXT NOT NULL,                  -- 'RCTR-C' | 'RC-DC' | 'RCF-DC'
  insurer       TEXT,                           -- 'HDI Seguros'
  endorsement   TEXT,                           -- 'END 4011848'
  risk_manager  TEXT,                           -- 'Buonny'
  valid_from    DATE NOT NULL,
  valid_until   DATE,
  coverage_limit NUMERIC(15,2),                 -- limite maximo de cobertura
  deductible    NUMERIC(15,2),                  -- franquia
  metadata      JSONB DEFAULT '{}',             -- dados extras da apolice
  document_url  TEXT,                           -- link para PDF no storage
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  created_by    UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE risk_policies IS 'Apolices de seguro e suas regras-mestre';
```

### 1.2 `risk_policy_rules` — Regras de criticidade por apolice

```sql
CREATE TYPE risk_criticality AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE risk_policy_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id     UUID NOT NULL REFERENCES risk_policies(id) ON DELETE CASCADE,
  trigger_type  TEXT NOT NULL,                  -- 'cargo_value' | 'municipality' | 'km_distance' | 'trip_order_count' | 'cargo_type'
  trigger_config JSONB NOT NULL,               -- { min: 50000, max: 150000 } ou { cities: [...] }
  criticality   risk_criticality NOT NULL,      -- resultado quando trigger match
  criticality_boost INT DEFAULT 0,              -- +N niveis em vez de valor absoluto
  requirements  JSONB NOT NULL DEFAULT '[]',    -- ['buonny_consulta', 'buonny_cadastro', 'monitoramento', 'gr_doc', 'rota_doc']
  description   TEXT,
  sort_order    INT DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_risk_policy_rules_policy ON risk_policy_rules(policy_id);
CREATE INDEX idx_risk_policy_rules_trigger ON risk_policy_rules(trigger_type);

COMMENT ON TABLE risk_policy_rules IS 'Regras de criticidade vinculadas a uma apolice';
```

### 1.3 `risk_services_catalog` — Catalogo de servicos de risco (Buonny etc)

```sql
CREATE TABLE risk_services_catalog (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,           -- 'BUONNY_CONSULTA' | 'BUONNY_CADASTRO' | 'BUONNY_MONITORAMENTO'
  name          TEXT NOT NULL,                  -- 'Consulta Profissional Buonny'
  provider      TEXT NOT NULL,                  -- 'Buonny'
  unit_cost     NUMERIC(10,2) NOT NULL,         -- R$ 13.76
  cost_type     TEXT NOT NULL DEFAULT 'fixed',  -- 'fixed' | 'percentage'
  scope         TEXT NOT NULL DEFAULT 'per_trip', -- 'per_trip' | 'per_order' | 'per_driver'
  required_when TEXT,                           -- 'always' | 'no_cadastro' | 'high_critical'
  validity_days INT,                            -- 90 para consulta
  metadata      JSONB DEFAULT '{}',
  is_active     BOOLEAN DEFAULT true,
  valid_from    DATE DEFAULT CURRENT_DATE,
  valid_until   DATE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE risk_services_catalog IS 'Catalogo de servicos de gerenciamento de risco com custos';
```

### 1.4 `risk_evaluations` — Avaliacao de risco por OS ou trip

```sql
CREATE TYPE risk_evaluation_status AS ENUM ('pending', 'evaluated', 'approved', 'rejected', 'expired');

CREATE TABLE risk_evaluations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       TEXT NOT NULL,              -- 'order' | 'trip'
  entity_id         UUID NOT NULL,              -- orders.id ou trips.id (polymorphic, sem FK)
  policy_id         UUID REFERENCES risk_policies(id),
  criticality       risk_criticality NOT NULL DEFAULT 'LOW',
  status            risk_evaluation_status NOT NULL DEFAULT 'pending',
  cargo_value_evaluated NUMERIC(15,2),          -- valor usado na avaliacao
  requirements      JSONB NOT NULL DEFAULT '[]', -- lista de exigencias determinadas
  requirements_met  JSONB DEFAULT '{}',          -- { buonny_consulta: true, gr_doc: false, ... }
  route_municipalities TEXT[],                   -- cidades da rota (de tollPlazas)
  policy_rules_applied UUID[],                   -- IDs das regras que matcharam
  evaluation_notes  TEXT,
  evaluated_by      UUID REFERENCES auth.users(id),
  evaluated_at      TIMESTAMPTZ,
  approval_request_id UUID,                      -- link para approval_requests.id
  expires_at        TIMESTAMPTZ,                 -- validade da avaliacao
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_risk_evaluations_entity ON risk_evaluations(entity_type, entity_id);
CREATE INDEX idx_risk_evaluations_status ON risk_evaluations(status);
CREATE UNIQUE INDEX idx_risk_evaluations_active ON risk_evaluations(entity_type, entity_id)
  WHERE status NOT IN ('expired', 'rejected');

COMMENT ON TABLE risk_evaluations IS 'Avaliacao de risco por OS ou trip, com criticidade e exigencias';
```

### 1.5 `risk_evidence` — Evidencias da avaliacao

```sql
CREATE TABLE risk_evidence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id   UUID NOT NULL REFERENCES risk_evaluations(id) ON DELETE CASCADE,
  evidence_type   TEXT NOT NULL,                -- 'buonny_check' | 'document' | 'route_analysis' | 'manual_note'
  document_id     UUID REFERENCES documents(id), -- se for documento uploaded
  payload         JSONB NOT NULL DEFAULT '{}',  -- dados estruturados (ex: resposta Buonny)
  status          TEXT DEFAULT 'valid',          -- 'valid' | 'expired' | 'rejected'
  expires_at      TIMESTAMPTZ,                   -- para Buonny: now + 90 days
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_risk_evidence_evaluation ON risk_evidence(evaluation_id);
CREATE INDEX idx_risk_evidence_type ON risk_evidence(evidence_type);

COMMENT ON TABLE risk_evidence IS 'Evidencias vinculadas a uma avaliacao de risco';
```

### 1.6 `risk_costs` — Custos reais de risco por OS

```sql
CREATE TABLE risk_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
  trip_id         UUID REFERENCES trips(id),
  service_id      UUID NOT NULL REFERENCES risk_services_catalog(id),
  service_code    TEXT NOT NULL,                  -- denormalized: 'BUONNY_CONSULTA'
  unit_cost       NUMERIC(10,2) NOT NULL,
  quantity        INT DEFAULT 1,
  total_cost      NUMERIC(10,2) NOT NULL,         -- unit_cost * quantity
  scope           TEXT NOT NULL,                   -- 'per_trip' | 'per_order'
  apportioned     BOOLEAN DEFAULT false,           -- se ja foi rateado entre OS da trip
  evaluation_id   UUID REFERENCES risk_evaluations(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_risk_costs_order ON risk_costs(order_id);
CREATE INDEX idx_risk_costs_trip ON risk_costs(trip_id);

COMMENT ON TABLE risk_costs IS 'Custos reais de risco por OS/trip (Buonny, seguro efetivo)';
```

---

## 2. Views

### 2.1 `vw_trip_risk_summary` — Resumo de risco por trip

```sql
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
```

### 2.2 `vw_order_risk_status` — Status de risco por OS

```sql
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
```

---

## 3. Alteracoes em tabelas existentes

### 3.1 `orders` — novos campos

```sql
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cargo_value NUMERIC(15,2),       -- valor da carga (se nao existir)
  ADD COLUMN IF NOT EXISTS risk_evaluation_id UUID;          -- link para avaliacao ativa
```

> `cargo_value` pode ja existir via quote. Confirmar no schema real.

### 3.2 `approval_rules` — nova regra seed

```sql
INSERT INTO approval_rules (name, entity_type, trigger_condition, approval_type, approver_role, active)
VALUES (
  'Gate de risco para liberacao de coleta',
  'order',
  '{"stage": "documentacao", "risk_gate": true}'::jsonb,
  'risk_gate',
  'admin',
  true
);
```

### 3.3 `validate_transition` RPC — update

Adicionar check antes de permitir `documentacao -> coleta_realizada`:

```sql
-- Pseudocodigo SQL dentro da funcao validate_transition
IF p_target_stage = 'coleta_realizada' THEN
  -- Checar risk gate
  IF EXISTS (
    SELECT 1 FROM risk_evaluations re
    WHERE re.entity_type = 'order'
    AND re.entity_id = p_order_id
    AND re.status = 'approved'
  ) THEN
    -- OK, permitir transicao
  ELSE
    RAISE EXCEPTION 'Avaliacao de risco pendente ou nao aprovada';
  END IF;

  -- Se OS esta em trip, checar trip tambem
  IF v_trip_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM risk_evaluations re
      WHERE re.entity_type = 'trip'
      AND re.entity_id = v_trip_id
      AND re.status = 'approved'
    ) THEN
      RAISE EXCEPTION 'Avaliacao de risco da viagem pendente';
    END IF;
  END IF;
END IF;
```

---

## 4. Payloads de API

### 4.1 Edge `buonny-check` — Request/Response

```typescript
// Request
interface BuonnyCheckRequest {
  driver_cpf: string;
  vehicle_plate: string;
  order_id?: string;      // para vincular ao evidence
  evaluation_id?: string;
}

// Response
interface BuonnyCheckResponse {
  success: boolean;
  status: 'aprovado' | 'reprovado' | 'em_analise' | 'nao_cadastrado' | 'erro';
  consulta_id: string;
  validade: string;         // ISO date (now + 90 days)
  cadastro_existente: boolean;
  monitoramento_ativo: boolean;
  score?: number;           // 0-100 se disponivel
  detalhes: {
    nome_motorista?: string;
    cnh_status?: string;
    veiculo_status?: string;
    alertas?: string[];
  };
  error?: string;
}
```

### 4.2 Edge `evaluate-risk` — Request/Response

```typescript
// Request
interface EvaluateRiskRequest {
  order_id: string;
  trip_id?: string;
  force_reevaluate?: boolean;
}

// Response
interface EvaluateRiskResponse {
  success: boolean;
  evaluation: {
    id: string;
    entity_type: 'order' | 'trip';
    entity_id: string;
    criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    requirements: string[];         // ['buonny_consulta', 'buonny_cadastro', ...]
    requirements_met: Record<string, boolean>;
    cargo_value_evaluated: number;
    route_municipalities: string[];
    policy_rules_applied: string[];  // IDs
    can_auto_approve: boolean;
  };
  trip_evaluation?: {               // se trip_id fornecido
    id: string;
    criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    total_cargo_value: number;
    order_count: number;
    all_orders_approved: boolean;
  };
  estimated_costs: {
    buonny_consulta: number;
    buonny_cadastro: number | null;
    buonny_monitoramento: number | null;
    total: number;
  };
}
```

### 4.3 StoredPricingBreakdown v5 — novos campos

```typescript
interface StoredPricingBreakdown {
  // ... campos existentes v4 ...
  version: '5.0-risk-aware';  // novo

  // NOVO BLOCO
  riskCosts?: {
    repasseTotal: number;            // GRIS + TSO + RCTR-C (receita, nao custo)
    custoRealTotal: number;          // soma dos custos reais abaixo
    items: Array<{
      code: string;                  // 'BUONNY_CONSULTA' | 'BUONNY_MONITORAMENTO' | 'SEGURO_EFETIVO'
      name: string;
      unitCost: number;
      quantity: number;
      total: number;
      scope: 'per_trip' | 'per_order';
    }>;
  };

  // PROFITABILITY ATUALIZADO
  profitability: {
    // campos existentes
    custosCarreteiro: number;
    custoMotorista: number;          // GAP 1 fix — agora sempre presente
    custosDescarga: number;
    custosDiretos: number;           // AGORA inclui pedagio
    receitaLiquida: number;          // GAP 2 fix — agora sempre presente
    margemBruta: number;
    overhead: number;
    resultadoLiquido: number;        // NOVO CALCULO: nao deduz GRIS/TSO/RCTR-C
    margemPercent: number;
    profitMarginTarget: number;      // GAP 3 fix — agora sempre presente
    regimeFiscal: string;            // GAP 4 fix — agora sempre presente

    // NOVOS CAMPOS v5
    repasseRisco: number;            // GRIS + TSO + RCTR-C (informativo)
    custoRealRisco: number;          // Buonny + seguro efetivo
    custosDiretosComPedagio: number; // frete_peso + pedagio + descarga + aluguel
    pedagioIncluido: boolean;        // flag: pedagio esta em custosDiretos
  };
}
```

### 4.4 CalculateFreightResponse v5 — novos campos

```typescript
interface CalculateFreightResponse {
  // ... campos existentes ...

  // NOVO
  risk_costs?: {
    repasse_total: number;
    custo_real_total: number;
    items: Array<{
      code: string;
      name: string;
      unit_cost: number;
      quantity: number;
      total: number;
      scope: string;
    }>;
  };

  profitability: FreightProfitability & {
    repasse_risco: number;
    custo_real_risco: number;
    custos_diretos_com_pedagio: number;
    pedagio_incluido: boolean;
  };
}
```

---

## 5. Relacionamentos (ER simplificado)

```
risk_policies (1) ──< risk_policy_rules (N)
risk_policies (1) ──< risk_evaluations (N)

risk_evaluations (1) ──< risk_evidence (N)
risk_evaluations (1) ──< risk_costs (N)
risk_evaluations (1) ──o approval_requests (0..1)

orders (1) ──< risk_evaluations (N) [entity_type='order']
trips (1) ──< risk_evaluations (N) [entity_type='trip']
orders (1) ──< risk_costs (N)
trips (1) ──< risk_costs (N)

risk_services_catalog (1) ──< risk_costs (N)
documents (1) ──o risk_evidence (0..1)
```

---

## 6. Seed data

### 6.1 Apolice inicial

```sql
INSERT INTO risk_policies (code, name, policy_type, insurer, endorsement, risk_manager, valid_from, coverage_limit)
VALUES (
  'RCDC-1005500008136',
  'RC-DC Apolice 1005500008136 com Buonny',
  'RC-DC',
  'HDI Seguros',
  'END 4011848',
  'Buonny',
  '2026-01-01',
  5000000.00
);
```

### 6.2 Regras de criticidade

```sql
-- Obter policy_id
WITH pol AS (SELECT id FROM risk_policies WHERE code = 'RCDC-1005500008136')
INSERT INTO risk_policy_rules (policy_id, trigger_type, trigger_config, criticality, requirements, sort_order)
VALUES
  ((SELECT id FROM pol), 'cargo_value', '{"min": 0, "max": 50000}', 'LOW',
   '["buonny_consulta"]', 1),
  ((SELECT id FROM pol), 'cargo_value', '{"min": 50001, "max": 150000}', 'MEDIUM',
   '["buonny_consulta", "buonny_cadastro", "docs_completos"]', 2),
  ((SELECT id FROM pol), 'cargo_value', '{"min": 150001, "max": 500000}', 'HIGH',
   '["buonny_consulta", "buonny_cadastro", "monitoramento", "gr_doc", "rota_doc"]', 3),
  ((SELECT id FROM pol), 'cargo_value', '{"min": 500001, "max": null}', 'CRITICAL',
   '["buonny_consulta", "buonny_cadastro", "monitoramento", "gr_doc", "rota_doc", "aprovacao_gerencial"]', 4),
  ((SELECT id FROM pol), 'km_distance', '{"min": 1000}', 'LOW',
   '[]', 10),   -- boost: criticality_boost=1 implica +1 nivel
  ((SELECT id FROM pol), 'trip_order_count', '{"min": 4}', 'LOW',
   '[]', 20);

-- Ajustar boost para km e trip_order_count
UPDATE risk_policy_rules SET criticality_boost = 1
WHERE trigger_type IN ('km_distance', 'trip_order_count');
```

### 6.3 Servicos Buonny

```sql
INSERT INTO risk_services_catalog (code, name, provider, unit_cost, cost_type, scope, required_when, validity_days)
VALUES
  ('BUONNY_CONSULTA', 'Consulta Profissional', 'Buonny', 13.76, 'fixed', 'per_trip', 'always', 90),
  ('BUONNY_CADASTRO', 'Cadastro de Motorista', 'Buonny', 42.10, 'fixed', 'per_driver', 'no_cadastro', NULL),
  ('BUONNY_MONITORAMENTO', 'Monitoramento de Viagem', 'Buonny', 252.78, 'fixed', 'per_trip', 'high_critical', NULL);
```

---

## 7. RLS Policies

```sql
-- risk_policies: leitura para todos autenticados; escrita para admin
ALTER TABLE risk_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk_policies_read" ON risk_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "risk_policies_write" ON risk_policies FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin'));

-- risk_evaluations: leitura para todos; escrita para admin/operacao
ALTER TABLE risk_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk_evaluations_read" ON risk_evaluations FOR SELECT TO authenticated USING (true);
CREATE POLICY "risk_evaluations_write" ON risk_evaluations FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'operacao'));

-- risk_evidence: leitura para todos; escrita para admin/operacao
ALTER TABLE risk_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk_evidence_read" ON risk_evidence FOR SELECT TO authenticated USING (true);
CREATE POLICY "risk_evidence_write" ON risk_evidence FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'operacao'));

-- risk_costs: leitura para todos; escrita para admin/operacao
ALTER TABLE risk_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk_costs_read" ON risk_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY "risk_costs_write" ON risk_costs FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'operacao'));

-- Idem para risk_policy_rules e risk_services_catalog (admin only write)
```

---

## 8. Migration file naming

```
supabase/migrations/20260307100000_risk_workflow_tables.sql      -- tabelas + enums
supabase/migrations/20260307100100_risk_workflow_views.sql        -- views
supabase/migrations/20260307100200_risk_workflow_rls.sql          -- RLS
supabase/migrations/20260307100300_risk_workflow_seed.sql         -- seed data
supabase/migrations/20260307100400_risk_workflow_validate_transition.sql  -- update RPC
```
