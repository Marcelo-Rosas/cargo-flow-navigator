-- Add CPF column to drivers table (needed for Buonny integration)
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS cpf text;

-- CPF must be unique when present
CREATE UNIQUE INDEX IF NOT EXISTS drivers_cpf_unique
  ON public.drivers (cpf)
  WHERE cpf IS NOT NULL;

COMMENT ON COLUMN public.drivers.cpf IS 'CPF do motorista (11 dígitos, sem pontuação)';
