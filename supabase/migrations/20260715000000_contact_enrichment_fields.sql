-- =============================================================================
-- Contact enrichment — segunda camada de cruzamento (telefone/email)
-- =============================================================================
-- O cartao CNPJ da Receita (BrasilAPI, ver 20260714000003) raramente traz email
-- corporativo: ~97% dos clients ficaram sem email apos o backfill. Esta migration
-- adiciona o controle de uma segunda camada de enriquecimento de CONTATO
-- (telefone/email) cruzando bases publicas (Hunter, Google Places, site, etc.),
-- executada pelo workflow gymsite-contact-enrichment no vectraclip.
--
-- Politica (regra de ouro, ver scripts/backfill-cnpj-lookup.ts):
--   - email/phone sao FILL-ONLY (so preenche se NULL; nunca sobrescreve)
--   - email so grava quando verificado (email_status=deliverable)
--   - idempotente via contact_enrichment_at (re-rodar nao reprocessa)
--
-- Colunas:
--   contact_enrichment_at  timestamptz  — quando a enriquecimento de contato rodou
--   enrichment_sources     jsonb        — payload bruto por fonte +
--                                          email_status/confidence/verificacao
-- Aplicado em clients e shippers (simetrico — ambos sao pessoas juridicas).
-- =============================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS contact_enrichment_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_sources    jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.shippers
  ADD COLUMN IF NOT EXISTS contact_enrichment_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_sources    jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.clients.contact_enrichment_at IS
  'Marca a sincronia da camada de enriquecimento de contato (telefone/email) via cruzamento de bases publicas. NULL = nunca enriquecido. Idempotencia do workflow gymsite-contact-enrichment.';
COMMENT ON COLUMN public.clients.enrichment_sources IS
  'Payload bruto por fonte do enriquecimento de contato (ex.: {"hunter": {...}, "places": {...}}), incluindo email_status, confidence e resultado da verificacao. Dado sensivel (CPF/processos) NAO deve ser persistido aqui.';
COMMENT ON COLUMN public.shippers.contact_enrichment_at IS
  'Marca a sincronia da camada de enriquecimento de contato (telefone/email) via cruzamento de bases publicas. NULL = nunca enriquecido.';
COMMENT ON COLUMN public.shippers.enrichment_sources IS
  'Payload bruto por fonte do enriquecimento de contato, incluindo email_status, confidence e resultado da verificacao.';
