-- Tabela de staging para importação de rentabilidade por rota (Vectra Analytics)
CREATE TABLE IF NOT EXISTS vectra_rentabilidade_rotas (
  id           serial PRIMARY KEY,
  rota         text NOT NULL,
  viagens      integer,
  ctes         integer,
  receita_total numeric,
  custo_total  numeric,
  margem_rs    numeric,
  margem_pct   numeric,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vrr_rota ON vectra_rentabilidade_rotas (rota);
