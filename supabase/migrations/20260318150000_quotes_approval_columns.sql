-- Adicionar colunas de aprovação automática à tabela quotes
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT NULL
    CHECK (approval_status IN ('auto_approved', 'flagged_for_review')),
  ADD COLUMN IF NOT EXISTS approval_metadata JSONB DEFAULT NULL;

-- Índice para filtrar cotações por status de aprovação
CREATE INDEX IF NOT EXISTS idx_quotes_approval_status
  ON quotes (approval_status)
  WHERE approval_status IS NOT NULL;

-- Comentários
COMMENT ON COLUMN quotes.approval_status IS 'Decisão do auto-approval-worker: auto_approved ou flagged_for_review';
COMMENT ON COLUMN quotes.approval_metadata IS 'Metadados da avaliação: critérios, motivos, timestamp, versão do worker';
