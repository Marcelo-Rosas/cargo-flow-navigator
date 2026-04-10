INSERT INTO petrobras_diesel_prices
  (uf, preco_medio, periodo_coleta, fetched_at)
VALUES
  ('SC', 7.640, '2026-03-29', '2026-03-29T00:00:00Z'),
  ('SP', 7.680, '2026-03-29', '2026-03-29T00:00:00Z'),
  ('SE', 7.250, '2026-03-29', '2026-03-29T00:00:00Z'),
  ('TO', 7.800, '2026-03-29', '2026-03-29T00:00:00Z')
ON CONFLICT (uf, periodo_coleta) DO NOTHING;