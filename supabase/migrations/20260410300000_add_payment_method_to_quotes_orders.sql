-- Add payment_method to quotes and orders tables
-- Values: pix, boleto, cartao, transferencia, outro

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS payment_method text
  CHECK (payment_method IS NULL OR payment_method IN ('pix','boleto','cartao','transferencia','outro'));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text
  CHECK (payment_method IS NULL OR payment_method IN ('pix','boleto','cartao','transferencia','outro'));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS carrier_payment_method text
  CHECK (carrier_payment_method IS NULL OR carrier_payment_method IN ('pix','boleto','cartao','transferencia','outro'));

COMMENT ON COLUMN public.quotes.payment_method IS 'Método de pagamento do cliente (pix/boleto/cartao/transferencia/outro)';
COMMENT ON COLUMN public.orders.payment_method IS 'Método de pagamento do cliente (pix/boleto/cartao/transferencia/outro)';
COMMENT ON COLUMN public.orders.carrier_payment_method IS 'Método de pagamento do transportador (pix/boleto/cartao/transferencia/outro)';
