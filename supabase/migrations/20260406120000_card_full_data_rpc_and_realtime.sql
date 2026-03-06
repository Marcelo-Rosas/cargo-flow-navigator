-- RPC: get_card_full_data — aggregated card data for quote/order/financial consistency
-- Used by useCardDetails and modals to have a single source of truth per card.

CREATE OR REPLACE FUNCTION public.get_card_full_data(
  p_quote_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_id uuid;
  v_order_id uuid;
  v_quote public.quotes%rowtype;
  v_order public.orders%rowtype;
  v_fat public.financial_documents%rowtype;
  v_pag public.financial_documents%rowtype;
  out_quote jsonb;
  out_order jsonb;
  out_fat jsonb;
  out_pag jsonb;
BEGIN
  IF p_quote_id IS NULL AND p_order_id IS NULL THEN
    RETURN jsonb_build_object('quote', null, 'order', null, 'fat', null, 'pag', null);
  END IF;

  -- Resolve quote_id and order_id and load quote/order rows
  IF p_quote_id IS NOT NULL THEN
    v_quote_id := p_quote_id;
    SELECT q.* INTO v_quote FROM public.quotes q WHERE q.id = p_quote_id;
    SELECT o.* INTO v_order FROM public.orders o WHERE o.quote_id = p_quote_id LIMIT 1;
    v_order_id := v_order.id;
  ELSE
    SELECT o.* INTO v_order FROM public.orders o WHERE o.id = p_order_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('quote', null, 'order', null, 'fat', null, 'pag', null);
    END IF;
    v_order_id := p_order_id;
    v_quote_id := v_order.quote_id;
    IF v_quote_id IS NOT NULL THEN
      SELECT q.* INTO v_quote FROM public.quotes q WHERE q.id = v_quote_id;
    END IF;
  END IF;

  -- Load quote if we have quote_id and not yet loaded
  IF v_quote_id IS NOT NULL AND v_quote.id IS NULL THEN
    SELECT q.* INTO v_quote FROM public.quotes q WHERE q.id = v_quote_id;
  END IF;

  -- FAT: by quote
  IF v_quote_id IS NOT NULL THEN
    SELECT fd.* INTO v_fat
    FROM public.financial_documents fd
    WHERE fd.source_type = 'quote' AND fd.source_id = v_quote_id AND fd.type = 'FAT'
    LIMIT 1;
  END IF;

  -- PAG: by order
  IF v_order_id IS NOT NULL THEN
    SELECT fd.* INTO v_pag
    FROM public.financial_documents fd
    WHERE fd.source_type = 'order' AND fd.source_id = v_order_id AND fd.type = 'PAG'
    LIMIT 1;
  END IF;

  out_quote := CASE WHEN v_quote.id IS NOT NULL THEN to_jsonb(v_quote) ELSE null END;
  out_order := CASE WHEN v_order.id IS NOT NULL THEN to_jsonb(v_order) ELSE null END;
  out_fat   := CASE WHEN v_fat.id IS NOT NULL THEN to_jsonb(v_fat) ELSE null END;
  out_pag   := CASE WHEN v_pag.id IS NOT NULL THEN to_jsonb(v_pag) ELSE null END;

  RETURN jsonb_build_object(
    'quote', out_quote,
    'order', out_order,
    'fat', out_fat,
    'pag', out_pag
  );
END;
$$;

-- Realtime: allow frontend to invalidate financial-kanban when documents/installments change
ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_installments;
