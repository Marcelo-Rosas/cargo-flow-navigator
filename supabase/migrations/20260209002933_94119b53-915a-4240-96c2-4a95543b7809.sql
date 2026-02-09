-- Adicionar novos tipos de documento ao ENUM
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'cnh';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'crlv';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'comp_residencia';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'antt_motorista';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'mdfe';