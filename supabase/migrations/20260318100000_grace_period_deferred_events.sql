-- =====================================================
-- Grace Period: 24h deferred OS creation from quote.ganho
-- =====================================================
-- When a quote transitions to 'ganho', a deferred event is scheduled
-- 24 hours in the future. If the quote is still 'ganho' when the event
-- matures, the OS is auto-created. If the quote reverts before that,
-- the deferred event is cancelled.
-- Manual conversion via "Converter para OS" is unaffected.

-- ─────────────────────────────────────────────────────
-- 1. Add execute_after column to workflow_events
-- ─────────────────────────────────────────────────────

ALTER TABLE public.workflow_events
  ADD COLUMN IF NOT EXISTS execute_after TIMESTAMPTZ;

COMMENT ON COLUMN public.workflow_events.execute_after IS
  'When set, event is only processed after now() >= execute_after. NULL = immediate.';

-- Partial index for efficient polling of matured deferred events
CREATE INDEX IF NOT EXISTS idx_workflow_events_deferred
  ON public.workflow_events(status, execute_after)
  WHERE status = 'pending' AND execute_after IS NOT NULL;

-- ─────────────────────────────────────────────────────
-- 2. Update trigger: emit_quote_stage_event()
--    Adds deferred event on entering 'ganho'
--    Cancels deferred event on leaving 'ganho'
-- ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.emit_quote_stage_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    -- Standard stage changed event (always emitted)
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

    -- Entering 'ganho': schedule deferred OS creation (24h grace period)
    IF NEW.stage = 'ganho' THEN
      -- Cancel any previous deferred events for this quote (handles ganho→X→ganho reset)
      UPDATE public.workflow_events
        SET status = 'cancelled', processed_at = now()
        WHERE entity_type = 'quote'
          AND entity_id = NEW.id
          AND event_type = 'quote.ganho_deferred'
          AND status = 'pending';

      -- Create new deferred event with 24h grace period
      INSERT INTO public.workflow_events
        (event_type, entity_type, entity_id, payload, created_by, execute_after)
      VALUES (
        'quote.ganho_deferred',
        'quote',
        NEW.id,
        jsonb_build_object(
          'quote_code', NEW.quote_code,
          'value', NEW.value,
          'client_name', NEW.client_name,
          'client_email', NEW.client_email,
          'client_id', NEW.client_id
        ),
        COALESCE(auth.uid(), NEW.assigned_to),
        now() + interval '24 hours'
      );
    END IF;

    -- Leaving 'ganho': cancel pending deferred event
    IF OLD.stage = 'ganho' AND NEW.stage != 'ganho' THEN
      UPDATE public.workflow_events
        SET status = 'cancelled', processed_at = now()
        WHERE entity_type = 'quote'
          AND entity_id = NEW.id
          AND event_type = 'quote.ganho_deferred'
          AND status = 'pending';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────
-- 3. Backward transitions from 'ganho' in state machine
-- ─────────────────────────────────────────────────────

INSERT INTO public.workflow_transitions (workflow_id, from_stage, to_stage, description)
SELECT wd.id, t.from_stage, t.to_stage, t.description
FROM public.workflow_definitions wd
CROSS JOIN (VALUES
  ('ganho', 'negociacao',   'Reverter ganho para negociação'),
  ('ganho', 'precificacao', 'Reverter ganho para reajuste de preço')
) AS t(from_stage, to_stage, description)
WHERE wd.entity_type = 'quote'
ON CONFLICT (workflow_id, from_stage, to_stage) DO NOTHING;
