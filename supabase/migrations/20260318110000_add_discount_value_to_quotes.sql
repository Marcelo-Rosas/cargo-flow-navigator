-- Add discount_value column to quotes table
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12, 2) DEFAULT 0;

COMMENT ON COLUMN public.quotes.discount_value IS
  'Desconto comercial aplicado sobre o total cliente. value = totalCliente - discount_value.';
