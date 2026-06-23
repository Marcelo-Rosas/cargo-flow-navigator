-- =====================================================
-- F1.10: shippers.emit_cte_via — corte CT-e por embarcador
-- Active (legado) vs CFN (Focus NFe). Default 'active' preserva
-- comportamento atual; admin migra um shipper de cada vez.
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cte_router') THEN
    CREATE TYPE public.cte_router AS ENUM ('cfn', 'active', 'none');
  END IF;
END$$;

ALTER TABLE public.shippers
  ADD COLUMN IF NOT EXISTS emit_cte_via public.cte_router NOT NULL DEFAULT 'active';

COMMENT ON COLUMN public.shippers.emit_cte_via IS
  'CT-e router for this shipper: cfn=emit via CFN+Focus, active=emit via Active Trans (legacy), none=do not emit.';

CREATE INDEX IF NOT EXISTS idx_shippers_emit_cte_via ON public.shippers(emit_cte_via);
