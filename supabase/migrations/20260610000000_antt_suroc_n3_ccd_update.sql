-- ============================================================
-- ANTT Portaria SUROC Nº 3 de 13/03/2026
-- Reajuste CCD (custo variável/km) — Tabela A, Carga Geral
-- CC (custo fixo) permanece inalterado
-- Fonte: DOU 13/03/2026
-- ============================================================

-- 1. Expirar registros anteriores (Tabela A, Carga Geral)
UPDATE public.antt_floor_rates
SET valid_until = '2026-03-12'
WHERE operation_table = 'A'
  AND cargo_type = 'carga_geral'
  AND valid_until IS NULL;

-- 2. Inserir novos CCD vigentes a partir de 13/03/2026
INSERT INTO public.antt_floor_rates (operation_table, cargo_type, axes_count, ccd, cc, valid_from)
VALUES
  ('A', 'carga_geral', 2, 3.8866, 436.39, '2026-03-13'),
  ('A', 'carga_geral', 3, 4.9762, 523.33, '2026-03-13'),
  ('A', 'carga_geral', 4, 5.6443, 568.72, '2026-03-13'),
  ('A', 'carga_geral', 5, 6.5126, 635.08, '2026-03-13'),
  ('A', 'carga_geral', 6, 7.1824, 648.95, '2026-03-13'),
  ('A', 'carga_geral', 7, 7.8952, 803.22, '2026-03-13'),
  ('A', 'carga_geral', 9, 8.9799, 872.44, '2026-03-13');
