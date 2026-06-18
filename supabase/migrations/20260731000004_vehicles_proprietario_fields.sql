-- =====================================================
-- F1.8 patch: vehicles.proprietario fields for MDF-e modal rodoviário
-- veiculo_tracao.proprietario requires distinct identification when the
-- vehicle is third-party (TAC Agregado / Independente). Vectra's RNTRC
-- goes in modal_rodoviario.rntrc; vehicle proprietario can differ.
-- =====================================================

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS rntrc_proprietario TEXT,
  ADD COLUMN IF NOT EXISTS cpf_cnpj_proprietario TEXT,
  ADD COLUMN IF NOT EXISTS nome_proprietario TEXT,
  ADD COLUMN IF NOT EXISTS ie_proprietario TEXT,
  ADD COLUMN IF NOT EXISTS uf_proprietario CHAR(2),
  ADD COLUMN IF NOT EXISTS tipo_proprietario SMALLINT
    CHECK (tipo_proprietario IS NULL OR tipo_proprietario IN (0, 1, 2));

COMMENT ON COLUMN public.vehicles.rntrc_proprietario IS 'RNTRC do proprietário do veículo (8 dígitos). NULL = veículo é da Vectra (usa RNTRC empresa).';
COMMENT ON COLUMN public.vehicles.tipo_proprietario IS 'MDF-e tpProp: 0=TAC Agregado, 1=TAC Independente, 2=Outros. NULL = veículo próprio Vectra.';
