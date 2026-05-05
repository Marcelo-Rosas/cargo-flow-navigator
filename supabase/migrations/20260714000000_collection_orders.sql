-- =============================================================================
-- Ordem de Coleta (Collection Orders)
-- =============================================================================
-- Documento gerado a partir da fase "busca_motorista" da OS, com snapshot
-- imutável dos dados de remetente, destinatário, motorista, veículo e carga.
-- Numeração mensal: OC-YYYY-MM-NNNN com gap permanente em cancelamentos.
-- =============================================================================

-- ─── 1. Granularidade de endereço em shippers ────────────────────────────────
-- Espelha o que já existe em clients (address_number/complement/neighborhood).
ALTER TABLE public.shippers
  ADD COLUMN IF NOT EXISTS address_number       text,
  ADD COLUMN IF NOT EXISTS address_complement   text,
  ADD COLUMN IF NOT EXISTS address_neighborhood text;

COMMENT ON COLUMN public.shippers.address_number       IS 'Número do endereço (complementa o campo address)';
COMMENT ON COLUMN public.shippers.address_complement   IS 'Complemento do endereço';
COMMENT ON COLUMN public.shippers.address_neighborhood IS 'Bairro';

-- ─── 2. Enum de status ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'collection_order_status') THEN
    CREATE TYPE public.collection_order_status AS ENUM ('emitida', 'cancelada');
  END IF;
END$$;

-- ─── 3. Tabela collection_orders ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collection_orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oc_number           text NOT NULL UNIQUE,
  oc_year             int  NOT NULL,
  oc_month            int  NOT NULL,
  oc_seq              int  NOT NULL,

  order_id            uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,

  status              public.collection_order_status NOT NULL DEFAULT 'emitida',

  -- Snapshots imutáveis (preservam o estado no momento da emissão)
  sender_data         jsonb NOT NULL,
  recipient_data      jsonb NOT NULL,
  driver_data         jsonb NOT NULL,
  vehicle_data        jsonb NOT NULL,
  cargo_data          jsonb NOT NULL,

  pickup_date         date,
  delivery_date       date,
  additional_info     text,

  pdf_storage_path    text,

  issued_at           timestamptz NOT NULL DEFAULT now(),
  issued_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  cancelled_at        timestamptz,
  cancelled_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancellation_reason text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT collection_orders_seq_unique UNIQUE (oc_year, oc_month, oc_seq),
  CONSTRAINT collection_orders_cancelled_consistency CHECK (
    (status = 'cancelada' AND cancelled_at IS NOT NULL)
    OR (status = 'emitida' AND cancelled_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_collection_orders_order_id ON public.collection_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_collection_orders_status   ON public.collection_orders(status);
CREATE INDEX IF NOT EXISTS idx_collection_orders_issued   ON public.collection_orders(issued_at DESC);

CREATE TRIGGER collection_orders_set_updated_at
  BEFORE UPDATE ON public.collection_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.collection_orders IS 'Ordens de coleta (OC) emitidas para OS na fase busca_motorista';
COMMENT ON COLUMN public.collection_orders.oc_number      IS 'Identificador OC-YYYY-MM-NNNN — gap permanente em cancelamentos';
COMMENT ON COLUMN public.collection_orders.sender_data    IS 'Snapshot do remetente (shipper) no momento da emissão';
COMMENT ON COLUMN public.collection_orders.recipient_data IS 'Snapshot do destinatário (client) no momento da emissão';
COMMENT ON COLUMN public.collection_orders.driver_data    IS 'Snapshot do motorista (nome, cpf, cnh, antt, telefone)';
COMMENT ON COLUMN public.collection_orders.vehicle_data   IS 'Snapshot do veículo (placa cavalo, placa carreta, tipo, marca, modelo)';
COMMENT ON COLUMN public.collection_orders.cargo_data     IS 'Snapshot da carga (peso_kg, volume_m3, cargo_value, cargo_type)';

-- ─── 4. RPC para sequência mensal ────────────────────────────────────────────
-- Usa advisory lock por (year, month) para evitar race condition.
-- Hash dos 6 dígitos YYYYMM cabe em int4 (max 999912).
CREATE OR REPLACE FUNCTION public.next_collection_order_seq(p_year int, p_month int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lock_key bigint;
  v_next     int;
BEGIN
  IF p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'invalid month: %', p_month;
  END IF;
  IF p_year  < 2026 OR p_year  > 2100 THEN
    RAISE EXCEPTION 'invalid year: %', p_year;
  END IF;

  v_lock_key := (p_year::bigint * 100) + p_month::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(MAX(oc_seq), 0) + 1
    INTO v_next
    FROM public.collection_orders
   WHERE oc_year = p_year AND oc_month = p_month;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.next_collection_order_seq(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_collection_order_seq(int, int) TO authenticated;

COMMENT ON FUNCTION public.next_collection_order_seq IS 'Retorna próximo seq mensal de OC. Gap permanente: cancelamentos consomem número.';

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.collection_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY collection_orders_select
  ON public.collection_orders FOR SELECT
  TO authenticated
  USING (
    public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[])
  );

CREATE POLICY collection_orders_insert
  ON public.collection_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[])
  );

CREATE POLICY collection_orders_update
  ON public.collection_orders FOR UPDATE
  TO authenticated
  USING (
    public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[])
  )
  WITH CHECK (
    public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[])
  );

-- DELETE não permitido — cancelamento é via UPDATE (status = 'cancelada')
-- para preservar a sequência numérica.

-- ─── 6. Storage bucket privado ───────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'collection-orders',
  'collection-orders',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "collection_orders_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'collection-orders'
    AND public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[])
  );

CREATE POLICY "collection_orders_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'collection-orders'
    AND public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[])
  );

CREATE POLICY "collection_orders_storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'collection-orders'
    AND public.has_profile(ARRAY['admin','operacional','financeiro']::public.user_profile[])
  );

CREATE POLICY "collection_orders_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'collection-orders'
    AND public.is_admin()
  );
