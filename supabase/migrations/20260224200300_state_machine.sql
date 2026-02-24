-- ═══════════════════════════════════════════════════════════════
-- State Machine: workflow_definitions + workflow_transitions + RPC
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────
-- 1. TABLES
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT UNIQUE NOT NULL,
  stages JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workflow_definitions IS 'Defines valid stages for each entity type';

CREATE TABLE IF NOT EXISTS public.workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}',
  required_fields JSONB NOT NULL DEFAULT '[]',
  required_documents JSONB NOT NULL DEFAULT '[]',
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approval_type TEXT,
  post_actions JSONB NOT NULL DEFAULT '[]',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, from_stage, to_stage)
);

COMMENT ON TABLE public.workflow_transitions IS 'Valid transitions between stages with conditions and requirements';

CREATE INDEX IF NOT EXISTS idx_transitions_workflow ON public.workflow_transitions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_transitions_from ON public.workflow_transitions(workflow_id, from_stage);

-- ─────────────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────────────

ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view workflow_definitions"
  ON public.workflow_definitions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin can manage workflow_definitions"
  ON public.workflow_definitions FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view workflow_transitions"
  ON public.workflow_transitions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin can manage workflow_transitions"
  ON public.workflow_transitions FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────
-- 3. SEED: Workflow Definitions
-- ─────────────────────────────────────────────────────

INSERT INTO public.workflow_definitions (entity_type, stages) VALUES
  ('quote', '["novo_pedido","qualificacao","precificacao","enviado","negociacao","ganho","perdido"]'),
  ('order', '["ordem_criada","busca_motorista","documentacao","coleta_realizada","em_transito","entregue"]'),
  ('financial_fat', '["INCLUIR","GERADO","AGUARDANDO","RECEBIDO","FINALIZADO"]'),
  ('financial_pag', '["INCLUIR","GERADO","AGUARDANDO","PAGO","FINALIZADO"]')
ON CONFLICT (entity_type) DO UPDATE SET stages = EXCLUDED.stages, updated_at = now();

-- ─────────────────────────────────────────────────────
-- 4. SEED: Quote Transitions
-- ─────────────────────────────────────────────────────

-- Forward transitions
INSERT INTO public.workflow_transitions (workflow_id, from_stage, to_stage, description)
SELECT wd.id, t.from_stage, t.to_stage, t.description
FROM public.workflow_definitions wd
CROSS JOIN (VALUES
  ('novo_pedido',    'qualificacao',  'Avançar para qualificação'),
  ('qualificacao',   'precificacao',  'Iniciar precificação'),
  ('precificacao',   'enviado',       'Enviar cotação ao cliente'),
  ('enviado',        'negociacao',    'Entrar em negociação'),
  ('enviado',        'ganho',         'Marcar como ganho (direto)'),
  ('enviado',        'perdido',       'Marcar como perdido'),
  ('negociacao',     'ganho',         'Marcar como ganho'),
  ('negociacao',     'perdido',       'Marcar como perdido'),
  -- Backward transitions allowed
  ('negociacao',     'precificacao',  'Voltar para ajustar preço'),
  ('enviado',        'precificacao',  'Voltar para reajuste de preço')
) AS t(from_stage, to_stage, description)
WHERE wd.entity_type = 'quote'
ON CONFLICT (workflow_id, from_stage, to_stage) DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 5. SEED: Order Transitions
-- ─────────────────────────────────────────────────────

INSERT INTO public.workflow_transitions (workflow_id, from_stage, to_stage, required_documents, description)
SELECT wd.id, t.from_stage, t.to_stage, t.required_docs::JSONB, t.description
FROM public.workflow_definitions wd
CROSS JOIN (VALUES
  ('ordem_criada',      'busca_motorista',     '[]',                           'Iniciar busca de motorista'),
  ('busca_motorista',   'documentacao',        '[]',                           'Motorista confirmado, iniciar documentação'),
  ('documentacao',      'coleta_realizada',    '["nfe","cte"]',                'Coleta realizada (requer NF-e + CT-e)'),
  ('coleta_realizada',  'em_transito',         '[]',                           'Carga em trânsito'),
  ('em_transito',       'entregue',            '["pod"]',                      'Entrega confirmada (requer POD)'),
  -- Backward transitions
  ('documentacao',      'busca_motorista',     '[]',                           'Voltar para buscar outro motorista'),
  ('busca_motorista',   'ordem_criada',        '[]',                           'Cancelar busca de motorista')
) AS t(from_stage, to_stage, required_docs, description)
WHERE wd.entity_type = 'order'
ON CONFLICT (workflow_id, from_stage, to_stage) DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 6. SEED: Financial FAT Transitions
-- ─────────────────────────────────────────────────────

INSERT INTO public.workflow_transitions (workflow_id, from_stage, to_stage, requires_approval, approval_type, description)
SELECT wd.id, t.from_stage, t.to_stage, t.req_approval, t.approval_type, t.description
FROM public.workflow_definitions wd
CROSS JOIN (VALUES
  ('INCLUIR',    'GERADO',      false, NULL,               'Gerar faturamento'),
  ('GERADO',     'AGUARDANDO',  false, NULL,               'Aguardar pagamento (pode exigir aprovação por regra)'),
  ('AGUARDANDO', 'RECEBIDO',    false, NULL,               'Confirmar recebimento'),
  ('RECEBIDO',   'FINALIZADO',  false, NULL,               'Finalizar faturamento')
) AS t(from_stage, to_stage, req_approval, approval_type, description)
WHERE wd.entity_type = 'financial_fat'
ON CONFLICT (workflow_id, from_stage, to_stage) DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 7. SEED: Financial PAG Transitions
-- ─────────────────────────────────────────────────────

INSERT INTO public.workflow_transitions (workflow_id, from_stage, to_stage, requires_approval, approval_type, description)
SELECT wd.id, t.from_stage, t.to_stage, t.req_approval, t.approval_type, t.description
FROM public.workflow_definitions wd
CROSS JOIN (VALUES
  ('INCLUIR',    'GERADO',      false, NULL,                     'Gerar pagamento'),
  ('GERADO',     'AGUARDANDO',  true,  'financial_pag_approval', 'Aguardar pagamento (requer aprovação financeiro)'),
  ('AGUARDANDO', 'PAGO',        false, NULL,                     'Confirmar pagamento'),
  ('PAGO',       'FINALIZADO',  false, NULL,                     'Finalizar pagamento')
) AS t(from_stage, to_stage, req_approval, approval_type, description)
WHERE wd.entity_type = 'financial_pag'
ON CONFLICT (workflow_id, from_stage, to_stage) DO NOTHING;

-- ─────────────────────────────────────────────────────
-- 8. RPC: validate_transition
-- ─────────────────────────────────────────────────────

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

COMMENT ON FUNCTION public.validate_transition IS 'Validates if a stage transition is allowed and returns requirements';

-- ─────────────────────────────────────────────────────
-- 9. RPC: get_valid_transitions
-- ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_valid_transitions(
  p_entity_type TEXT,
  p_from_stage TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
      'to_stage', wt.to_stage,
      'description', wt.description,
      'requires_approval', wt.requires_approval,
      'required_documents', wt.required_documents
    ) ORDER BY wt.to_stage)
    FROM workflow_transitions wt
    JOIN workflow_definitions wd ON wd.id = wt.workflow_id
    WHERE wd.entity_type = p_entity_type
      AND wd.active = true
      AND wt.from_stage = p_from_stage),
    '[]'::JSONB
  );
END;
$$;

COMMENT ON FUNCTION public.get_valid_transitions IS 'Returns all valid target stages from a given stage';
