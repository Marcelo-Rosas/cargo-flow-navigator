-- =============================================================================
-- orders.pickup_date — data prevista de coleta
-- =============================================================================
-- Necessario para a Ordem de Coleta (PDF) — campo "Previsao da Coleta".
-- Editavel pelo operador na OS via OrderForm.
-- =============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_date date;

COMMENT ON COLUMN public.orders.pickup_date IS
  'Data prevista de coleta da carga. Editavel pelo operador na OS. Usado na Ordem de Coleta (PDF).';
