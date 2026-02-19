-- Datas manuais para condição financeira (adiantamento, à vista, saldo)
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS advance_due_date DATE,
  ADD COLUMN IF NOT EXISTS balance_due_date DATE;

COMMENT ON COLUMN public.quotes.advance_due_date IS 'Data do adiantamento (50% ou 70%) ou data à vista';
COMMENT ON COLUMN public.quotes.balance_due_date IS 'Data do saldo (50% ou 30%), null para à vista';
