-- =====================================================
-- Prep fields: pedágio charge type for ICMS base calculation
-- Plan 04 v0.1.0 — ICMS/pedágio prep (Fase 3)
--
-- Adds pedagio_charge_type to orders for future CT-e integration:
-- - VALE_PEDAGIO_EMBARCADOR: fora da base ICMS do CT-e
-- - PEDAGIO_DEBITADO_CTE: entra na base ICMS
-- - RATEIO_FRACIONADO: rateio por CT-e (fracionado)
-- =====================================================

-- 1. Create enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pedagio_charge_type') THEN
    CREATE TYPE public.pedagio_charge_type AS ENUM (
      'VALE_PEDAGIO_EMBARCADOR',
      'PEDAGIO_DEBITADO_CTE',
      'RATEIO_FRACIONADO'
    );
  END IF;
END $$;

-- 2. Add columns to orders (nullable, no breaking change)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pedagio_charge_type public.pedagio_charge_type,
  ADD COLUMN IF NOT EXISTS pedagio_debitado_no_cte BOOLEAN DEFAULT false;

-- 3. Comment for documentation
COMMENT ON COLUMN public.orders.pedagio_charge_type IS
  'Tipo de cobrança do pedágio para cálculo da base ICMS do CT-e. NULL = comportamento padrão (A).';
COMMENT ON COLUMN public.orders.pedagio_debitado_no_cte IS
  'Se true, pedágio foi debitado ao tomador no CT-e e entra na base tributável.';
