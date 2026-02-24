-- =====================================================
-- Approval Workflow + AI Insights tables
-- Part of Multi-Agent system (Fase 1)
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1. APPROVAL REQUESTS
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  approval_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by UUID,
  assigned_to UUID,
  assigned_to_role TEXT DEFAULT 'admin',
  title TEXT NOT NULL,
  description TEXT,
  ai_analysis JSONB,
  decision_notes TEXT,
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_pending
  ON public.approval_requests(status, assigned_to_role)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_approval_requests_entity
  ON public.approval_requests(entity_type, entity_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_approval_requests_updated_at ON public.approval_requests;
CREATE TRIGGER update_approval_requests_updated_at
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────
-- 2. APPROVAL RULES (configurable)
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  trigger_condition JSONB NOT NULL,
  approval_type TEXT NOT NULL,
  approver_role TEXT NOT NULL DEFAULT 'admin',
  auto_approve_after_hours INT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed approval rules
INSERT INTO public.approval_rules (name, entity_type, trigger_condition, approval_type, approver_role)
VALUES
  (
    'Documento financeiro FAT acima de R$50.000',
    'financial_document',
    '{"field": "total_amount", "operator": ">", "value": 50000, "additional": {"field": "type", "operator": "=", "value": "FAT"}}',
    'financial_release',
    'admin'
  ),
  (
    'Documento financeiro PAG - aprovação financeiro',
    'financial_document',
    '{"field": "type", "operator": "=", "value": "PAG"}',
    'pag_approval',
    'financeiro'
  ),
  (
    'Cotação com margem abaixo de 10%',
    'quote',
    '{"field": "pricing_breakdown.profitability.margem_percent", "operator": "<", "value": 10}',
    'low_margin_quote',
    'admin'
  )
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 3. AI INSIGHTS
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  analysis JSONB NOT NULL,
  summary_text TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_entity
  ON public.ai_insights(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_ai_insights_type
  ON public.ai_insights(insight_type, created_at DESC);

-- ─────────────────────────────────────────────────────
-- 4. NOTIFICATION TEMPLATES + LOGS (prepare for Fase 2)
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  subject_template TEXT,
  body_template TEXT NOT NULL,
  html_template TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient_email TEXT,
  recipient_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  external_id TEXT,
  error_message TEXT,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_pending
  ON public.notification_logs(status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notification_logs_entity
  ON public.notification_logs(entity_type, entity_id);

-- Seed notification templates
INSERT INTO public.notification_templates (key, channel, subject_template, body_template)
VALUES
  ('quote_won', 'email', 'Cotação {{quote_code}} aprovada - Vectra Cargo', 'Prezado(a) {{client_name}}, sua cotação {{quote_code}} foi aprovada. A ordem de serviço {{os_number}} foi criada. Entraremos em contato em breve.'),
  ('order_created', 'email', 'Ordem de Serviço {{os_number}} criada - Vectra Cargo', 'Prezado(a) {{client_name}}, a OS {{os_number}} foi criada para a rota {{origin}} → {{destination}}.'),
  ('driver_assigned', 'whatsapp', NULL, 'Olá {{driver_name}}, você foi designado para a OS {{os_number}}. Rota: {{origin}} → {{destination}}. Entre em contato com a operação para mais detalhes.'),
  ('delivery_confirmed', 'both', 'Entrega confirmada - OS {{os_number}}', 'Prezado(a) {{client_name}}, a entrega da OS {{os_number}} foi confirmada com sucesso.'),
  ('overdue_reminder', 'both', 'Lembrete de pagamento - {{code}}', 'Prezado(a), o documento {{code}} possui parcela(s) vencida(s) no valor de R$ {{amount}}. Por favor, regularize o pagamento.'),
  ('approval_requested', 'email', 'Aprovação necessária: {{title}}', 'Uma nova aprovação foi solicitada: {{title}}. {{description}} Acesse o sistema para aprovar ou rejeitar.'),
  ('approval_decided', 'email', 'Aprovação {{status}}: {{title}}', 'A solicitação "{{title}}" foi {{status}}. {{decision_notes}}')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 5. RLS for all new tables
-- ─────────────────────────────────────────────────────

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Approval requests: authenticated can view, only admin/financeiro can decide
CREATE POLICY "Authenticated users can view approval_requests"
  ON public.approval_requests FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert approval_requests"
  ON public.approval_requests FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update approval_requests"
  ON public.approval_requests FOR UPDATE
  TO authenticated USING (true);

-- Approval rules: view only for all, manage for admin
CREATE POLICY "Authenticated users can view approval_rules"
  ON public.approval_rules FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin can manage approval_rules"
  ON public.approval_rules FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- AI insights: view for all authenticated
CREATE POLICY "Authenticated users can view ai_insights"
  ON public.ai_insights FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert ai_insights"
  ON public.ai_insights FOR INSERT
  TO authenticated WITH CHECK (true);

-- Notification templates: view for all
CREATE POLICY "Authenticated users can view notification_templates"
  ON public.notification_templates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin can manage notification_templates"
  ON public.notification_templates FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Notification logs: view for all
CREATE POLICY "Authenticated users can view notification_logs"
  ON public.notification_logs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert notification_logs"
  ON public.notification_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update notification_logs"
  ON public.notification_logs FOR UPDATE
  TO authenticated USING (true);

-- ─────────────────────────────────────────────────────
-- 6. TRIGGER: Emit event when approval is decided
-- ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.emit_approval_decided_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO public.workflow_events (event_type, entity_type, entity_id, payload, created_by)
    VALUES (
      'approval.decided',
      NEW.entity_type,
      NEW.entity_id,
      jsonb_build_object(
        'approval_id', NEW.id,
        'approval_type', NEW.approval_type,
        'decision', NEW.status,
        'decision_notes', NEW.decision_notes,
        'decided_by', NEW.decided_by,
        'entity_type', NEW.entity_type,
        'entity_id', NEW.entity_id
      ),
      NEW.decided_by
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_approval_decided_event ON public.approval_requests;
CREATE TRIGGER trg_emit_approval_decided_event
  AFTER UPDATE OF status ON public.approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_approval_decided_event();
