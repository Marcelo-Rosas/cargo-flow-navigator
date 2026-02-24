-- Track whether a quote email has been sent to the client
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS email_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.quotes.email_sent IS 'Whether a quote email has been sent to the client';
COMMENT ON COLUMN public.quotes.email_sent_at IS 'Timestamp when the quote email was sent';
