-- Migration: Add trigger to auto-validate documents after upload
-- Created: 2026-05-27
-- Uses pg_net extension for async HTTP calls to Edge Functions

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to call validate-document Edge Function
CREATE OR REPLACE FUNCTION public.validate_document_after_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Only validate documents that have a file or nfe_key
  IF NEW.file_url IS NOT NULL OR NEW.nfe_key IS NOT NULL THEN
    -- Build Edge Function URL
    edge_function_url := COALESCE(
      current_setting('app.edge_function_url', true),
      'https://epgedaiukjippepujuzc.supabase.co/functions/v1/validate-document'
    );

    -- Async call to Edge Function (non-blocking)
    -- Note: The Edge Function will update the document validation_status
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

-- Trigger: Validate document after insert
DROP TRIGGER IF EXISTS trigger_validate_document_on_insert ON documents;
CREATE TRIGGER trigger_validate_document_on_insert
AFTER INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION public.validate_document_after_upload();

-- Trigger: Validate document after update (if nfe_key changed)
DROP TRIGGER IF EXISTS trigger_validate_document_on_update ON documents;
CREATE TRIGGER trigger_validate_document_on_update
AFTER UPDATE OF nfe_key ON documents
FOR EACH ROW
WHEN (OLD.nfe_key IS DISTINCT FROM NEW.nfe_key)
EXECUTE FUNCTION public.validate_document_after_upload();

COMMENT ON FUNCTION public.validate_document_after_upload() IS 
  'Chama a Edge Function validate-document após upload de documento ou alteração da chave de acesso';
