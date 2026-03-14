-- Feature: Múltiplos embarcadores por cotação
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS additional_shippers jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.quotes.additional_shippers
  IS 'Embarcadores adicionais: [{shipper_id, name, email?}]. Principal continua em shipper_id/shipper_name.';
