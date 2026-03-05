-- =====================================================
-- Financial documents and installments (base tables)
-- Required by: 20260219001000_financial_kanban_views.sql
-- =====================================================

-- Enums
CREATE TYPE public.financial_doc_type AS ENUM ('FAT', 'PAG');
CREATE TYPE public.financial_source_type AS ENUM ('quote', 'order');
CREATE TYPE public.financial_installment_status AS ENUM ('pendente', 'baixado');

-- financial_documents: FAT (a receber) or PAG (a pagar)
CREATE TABLE IF NOT EXISTS public.financial_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.owners(id),
  type public.financial_doc_type NOT NULL,
  code TEXT,
  status TEXT NOT NULL DEFAULT 'INCLUIR',
  source_type public.financial_source_type NOT NULL,
  source_id UUID NOT NULL,
  erp_status TEXT,
  erp_reference TEXT,
  total_amount NUMERIC(14, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- financial_installments: parcelas do documento
CREATE TABLE IF NOT EXISTS public.financial_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_document_id UUID NOT NULL REFERENCES public.financial_documents(id) ON DELETE CASCADE,
  status public.financial_installment_status NOT NULL DEFAULT 'pendente',
  due_date DATE NOT NULL,
  amount NUMERIC(14, 2),
  payment_method TEXT,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_documents_source ON public.financial_documents(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_financial_documents_type ON public.financial_documents(type);
CREATE INDEX IF NOT EXISTS idx_financial_installments_doc ON public.financial_installments(financial_document_id);

-- Trigger updated_at (uses existing update_updated_at_column)
DROP TRIGGER IF EXISTS update_financial_documents_updated_at ON public.financial_documents;
CREATE TRIGGER update_financial_documents_updated_at
  BEFORE UPDATE ON public.financial_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_financial_installments_updated_at ON public.financial_installments;
CREATE TRIGGER update_financial_installments_updated_at
  BEFORE UPDATE ON public.financial_installments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.financial_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_documents_select_admin_finance" ON public.financial_documents
  FOR SELECT
  TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

CREATE POLICY "financial_documents_insert_admin_finance" ON public.financial_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

CREATE POLICY "financial_documents_update_admin_finance" ON public.financial_documents
  FOR UPDATE
  TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]))
  WITH CHECK (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

CREATE POLICY "financial_installments_select_admin_finance" ON public.financial_installments
  FOR SELECT
  TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

CREATE POLICY "financial_installments_manage_admin_finance" ON public.financial_installments
  FOR ALL
  TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]))
  WITH CHECK (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

-- ensure_financial_document RPC: idempotent create from quote (FAT) or order (PAG)
CREATE OR REPLACE FUNCTION public.ensure_financial_document(
  doc_type public.financial_doc_type,
  source_id_in UUID,
  total_amount_in NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_code TEXT;
  v_amount NUMERIC;
  v_source_type public.financial_source_type;
BEGIN
  IF doc_type = 'FAT' THEN
    v_source_type := 'quote'::public.financial_source_type;
    IF NOT EXISTS (SELECT 1 FROM public.quotes WHERE id = source_id_in) THEN
      RAISE EXCEPTION 'Quote not found: %', source_id_in;
    END IF;
    SELECT value, COALESCE(quote_code, 'FAT-' || LEFT(source_id_in::TEXT, 8)) INTO v_amount, v_code
    FROM public.quotes WHERE id = source_id_in;
  ELSIF doc_type = 'PAG' THEN
    v_source_type := 'order'::public.financial_source_type;
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = source_id_in) THEN
      RAISE EXCEPTION 'Order not found: %', source_id_in;
    END IF;
    SELECT COALESCE(carreteiro_real, value), COALESCE(os_number, 'PAG-' || LEFT(source_id_in::TEXT, 8)) INTO v_amount, v_code
    FROM public.orders WHERE id = source_id_in;
  ELSE
    RAISE EXCEPTION 'Invalid doc_type: %', doc_type;
  END IF;

  v_amount := COALESCE(total_amount_in, v_amount);

  SELECT fd.id INTO v_id
  FROM public.financial_documents fd
  WHERE fd.source_type = v_source_type AND fd.source_id = source_id_in
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_id, 'created', false);
  END IF;

  INSERT INTO public.financial_documents (type, code, status, source_type, source_id, total_amount)
  VALUES (doc_type, v_code, 'INCLUIR', v_source_type, source_id_in, v_amount)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'created', true);
END;
$$;
