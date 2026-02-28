-- ═══════════════════════════════════════════════════════
-- Operational Multi-Agent System: tables, templates, enums
-- ═══════════════════════════════════════════════════════

-- 1. Driver qualification status enum
DO $$ BEGIN
  CREATE TYPE public.driver_qualification_status AS ENUM (
    'pendente', 'em_analise', 'aprovado', 'reprovado', 'bloqueado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Compliance check type enum
DO $$ BEGIN
  CREATE TYPE public.compliance_check_type AS ENUM (
    'pre_contratacao', 'pre_coleta', 'pre_entrega', 'auditoria_periodica'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Compliance check status enum
DO $$ BEGIN
  CREATE TYPE public.compliance_check_status AS ENUM ('ok', 'warning', 'violation');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ───────────────────────────────────────────────────────
-- driver_qualifications
-- ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.driver_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_cpf TEXT,
  driver_name TEXT,
  status public.driver_qualification_status NOT NULL DEFAULT 'pendente',
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
  ai_analysis JSONB,
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_qualifications_order
  ON public.driver_qualifications(order_id);

CREATE INDEX IF NOT EXISTS idx_driver_qualifications_status
  ON public.driver_qualifications(status)
  WHERE status IN ('pendente', 'em_analise');

-- ───────────────────────────────────────────────────────
-- compliance_checks
-- ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  check_type public.compliance_check_type NOT NULL,
  rules_evaluated JSONB NOT NULL DEFAULT '[]'::jsonb,
  violations JSONB NOT NULL DEFAULT '[]'::jsonb,
  status public.compliance_check_status NOT NULL DEFAULT 'ok',
  ai_analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_order
  ON public.compliance_checks(order_id);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_status
  ON public.compliance_checks(status)
  WHERE status IN ('warning', 'violation');

-- ───────────────────────────────────────────────────────
-- regulatory_updates
-- ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regulatory_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  summary TEXT,
  relevance_score INTEGER CHECK (relevance_score >= 0 AND relevance_score <= 10),
  ai_analysis JSONB,
  action_required BOOLEAN NOT NULL DEFAULT false,
  notified BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regulatory_updates_source
  ON public.regulatory_updates(source, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_regulatory_updates_dedup
  ON public.regulatory_updates(source, url)
  WHERE url IS NOT NULL;

-- ───────────────────────────────────────────────────────
-- operational_reports
-- ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.operational_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'daily',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  analysis JSONB,
  summary_text TEXT,
  sent_via TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_operational_reports_date_type
  ON public.operational_reports(report_date, report_type);

-- ───────────────────────────────────────────────────────
-- Notification templates for operational agents
-- ───────────────────────────────────────────────────────
INSERT INTO public.notification_templates (key, channel, subject_template, body_template, active)
VALUES
  ('driver_qualification_approved', 'whatsapp', NULL,
   'VECTRA CARGO - Motorista Aprovado

OS: {{os_number}}
Motorista: {{driver_name}}
Placa: {{vehicle_plate}}
Score: {{risk_score}}/100

Status: APROVADO para operação.
Próximo passo: avançar para Documentação.', true),

  ('driver_qualification_blocked', 'whatsapp', NULL,
   'VECTRA CARGO - ALERTA: Motorista Bloqueado

OS: {{os_number}}
Motorista: {{driver_name}}
Score: {{risk_score}}/100

Red Flags:
{{risk_flags}}

Ação necessária: buscar outro motorista ou revisar documentação.', true),

  ('driver_qualification_review', 'whatsapp', NULL,
   'VECTRA CARGO - Revisão Necessária

OS: {{os_number}}
Motorista: {{driver_name}}
Score: {{risk_score}}/100

Pendências:
{{risk_flags}}

Acesse o dashboard para aprovar ou reprovar.', true),

  ('stage_gate_blocked', 'whatsapp', NULL,
   'VECTRA CARGO - Transição Bloqueada

OS: {{os_number}}
Transição: {{from_stage}} → {{to_stage}}

Motivo:
{{block_reason}}

Ação necessária no dashboard.', true),

  ('compliance_violation', 'both',
   'Violação de Compliance - {{os_number}}',
   'VECTRA CARGO - Violação de Compliance

OS: {{os_number}}
Tipo: {{check_type}}
Severidade: {{severity}}

Violações:
{{violations}}

Ação imediata necessária. Acesse o dashboard.', true),

  ('daily_operational_report', 'both',
   'Relatório Operacional Diário - {{report_date}}',
   '{{summary_text}}', true),

  ('regulatory_alert', 'whatsapp', NULL,
   'VECTRA CARGO - Atualização Regulatória

Fonte: {{source}}
Título: {{title}}

Resumo:
{{summary}}

Link: {{url}}', true)
ON CONFLICT (key) DO NOTHING;

-- ───────────────────────────────────────────────────────
-- RLS policies
-- ───────────────────────────────────────────────────────
ALTER TABLE public.driver_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read driver_qualifications"
  ON public.driver_qualifications FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert driver_qualifications"
  ON public.driver_qualifications FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update driver_qualifications"
  ON public.driver_qualifications FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can read compliance_checks"
  ON public.compliance_checks FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert compliance_checks"
  ON public.compliance_checks FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can read regulatory_updates"
  ON public.regulatory_updates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role can manage regulatory_updates"
  ON public.regulatory_updates FOR ALL
  TO service_role USING (true);

CREATE POLICY "Authenticated users can read operational_reports"
  ON public.operational_reports FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role can manage operational_reports"
  ON public.operational_reports FOR ALL
  TO service_role USING (true);

-- ───────────────────────────────────────────────────────
-- updated_at trigger for driver_qualifications
-- ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_driver_qualification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_driver_qualification_updated_at ON public.driver_qualifications;
CREATE TRIGGER trg_driver_qualification_updated_at
  BEFORE UPDATE ON public.driver_qualifications
  FOR EACH ROW EXECUTE FUNCTION public.update_driver_qualification_updated_at();
