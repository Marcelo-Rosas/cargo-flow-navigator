-- =====================================================
-- Condição de pagamento: à vista, 50/50, 70/30 + dias (15, 25, 30)
-- =====================================================

-- Adiciona coluna advance_percent: 0 = à vista ou prazo normal, 50 = 50/50, 70 = 70/30
ALTER TABLE public.payment_terms
  ADD COLUMN IF NOT EXISTS advance_percent NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.payment_terms.advance_percent IS 'Percentual de adiantamento: 0 = à vista ou prazo normal, 50 = 50/50, 70 = 70/30';

-- Inserir D25 (25 dias) se não existir
INSERT INTO public.payment_terms (code, name, days, adjustment_percent, advance_percent)
VALUES ('D25', '25 dias', 25, 1.0, 0)
ON CONFLICT (code) DO NOTHING;

-- Inserir termos 50/50 e 70/30 com 15, 25, 30 dias
INSERT INTO public.payment_terms (code, name, days, adjustment_percent, advance_percent)
VALUES
  ('50_50_D15', '50/50 em 15 dias', 15, 0, 50),
  ('50_50_D25', '50/50 em 25 dias', 25, 0.5, 50),
  ('50_50_D30', '50/50 em 30 dias', 30, 1.0, 50),
  ('70_30_D15', '70/30 em 15 dias', 15, 0, 70),
  ('70_30_D25', '70/30 em 25 dias', 25, 0.5, 70),
  ('70_30_D30', '70/30 em 30 dias', 30, 1.0, 70)
ON CONFLICT (code) DO NOTHING;
