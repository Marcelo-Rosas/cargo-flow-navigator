-- Migration: Add validation fields to documents table
-- Created: 2026-05-27

-- Add validation_errors column (array of text)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS validation_errors text[] DEFAULT NULL;

-- Add validation_metadata column (JSONB for structured metadata)
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS validation_metadata jsonb DEFAULT NULL;

-- Add index on validation_status for filtering
CREATE INDEX IF NOT EXISTS idx_documents_validation_status
ON documents(validation_status)
WHERE validation_status IS NOT NULL;

-- Add index on nfe_key for lookups
CREATE INDEX IF NOT EXISTS idx_documents_nfe_key
ON documents(nfe_key)
WHERE nfe_key IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN documents.validation_status IS 'Status de validacao: pending, valid, invalid, xml_parsed';
COMMENT ON COLUMN documents.validation_errors IS 'Array de mensagens de erro da validacao';
COMMENT ON COLUMN documents.validation_metadata IS 'Metadados extraidos da chave de acesso (UF, CNPJ, modelo, serie, numero)';
COMMENT ON COLUMN documents.nfe_key IS 'Chave de acesso do documento fiscal (44 digitos)';
