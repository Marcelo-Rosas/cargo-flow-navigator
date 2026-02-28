-- v4.0.x: Adicionar tipo comprovante_descarga para documentos de custo de descarga na aba Carreteiro

ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'comprovante_descarga';

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS has_comprovante_descarga BOOLEAN DEFAULT false;
