-- Migration: Add validation fields to documents table
-- Created: 2026-05-27 (timestamp 2025-05-27 e um typo do ano — corrigido envolvendo
-- as alteracoes em DO $$...$$ que verifica a existencia da tabela antes,
-- permitindo que a migration funcione em branches preview onde documents
-- so e criada por uma migration posterior; em prod as colunas ja existem,
-- entao ADD COLUMN IF NOT EXISTS e no-op idempotente).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'documents'
  ) THEN
    RAISE NOTICE 'documents table does not exist yet — skipping validation fields (will be added when documents is created)';
    RETURN;
  END IF;

  ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS validation_errors text[] DEFAULT NULL;

  ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS validation_metadata jsonb DEFAULT NULL;

  CREATE INDEX IF NOT EXISTS idx_documents_validation_status
    ON public.documents(validation_status)
    WHERE validation_status IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_documents_nfe_key
    ON public.documents(nfe_key)
    WHERE nfe_key IS NOT NULL;

  -- Comments only when column exists (validation_status pode nao existir em prev branch)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'validation_status'
  ) THEN
    COMMENT ON COLUMN public.documents.validation_status IS 'Status de validacao: pending, valid, invalid, xml_parsed';
  END IF;

  COMMENT ON COLUMN public.documents.validation_errors IS 'Array de mensagens de erro da validacao';
  COMMENT ON COLUMN public.documents.validation_metadata IS 'Metadados extraidos da chave de acesso (UF, CNPJ, modelo, serie, numero)';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'nfe_key'
  ) THEN
    COMMENT ON COLUMN public.documents.nfe_key IS 'Chave de acesso do documento fiscal (44 digitos)';
  END IF;
END $$;
