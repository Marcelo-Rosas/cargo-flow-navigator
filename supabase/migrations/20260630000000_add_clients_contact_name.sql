-- Adiciona coluna contact_name (responsável) na tabela clients
-- Coluna já existe no DB remoto (criada via Dashboard), migration para versionamento
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contact_name TEXT;
