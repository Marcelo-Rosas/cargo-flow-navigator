-- =============================================================================
-- CNPJ lookup — campos completos da Receita Federal (Comprovante + QSA)
-- =============================================================================
-- Provider: BrasilAPI (https://brasilapi.com.br/api/cnpj/v1/{cnpj}) ja retorna
-- todos os campos do cartao CNPJ + QSA numa unica chamada.
-- Aplicado em clients e shippers (simetrico — ambos sao pessoas juridicas).
-- =============================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS trade_name                 text,
  ADD COLUMN IF NOT EXISTS legal_nature               text,
  ADD COLUMN IF NOT EXISTS legal_nature_code          text,
  ADD COLUMN IF NOT EXISTS company_size               text,
  ADD COLUMN IF NOT EXISTS cnae_main_code             text,
  ADD COLUMN IF NOT EXISTS cnae_main_description      text,
  ADD COLUMN IF NOT EXISTS cnaes_secondary            jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS opening_date               date,
  ADD COLUMN IF NOT EXISTS registration_status        text,
  ADD COLUMN IF NOT EXISTS registration_status_date   date,
  ADD COLUMN IF NOT EXISTS registration_status_reason text,
  ADD COLUMN IF NOT EXISTS efr                        text,
  ADD COLUMN IF NOT EXISTS share_capital              numeric(15,2),
  ADD COLUMN IF NOT EXISTS partners                   jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cnpj_lookup_at             timestamptz;

ALTER TABLE public.shippers
  ADD COLUMN IF NOT EXISTS trade_name                 text,
  ADD COLUMN IF NOT EXISTS legal_nature               text,
  ADD COLUMN IF NOT EXISTS legal_nature_code          text,
  ADD COLUMN IF NOT EXISTS company_size               text,
  ADD COLUMN IF NOT EXISTS cnae_main_code             text,
  ADD COLUMN IF NOT EXISTS cnae_main_description      text,
  ADD COLUMN IF NOT EXISTS cnaes_secondary            jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS opening_date               date,
  ADD COLUMN IF NOT EXISTS registration_status        text,
  ADD COLUMN IF NOT EXISTS registration_status_date   date,
  ADD COLUMN IF NOT EXISTS registration_status_reason text,
  ADD COLUMN IF NOT EXISTS efr                        text,
  ADD COLUMN IF NOT EXISTS share_capital              numeric(15,2),
  ADD COLUMN IF NOT EXISTS partners                   jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cnpj_lookup_at             timestamptz,
  ADD COLUMN IF NOT EXISTS state_registration         text,
  ADD COLUMN IF NOT EXISTS legal_representative_name  text,
  ADD COLUMN IF NOT EXISTS legal_representative_cpf   text,
  ADD COLUMN IF NOT EXISTS legal_representative_role  text;
