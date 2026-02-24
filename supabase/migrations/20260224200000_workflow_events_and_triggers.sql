-- =====================================================
-- Multi-Agent Event Bus: workflow_events + event_logs
-- Triggers emit events on stage/status changes
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1. TABLES
-- ─────────────────────────────────────────────────────

-- workflow_events: central event bus for all automation
CREATE TABLE IF NOT EXISTS public.workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_workflow_events_pending
  ON public.workflow_events(status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_workflow_events_entity
  ON public.workflow_events(entity_type, entity_id);

-- workflow_event_logs: audit trail for automation actions
CREATE TABLE IF NOT EXISTS public.workflow_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.workflow_events(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  agent TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_event_logs_event
  ON public.workflow_event_logs(event_id);

-- ─────────────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────────────

ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view workflow_events"
  ON public.workflow_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert workflow_events"
  ON public.workflow_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update workflow_events"
  ON public.workflow_events FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view workflow_event_logs"
  ON public.workflow_event_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert workflow_event_logs"
  ON public.workflow_event_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────
-- 3. TRIGGERS: Emit events on stage/status changes
-- ─────────────────────────────────────────────────────

-- 3a. Quotes: stage changed
CREATE OR REPLACE FUNCTION public.emit_quote_stage_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO public.workflow_events (event_type, entity_type, entity_id, payload, created_by)
    VALUES (
      'quote.stage_changed',
      'quote',
      NEW.id,
      jsonb_build_object(
        'old_stage', OLD.stage::TEXT,
        'new_stage', NEW.stage::TEXT,
        'quote_code', NEW.quote_code,
        'value', NEW.value,
        'client_name', NEW.client_name,
        'client_email', NEW.client_email,
        'client_id', NEW.client_id,
        'shipper_name', NEW.shipper_name,
        'shipper_email', NEW.shipper_email,
        'origin', NEW.origin,
        'destination', NEW.destination,
        'assigned_to', NEW.assigned_to
      ),
      COALESCE(auth.uid(), NEW.assigned_to)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_quote_stage_event ON public.quotes;
CREATE TRIGGER trg_emit_quote_stage_event
  AFTER UPDATE OF stage ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_quote_stage_event();

-- 3b. Orders: stage changed
CREATE OR REPLACE FUNCTION public.emit_order_stage_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO public.workflow_events (event_type, entity_type, entity_id, payload, created_by)
    VALUES (
      'order.stage_changed',
      'order',
      NEW.id,
      jsonb_build_object(
        'old_stage', OLD.stage::TEXT,
        'new_stage', NEW.stage::TEXT,
        'os_number', NEW.os_number,
        'value', NEW.value,
        'client_name', NEW.client_name,
        'client_id', NEW.client_id,
        'driver_name', NEW.driver_name,
        'driver_phone', NEW.driver_phone,
        'origin', NEW.origin,
        'destination', NEW.destination,
        'quote_id', NEW.quote_id,
        'carreteiro_antt', NEW.carreteiro_antt,
        'carreteiro_real', NEW.carreteiro_real
      ),
      COALESCE(auth.uid(), NEW.created_by)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_order_stage_event ON public.orders;
CREATE TRIGGER trg_emit_order_stage_event
  AFTER UPDATE OF stage ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_order_stage_event();

-- 3c. Orders: new order created
CREATE OR REPLACE FUNCTION public.emit_order_created_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workflow_events (event_type, entity_type, entity_id, payload, created_by)
  VALUES (
    'order.created',
    'order',
    NEW.id,
    jsonb_build_object(
      'os_number', NEW.os_number,
      'quote_id', NEW.quote_id,
      'client_name', NEW.client_name,
      'client_id', NEW.client_id,
      'value', NEW.value,
      'origin', NEW.origin,
      'destination', NEW.destination,
      'carreteiro_antt', NEW.carreteiro_antt
    ),
    COALESCE(auth.uid(), NEW.created_by)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_order_created_event ON public.orders;
CREATE TRIGGER trg_emit_order_created_event
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_order_created_event();

-- 3d. Financial documents: status changed
CREATE OR REPLACE FUNCTION public.emit_financial_status_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.workflow_events (event_type, entity_type, entity_id, payload)
    VALUES (
      'financial.status_changed',
      'financial_document',
      NEW.id,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'type', NEW.type::TEXT,
        'code', NEW.code,
        'total_amount', NEW.total_amount,
        'source_type', NEW.source_type::TEXT,
        'source_id', NEW.source_id,
        'owner_id', NEW.owner_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_financial_status_event ON public.financial_documents;
CREATE TRIGGER trg_emit_financial_status_event
  AFTER UPDATE OF status ON public.financial_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_financial_status_event();

-- 3e. Documents: new document uploaded
CREATE OR REPLACE FUNCTION public.emit_document_uploaded_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workflow_events (event_type, entity_type, entity_id, payload, created_by)
  VALUES (
    'document.uploaded',
    'document',
    NEW.id,
    jsonb_build_object(
      'type', NEW.type::TEXT,
      'order_id', NEW.order_id,
      'quote_id', NEW.quote_id,
      'file_name', NEW.file_name
    ),
    NEW.uploaded_by
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_document_uploaded_event ON public.documents;
CREATE TRIGGER trg_emit_document_uploaded_event
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_document_uploaded_event();
