-- Migration: Add trigger to auto-validate documents after upload
-- Created: 2026-05-27 (timestamp 2025-05-27 e um typo do ano — corrigido envolvendo
-- a criacao de trigger em DO $$...$$ que verifica a existencia da tabela antes;
-- em prod o trigger ja existe e DROP TRIGGER IF EXISTS torna a re-aplicacao no-op).
-- Uses pg_net extension for async HTTP calls to Edge Functions.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.validate_document_after_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT;
BEGIN
  IF NEW.file_url IS NOT NULL OR NEW.nfe_key IS NOT NULL THEN
    edge_function_url := COALESCE(
      current_setting('app.edge_function_url', true),
      'https://epgedaiukjippepujuzc.supabase.co/functions/v1/validate-document'
    );

    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(current_setting('app.anon_key', true), '')
      ),
      body := jsonb_build_object(
        'documentId', NEW.id,
        'auto_update', true
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'documents'
  ) THEN
    RAISE NOTICE 'documents table does not exist yet — skipping trigger creation (will be retried by later migrations or manually)';
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS trigger_validate_document_on_insert ON public.documents;
  CREATE TRIGGER trigger_validate_document_on_insert
    AFTER INSERT ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_document_after_upload();

  DROP TRIGGER IF EXISTS trigger_validate_document_on_update ON public.documents;
  CREATE TRIGGER trigger_validate_document_on_update
    AFTER UPDATE OF nfe_key ON public.documents
    FOR EACH ROW
    WHEN (OLD.nfe_key IS DISTINCT FROM NEW.nfe_key)
    EXECUTE FUNCTION public.validate_document_after_upload();
END $$;

COMMENT ON FUNCTION public.validate_document_after_upload() IS
  'Chama a Edge Function validate-document após upload de documento ou alteração da chave de acesso';
