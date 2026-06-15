-- Ordem de Coleta: segundo remetente (coleta adicional da cotação)
-- Guard pra preview branches: collection_orders e criada por 20260714000000_collection_orders.sql
-- (timestamp posterior). orders/quotes existem desde o schema inicial.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'collection_orders'
  ) THEN
    ALTER TABLE public.collection_orders
      ADD COLUMN IF NOT EXISTS sender_2_data jsonb;
  ELSE
    RAISE NOTICE 'collection_orders does not exist yet — skipping sender_2_data';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'orders'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS additional_shippers jsonb NOT NULL DEFAULT '[]'::jsonb;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'quotes'
    ) THEN
      UPDATE public.orders o
      SET additional_shippers = COALESCE(q.additional_shippers, '[]'::jsonb)
      FROM public.quotes q
      WHERE o.quote_id = q.id
        AND (o.additional_shippers IS NULL OR o.additional_shippers = '[]'::jsonb)
        AND q.additional_shippers IS NOT NULL
        AND q.additional_shippers <> '[]'::jsonb;
    END IF;
  ELSE
    RAISE NOTICE 'orders does not exist yet — skipping additional_shippers';
  END IF;
END $$;
