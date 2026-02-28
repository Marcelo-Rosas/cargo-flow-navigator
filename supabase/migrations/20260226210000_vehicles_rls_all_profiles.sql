-- =============================================================
-- Migration: Adiciona 'comercial' ao enum user_profile
-- Nota: ALTER TYPE ADD VALUE não pode ser usado na mesma transação
-- que referencia o novo valor — por isso está em migration separada.
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'comercial'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_profile')
  ) THEN
    ALTER TYPE public.user_profile ADD VALUE 'comercial';
  END IF;
END $$;
