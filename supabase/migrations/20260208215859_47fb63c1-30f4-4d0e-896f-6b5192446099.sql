-- Adicionar colunas de documentos do motorista na tabela orders
-- Migração para UI Stage-Gated no Board Operacional

BEGIN;

-- Colunas de documentos do motorista (visíveis a partir de busca_motorista)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS has_crlv boolean DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS has_cnh boolean DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS has_comp_residencia boolean DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS has_antt boolean DEFAULT false;

-- Colunas de documentos fiscais (visíveis a partir de documentacao)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS has_mdf boolean DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS has_gr boolean DEFAULT false;

COMMIT;