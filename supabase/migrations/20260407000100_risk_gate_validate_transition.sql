-- Add risk gate check to validate_transition
-- Blocks documentacao -> coleta_realizada unless risk evaluation is approved

CREATE OR REPLACE FUNCTION public.validate_transition(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_from_stage TEXT,
  p_to_stage TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transition RECORD;
  v_errors JSONB := '[]'::JSONB;
  v_risk_status TEXT;
  v_trip_id UUID;
  v_trip_risk_status TEXT;
BEGIN
  -- Find matching transition rule
  SELECT wt.*
  INTO v_transition
  FROM workflow_transitions wt
  JOIN workflow_definitions wd ON wd.id = wt.workflow_id
  WHERE wd.entity_type = p_entity_type
    AND wd.active = true
    AND wt.from_stage = p_from_stage
    AND wt.to_stage = p_to_stage;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'errors', jsonb_build_array(
        format('Transição não permitida: %s → %s para %s', p_from_stage, p_to_stage, p_entity_type)
      ),
      'requires_approval', false,
      'approval_type', NULL,
      'post_actions', '[]'::JSONB,
      'required_fields', '[]'::JSONB,
      'required_documents', '[]'::JSONB
    );
  END IF;

  -- Check required documents for orders
  IF p_entity_type = 'order' AND jsonb_array_length(v_transition.required_documents) > 0 THEN
    DECLARE
      v_doc TEXT;
      v_order RECORD;
    BEGIN
      SELECT has_nfe, has_cte, has_pod, has_cnh, has_crlv, has_antt
      INTO v_order
      FROM orders WHERE id = p_entity_id;

      IF FOUND THEN
        FOR v_doc IN SELECT jsonb_array_elements_text(v_transition.required_documents)
        LOOP
          CASE v_doc
            WHEN 'nfe' THEN
              IF NOT COALESCE(v_order.has_nfe, false) THEN
                v_errors := v_errors || to_jsonb(format('Documento obrigatório ausente: NF-e'));
              END IF;
            WHEN 'cte' THEN
              IF NOT COALESCE(v_order.has_cte, false) THEN
                v_errors := v_errors || to_jsonb(format('Documento obrigatório ausente: CT-e'));
              END IF;
            WHEN 'pod' THEN
              IF NOT COALESCE(v_order.has_pod, false) THEN
                v_errors := v_errors || to_jsonb(format('Documento obrigatório ausente: POD (Comprovante de entrega)'));
              END IF;
            ELSE
              NULL;
          END CASE;
        END LOOP;
      END IF;
    END;
  END IF;

  -- ═══════════════════════════════════════════
  -- RISK GATE: documentacao -> coleta_realizada
  -- ═══════════════════════════════════════════
  IF p_entity_type = 'order' AND p_to_stage = 'coleta_realizada' THEN

    -- 1. Check if risk evaluation exists and is approved
    SELECT status INTO v_risk_status
    FROM risk_evaluations
    WHERE entity_type = 'order'
      AND entity_id = p_entity_id
      AND status NOT IN ('expired', 'rejected')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_risk_status IS NULL THEN
      v_errors := v_errors || to_jsonb('Avaliação de risco não iniciada. Acesse a aba Risco.');
    ELSIF v_risk_status != 'approved' THEN
      v_errors := v_errors || to_jsonb('Avaliação de risco pendente de aprovação.');
    END IF;

    -- 2. If order is in a trip, check trip risk too
    SELECT trip_id INTO v_trip_id FROM orders WHERE id = p_entity_id;

    IF v_trip_id IS NOT NULL THEN
      SELECT status INTO v_trip_risk_status
      FROM risk_evaluations
      WHERE entity_type = 'trip'
        AND entity_id = v_trip_id
        AND status NOT IN ('expired', 'rejected')
      ORDER BY created_at DESC
      LIMIT 1;

      IF v_trip_risk_status IS NULL OR v_trip_risk_status != 'approved' THEN
        v_errors := v_errors || to_jsonb('Avaliação de risco da viagem (VG) pendente.');
      END IF;
    END IF;

    -- 3. Check Buonny validity
    IF NOT EXISTS (
      SELECT 1 FROM risk_evidence rev
      JOIN risk_evaluations re ON re.id = rev.evaluation_id
      WHERE re.entity_type = 'order'
        AND re.entity_id = p_entity_id
        AND rev.evidence_type = 'buonny_check'
        AND rev.status = 'valid'
        AND rev.expires_at > now()
    ) THEN
      v_errors := v_errors || to_jsonb('Consulta Buonny expirada ou inexistente.');
    END IF;
  END IF;

  -- If there are validation errors, return invalid
  IF jsonb_array_length(v_errors) > 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'errors', v_errors,
      'requires_approval', v_transition.requires_approval,
      'approval_type', v_transition.approval_type,
      'post_actions', v_transition.post_actions,
      'required_fields', v_transition.required_fields,
      'required_documents', v_transition.required_documents
    );
  END IF;

  -- Valid transition
  RETURN jsonb_build_object(
    'valid', true,
    'errors', '[]'::JSONB,
    'requires_approval', v_transition.requires_approval,
    'approval_type', v_transition.approval_type,
    'post_actions', v_transition.post_actions,
    'required_fields', v_transition.required_fields,
    'required_documents', v_transition.required_documents,
    'description', v_transition.description
  );
END;
$$;
