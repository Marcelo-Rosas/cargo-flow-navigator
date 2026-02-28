-- Adicionar coluna CPF na tabela shippers (embarcadores)

ALTER TABLE public.shippers
  ADD COLUMN IF NOT EXISTS cpf TEXT;

COMMENT ON COLUMN public.shippers.cpf IS 'CPF do responsável/representante (formato 000.000.000-00)';
