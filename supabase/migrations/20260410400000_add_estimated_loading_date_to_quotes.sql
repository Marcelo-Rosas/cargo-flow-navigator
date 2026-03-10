-- Add estimated loading date to quotes for follow-up tracking
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS estimated_loading_date date;

CREATE INDEX IF NOT EXISTS idx_quotes_estimated_loading_date
  ON public.quotes (estimated_loading_date)
  WHERE estimated_loading_date IS NOT NULL;

COMMENT ON COLUMN public.quotes.estimated_loading_date IS 'Previsão de carregamento — usada para follow-up com embarcador';
