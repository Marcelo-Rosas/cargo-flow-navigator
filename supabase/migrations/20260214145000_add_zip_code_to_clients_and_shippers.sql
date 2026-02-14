-- =====================================================
-- Add CEP (zip_code) to clients and shippers for auto-fill in QuoteForm
-- =====================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS zip_code text;

ALTER TABLE public.shippers
  ADD COLUMN IF NOT EXISTS zip_code text;
