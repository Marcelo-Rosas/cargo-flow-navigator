-- Ordem de Coleta: segundo remetente (coleta adicional da cotação)
ALTER TABLE public.collection_orders
  ADD COLUMN IF NOT EXISTS sender_2_data jsonb;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS additional_shippers jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.orders o
SET additional_shippers = COALESCE(q.additional_shippers, '[]'::jsonb)
FROM public.quotes q
WHERE o.quote_id = q.id
  AND (o.additional_shippers IS NULL OR o.additional_shippers = '[]'::jsonb)
  AND q.additional_shippers IS NOT NULL
  AND q.additional_shippers <> '[]'::jsonb;
