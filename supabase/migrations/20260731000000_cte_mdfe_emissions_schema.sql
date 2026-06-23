-- =====================================================
-- CT-e / MDF-e Focus NFe emission schema (F1.1)
-- Tables: cte_emissions, mdfe_emissions, cte_sequence,
--         mdfe_sequence, mdfe_cte_link
-- =====================================================

-- ENUMs (idempotent via DO blocks)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'focus_ambiente') THEN
    CREATE TYPE public.focus_ambiente AS ENUM ('homolog', 'prod');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cte_emission_status') THEN
    CREATE TYPE public.cte_emission_status AS ENUM (
      'draft', 'sent', 'processing', 'authorized', 'rejected', 'cancelled'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mdfe_emission_status') THEN
    CREATE TYPE public.mdfe_emission_status AS ENUM (
      'draft', 'sent', 'processing', 'authorized', 'rejected', 'encerrado', 'cancelled'
    );
  END IF;
END$$;

-- =====================================================
-- Sequence counters (atomic numero allocation per ambiente+serie)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cte_sequence (
  ambiente public.focus_ambiente NOT NULL,
  serie INT NOT NULL DEFAULT 1,
  last_numero BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (ambiente, serie)
);

INSERT INTO public.cte_sequence (ambiente, serie) VALUES
  ('homolog', 1), ('prod', 1)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.mdfe_sequence (
  ambiente public.focus_ambiente NOT NULL,
  serie INT NOT NULL DEFAULT 1,
  last_numero BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (ambiente, serie)
);

INSERT INTO public.mdfe_sequence (ambiente, serie) VALUES
  ('homolog', 1), ('prod', 1)
ON CONFLICT DO NOTHING;

-- =====================================================
-- cte_emissions: one row per CT-e issuance attempt
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cte_emissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id),
  quote_id UUID REFERENCES public.quotes(id),
  ref TEXT NOT NULL UNIQUE,
  ambiente public.focus_ambiente NOT NULL,
  serie INT NOT NULL,
  numero BIGINT NOT NULL,
  status public.cte_emission_status NOT NULL DEFAULT 'draft',
  tomador_tipo SMALLINT NOT NULL CHECK (tomador_tipo BETWEEN 0 AND 4),
  cfop INT NOT NULL,
  chave_cte TEXT,
  protocolo TEXT,
  status_sefaz TEXT,
  data_autorizacao TIMESTAMPTZ,
  data_cancelamento TIMESTAMPTZ,
  justificativa_cancelamento TEXT,
  xml_storage_path TEXT,
  dacte_storage_path TEXT,
  rejection_code TEXT,
  rejection_msg TEXT,
  payload_sent JSONB NOT NULL,
  response_received JSONB,
  focus_id TEXT,
  retry_count SMALLINT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ambiente, serie, numero)
);

CREATE INDEX IF NOT EXISTS idx_cte_emissions_status ON public.cte_emissions(status);
CREATE INDEX IF NOT EXISTS idx_cte_emissions_order ON public.cte_emissions(order_id);
CREATE INDEX IF NOT EXISTS idx_cte_emissions_quote ON public.cte_emissions(quote_id);
CREATE INDEX IF NOT EXISTS idx_cte_emissions_chave ON public.cte_emissions(chave_cte);
CREATE INDEX IF NOT EXISTS idx_cte_emissions_created ON public.cte_emissions(created_at DESC);

-- =====================================================
-- mdfe_emissions: one row per MDF-e issuance attempt
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mdfe_emissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref TEXT NOT NULL UNIQUE,
  ambiente public.focus_ambiente NOT NULL,
  serie INT NOT NULL,
  numero BIGINT NOT NULL,
  status public.mdfe_emission_status NOT NULL DEFAULT 'draft',
  vehicle_id UUID REFERENCES public.vehicles(id),
  driver_id UUID REFERENCES public.drivers(id),
  uf_inicio CHAR(2) NOT NULL,
  uf_fim CHAR(2) NOT NULL,
  chave_mdfe TEXT,
  protocolo TEXT,
  status_sefaz TEXT,
  data_autorizacao TIMESTAMPTZ,
  encerrado_at TIMESTAMPTZ,
  municipio_descarga_ibge INT,
  cancelled_at TIMESTAMPTZ,
  justificativa_cancelamento TEXT,
  rejection_code TEXT,
  rejection_msg TEXT,
  xml_storage_path TEXT,
  damdfe_storage_path TEXT,
  payload_sent JSONB NOT NULL,
  response_received JSONB,
  focus_id TEXT,
  retry_count SMALLINT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ambiente, serie, numero)
);

CREATE INDEX IF NOT EXISTS idx_mdfe_emissions_status ON public.mdfe_emissions(status);
CREATE INDEX IF NOT EXISTS idx_mdfe_emissions_vehicle ON public.mdfe_emissions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_mdfe_emissions_driver ON public.mdfe_emissions(driver_id);
CREATE INDEX IF NOT EXISTS idx_mdfe_emissions_chave ON public.mdfe_emissions(chave_mdfe);
CREATE INDEX IF NOT EXISTS idx_mdfe_emissions_created ON public.mdfe_emissions(created_at DESC);

