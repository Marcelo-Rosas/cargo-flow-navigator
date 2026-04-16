-- Tabela de staging para importação de manifestos (Vectra Analytics)
CREATE TABLE IF NOT EXISTS vectra_manifestos (
  id          serial PRIMARY KEY,
  manifesto   text UNIQUE NOT NULL,
  motorista   text,
  veiculo     text,
  emissao     date,
  origem      text,
  destino     text,
  rota        text,
  proprietario text,
  tipo        text,
  frete       numeric,
  pedagio     numeric,
  combustivel numeric,
  peso        numeric,
  ciot        text,
  has_ciot    boolean DEFAULT false,
  status      text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vm_motorista ON vectra_manifestos (motorista);
CREATE INDEX IF NOT EXISTS idx_vm_tipo ON vectra_manifestos (tipo);
CREATE INDEX IF NOT EXISTS idx_vm_has_ciot ON vectra_manifestos (has_ciot);
