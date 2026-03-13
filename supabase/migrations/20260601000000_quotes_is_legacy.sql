-- Flag para cotações antigas (pré-MVP): sem motor de cálculo, campos editáveis manualmente

ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.quotes.is_legacy IS 'Cotação antiga (pré-MVP): sem motor de cálculo, FAT+PAG editáveis manualmente';
