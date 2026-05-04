-- Extend clients table with fields needed for contract generation
-- All columns are nullable to not break existing client records

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS state_registration       text,
  ADD COLUMN IF NOT EXISTS legal_representative_name text,
  ADD COLUMN IF NOT EXISTS legal_representative_cpf  text,
  ADD COLUMN IF NOT EXISTS legal_representative_role text,
  ADD COLUMN IF NOT EXISTS address_number            text,
  ADD COLUMN IF NOT EXISTS address_complement        text,
  ADD COLUMN IF NOT EXISTS address_neighborhood      text;

COMMENT ON COLUMN clients.state_registration        IS 'Inscrição Estadual do cliente';
COMMENT ON COLUMN clients.legal_representative_name IS 'Nome do representante legal (para assinatura do contrato)';
COMMENT ON COLUMN clients.legal_representative_cpf  IS 'CPF do representante legal';
COMMENT ON COLUMN clients.legal_representative_role IS 'Cargo/função do representante legal (ex: Sócio-Gerente)';
COMMENT ON COLUMN clients.address_number            IS 'Número do endereço (complementa campo address existente)';
COMMENT ON COLUMN clients.address_complement        IS 'Complemento do endereço';
COMMENT ON COLUMN clients.address_neighborhood      IS 'Bairro';