-- =====================================================
-- mdfe_cte_link: N CT-es per MDF-e
-- =====================================================
CREATE TABLE IF NOT EXISTS public.mdfe_cte_link (
  mdfe_id UUID NOT NULL REFERENCES public.mdfe_emissions(id) ON DELETE CASCADE,
  cte_emission_id UUID NOT NULL REFERENCES public.cte_emissions(id) ON DELETE RESTRICT,
  PRIMARY KEY (mdfe_id, cte_emission_id)
);

CREATE INDEX IF NOT EXISTS idx_mdfe_cte_link_cte ON public.mdfe_cte_link(cte_emission_id);

-- =====================================================
-- Triggers updated_at
-- =====================================================
DROP TRIGGER IF EXISTS update_cte_emissions_updated_at ON public.cte_emissions;
CREATE TRIGGER update_cte_emissions_updated_at
  BEFORE UPDATE ON public.cte_emissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_mdfe_emissions_updated_at ON public.mdfe_emissions;
CREATE TRIGGER update_mdfe_emissions_updated_at
  BEFORE UPDATE ON public.mdfe_emissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.cte_emissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mdfe_emissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mdfe_cte_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cte_sequence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mdfe_sequence ENABLE ROW LEVEL SECURITY;

-- cte_emissions
CREATE POLICY "cte_emissions_select_authorized" ON public.cte_emissions
  FOR SELECT TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro','operacional','comercial']::public.user_profile[]));

CREATE POLICY "cte_emissions_manage_admin_financeiro" ON public.cte_emissions
  FOR ALL TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]))
  WITH CHECK (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

-- mdfe_emissions
CREATE POLICY "mdfe_emissions_select_authorized" ON public.mdfe_emissions
  FOR SELECT TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro','operacional']::public.user_profile[]));

CREATE POLICY "mdfe_emissions_manage_admin_financeiro" ON public.mdfe_emissions
  FOR ALL TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]))
  WITH CHECK (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

-- mdfe_cte_link
CREATE POLICY "mdfe_cte_link_select_authorized" ON public.mdfe_cte_link
  FOR SELECT TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro','operacional']::public.user_profile[]));

CREATE POLICY "mdfe_cte_link_manage_admin_financeiro" ON public.mdfe_cte_link
  FOR ALL TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]))
  WITH CHECK (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

-- sequences (read-only via UI; writes go through SECURITY DEFINER functions)
CREATE POLICY "cte_sequence_select_admin_financeiro" ON public.cte_sequence
  FOR SELECT TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

CREATE POLICY "mdfe_sequence_select_admin_financeiro" ON public.mdfe_sequence
  FOR SELECT TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

-- =====================================================
-- RPCs: next_cte_numero / next_mdfe_numero (atomic allocation)
-- =====================================================
CREATE OR REPLACE FUNCTION public.next_cte_numero(
  p_ambiente public.focus_ambiente,
  p_serie INT DEFAULT 1
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero BIGINT;
BEGIN
  -- Ensure row exists (idempotent)
  INSERT INTO public.cte_sequence (ambiente, serie)
  VALUES (p_ambiente, p_serie)
  ON CONFLICT DO NOTHING;

  UPDATE public.cte_sequence
  SET last_numero = last_numero + 1
  WHERE ambiente = p_ambiente AND serie = p_serie
  RETURNING last_numero INTO v_numero;

  IF v_numero IS NULL THEN
    RAISE EXCEPTION 'cte_sequence allocation failed for ambiente=% serie=%', p_ambiente, p_serie;
  END IF;

  RETURN v_numero;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_mdfe_numero(
  p_ambiente public.focus_ambiente,
  p_serie INT DEFAULT 1
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numero BIGINT;
BEGIN
  INSERT INTO public.mdfe_sequence (ambiente, serie)
  VALUES (p_ambiente, p_serie)
  ON CONFLICT DO NOTHING;

  UPDATE public.mdfe_sequence
  SET last_numero = last_numero + 1
  WHERE ambiente = p_ambiente AND serie = p_serie
  RETURNING last_numero INTO v_numero;

  IF v_numero IS NULL THEN
    RAISE EXCEPTION 'mdfe_sequence allocation failed for ambiente=% serie=%', p_ambiente, p_serie;
  END IF;

  RETURN v_numero;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_cte_numero(public.focus_ambiente, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_mdfe_numero(public.focus_ambiente, INT) TO authenticated, service_role;

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE public.cte_emissions IS 'CT-e (modelo 57) issuance attempts via Focus NFe. One row per issuance; lifecycle status tracked in `status` column.';
COMMENT ON TABLE public.mdfe_emissions IS 'MDF-e (modelo 58) issuance attempts via Focus NFe. Aggregates N CT-es via mdfe_cte_link.';
COMMENT ON COLUMN public.cte_emissions.tomador_tipo IS '0=Remetente, 1=Expedidor, 2=Recebedor, 3=Destinatário, 4=Outros';
COMMENT ON COLUMN public.cte_emissions.ref IS 'Reference sent to Focus NFe (idempotency key). Format: CFN-CTE-<order_code>-r<retry>';
COMMENT ON COLUMN public.cte_emissions.payload_sent IS 'Full Focus NFe payload — audit trail';
COMMENT ON COLUMN public.cte_emissions.response_received IS 'Webhook payload — populated by focus-webhook edge function';
