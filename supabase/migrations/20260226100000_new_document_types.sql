-- Add new document types to the enum
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'analise_gr';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'doc_rota';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'comprovante_vpo';

-- Add boolean flag columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS has_analise_gr BOOLEAN DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS has_doc_rota BOOLEAN DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS has_vpo BOOLEAN DEFAULT false;
