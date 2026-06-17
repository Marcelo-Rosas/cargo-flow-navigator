-- =====================================================
-- Domain fields required by CT-e / MDF-e emission (F1.2)
-- quotes: tomador_tipo, nfe_keys, origin/destination IBGE + UF
-- shippers/clients: ie_indicator, ibge_code (state_registration reused as IE)
-- =====================================================

-- quotes: CT-e-specific fields
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS tomador_tipo SMALLINT
    CHECK (tomador_tipo IS NULL OR tomador_tipo BETWEEN 0 AND 4),
  ADD COLUMN IF NOT EXISTS nfe_keys TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS origin_ibge INT,
  ADD COLUMN IF NOT EXISTS destination_ibge INT,
  ADD COLUMN IF NOT EXISTS origin_uf CHAR(2),
  ADD COLUMN IF NOT EXISTS destination_uf CHAR(2);

COMMENT ON COLUMN public.quotes.tomador_tipo IS 'CT-e tomador: 0=Remetente, 1=Expedidor, 2=Recebedor, 3=Destinatario, 4=Outros';
COMMENT ON COLUMN public.quotes.nfe_keys IS 'NFe access keys (44 digits each) for the cargo. Used in CT-e infDoc/infNFe.';
COMMENT ON COLUMN public.quotes.origin_ibge IS 'IBGE municipality code (7 digits) of pickup point — derived from origin_cep';
COMMENT ON COLUMN public.quotes.destination_ibge IS 'IBGE municipality code (7 digits) of delivery point — derived from destination_cep';

-- shippers: CT-e remetente fields
ALTER TABLE public.shippers
  ADD COLUMN IF NOT EXISTS ie_indicator SMALLINT DEFAULT 1
    CHECK (ie_indicator IN (1, 2, 9)),
  ADD COLUMN IF NOT EXISTS ibge_code INT;

COMMENT ON COLUMN public.shippers.ie_indicator IS 'CT-e indIEDest: 1=contribuinte ICMS, 2=contribuinte isento, 9=nao contribuinte';
COMMENT ON COLUMN public.shippers.ibge_code IS 'IBGE municipality code (7 digits) of registered address';

-- clients: CT-e destinatário fields
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS ie_indicator SMALLINT DEFAULT 1
    CHECK (ie_indicator IN (1, 2, 9)),
  ADD COLUMN IF NOT EXISTS ibge_code INT;

COMMENT ON COLUMN public.clients.ie_indicator IS 'CT-e indIEDest: 1=contribuinte ICMS, 2=contribuinte isento, 9=nao contribuinte';
COMMENT ON COLUMN public.clients.ibge_code IS 'IBGE municipality code (7 digits) of registered address';

-- Indexes on IBGE for fast cnpj+ibge lookups
CREATE INDEX IF NOT EXISTS idx_shippers_ibge_code ON public.shippers(ibge_code);
CREATE INDEX IF NOT EXISTS idx_clients_ibge_code ON public.clients(ibge_code);
