-- Adicionar campos booleanos para documentos do motorista
-- Nota: has_cnh, has_crlv, has_antt, has_mdf já existem na tabela

-- Adicionar apenas campos que podem estar faltando (idempotente)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS has_cnh BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_crlv BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_antt_motorista BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_mdfe BOOLEAN DEFAULT FALSE;