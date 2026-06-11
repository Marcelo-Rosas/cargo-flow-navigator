-- Garante no máximo uma linha em company_settings (singleton por tenant).
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS singleton boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS company_settings_singleton_idx
  ON public.company_settings (singleton);
