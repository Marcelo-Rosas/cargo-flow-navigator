-- =============================================================================
-- collection_orders.antt_data — snapshot resultado consulta ANTT/RNTRC
-- =============================================================================
-- Persiste o ultimo resultado da consulta ANTT (operation='rntrc' ou 'veiculo')
-- vinculada a OS no momento da emissao da OC. Garante rastreabilidade do que
-- foi verificado / impresso no PDF, mesmo que a evidencia em risk_evidence
-- seja regenerada depois.
-- =============================================================================

ALTER TABLE public.collection_orders
  ADD COLUMN IF NOT EXISTS antt_data jsonb;
