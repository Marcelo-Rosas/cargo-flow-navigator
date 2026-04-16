-- Tabela de staging para importação de margem por motorista (Vectra Analytics)
CREATE TABLE IF NOT EXISTS vectra_motoristas_margem (
  id            serial PRIMARY KEY,
  motorista     text UNIQUE NOT NULL,
  viagens       integer,
  receita_total numeric,
  custo_total   numeric,
  margem_rs     numeric,
  margem_pct    numeric,
  pedagio_total numeric,
  peso_total    numeric,
  km_total      numeric,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vmm_motorista ON vectra_motoristas_margem (motorista);
CREATE INDEX IF NOT EXISTS idx_vmm_margem_pct ON vectra_motoristas_margem (margem_pct);
