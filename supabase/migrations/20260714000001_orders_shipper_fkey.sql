-- =============================================================================
-- FK orders.shipper_id -> shippers(id)
-- =============================================================================
-- A coluna shipper_id existia na tabela orders sem FK, impedindo embedded joins
-- do PostgREST (shipper:shippers(...)). Adicionado AFTER VEC-XX para suportar
-- a feature de Ordem de Coleta que precisa do snapshot do remetente via join.
-- ON DELETE SET NULL para não bloquear remoção de embarcadores antigos.
-- =============================================================================

ALTER TABLE public.orders
  ADD CONSTRAINT orders_shipper_id_fkey
  FOREIGN KEY (shipper_id) REFERENCES public.shippers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_shipper_id ON public.orders(shipper_id);
