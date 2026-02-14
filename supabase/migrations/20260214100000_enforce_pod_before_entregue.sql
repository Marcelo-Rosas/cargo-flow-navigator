-- =====================================================
-- ENFORCE BUSINESS RULE: cannot set order.stage='entregue' without POD
-- =====================================================

-- Rule:
-- - Any INSERT/UPDATE that results in stage = 'entregue' MUST have has_pod = true
-- - This prevents bypassing the frontend check.

CREATE OR REPLACE FUNCTION public.enforce_pod_before_entregue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce when the resulting stage is 'entregue'
  IF NEW.stage = 'entregue' AND COALESCE(NEW.has_pod, false) = false THEN
    RAISE EXCEPTION 'POD obrigatório para finalizar (stage=entregue)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pod_before_entregue ON public.orders;

CREATE TRIGGER trg_enforce_pod_before_entregue
  BEFORE INSERT OR UPDATE OF stage, has_pod ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pod_before_entregue();
