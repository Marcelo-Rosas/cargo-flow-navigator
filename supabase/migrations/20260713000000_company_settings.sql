-- Company settings: single-row table with Vectra Cargo legal and banking data
-- Used as data source for contract generation (generate-contract-pdf edge function)

CREATE TABLE IF NOT EXISTS company_settings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name               text NOT NULL DEFAULT '',
  trade_name               text NOT NULL DEFAULT '',
  cnpj                     text NOT NULL DEFAULT '',
  state_registration       text NOT NULL DEFAULT '',
  municipal_registration   text DEFAULT '',
  address_street           text NOT NULL DEFAULT '',
  address_number           text NOT NULL DEFAULT '',
  address_complement       text DEFAULT '',
  address_neighborhood     text NOT NULL DEFAULT '',
  address_city             text NOT NULL DEFAULT '',
  address_state            text NOT NULL DEFAULT '',
  address_zip              text NOT NULL DEFAULT '',
  legal_representative_name text DEFAULT '',
  legal_representative_cpf  text DEFAULT '',
  legal_representative_role text DEFAULT '',
  bank_name                text DEFAULT '',
  bank_agency              text DEFAULT '',
  bank_account             text DEFAULT '',
  bank_pix_key             text DEFAULT '',
  default_jurisdiction     text NOT NULL DEFAULT 'Navegantes/SC',
  signature_city           text NOT NULL DEFAULT 'Navegantes',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read company settings (needed for UI rendering)
DROP POLICY IF EXISTS "company_settings_select" ON company_settings;
CREATE POLICY "company_settings_select" ON company_settings
  FOR SELECT TO authenticated USING (true);

-- Only service_role may insert/update (Edge Functions + initial seed)
-- No explicit policy needed: service_role bypasses RLS

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_company_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS company_settings_updated_at ON company_settings;
CREATE TRIGGER company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION update_company_settings_updated_at();

-- Seed: Vectra Cargo data from the standard contract template
INSERT INTO company_settings (
  legal_name,
  trade_name,
  cnpj,
  state_registration,
  address_street,
  address_number,
  address_neighborhood,
  address_city,
  address_state,
  address_zip,
  bank_name,
  bank_agency,
  bank_account,
  bank_pix_key,
  default_jurisdiction,
  signature_city
) VALUES (
  'VECTRA CARGO LTDA',
  'Vectra Cargo',
  '59.650.913/0001-04',
  '',
  'Avenida Prefeito Cirino Adolfo Cabral',
  '495',
  'São Pedro',
  'Navegantes',
  'SC',
  '88.370-053',
  '336 – Banco C6 S.A.',
  '0001',
  '40436388-1',
  '59.650.913/0001-04',
  'Navegantes/SC',
  'Navegantes'
) ON CONFLICT DO NOTHING;
