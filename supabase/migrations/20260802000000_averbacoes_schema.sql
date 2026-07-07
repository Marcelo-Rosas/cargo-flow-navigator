-- =====================================================
-- Averbação de seguro de carga via Averba / AT&M (ATMWebSvr SOAP)
-- Tabela: averbacoes
-- Fonte: webserver.averba.com.br/20/index.soap
--   operações averbaCTe / averbaNFe / declaraMDFe → Retorno / RetornoMDFe
-- Reutiliza enum public.focus_ambiente (schema cte_mdfe_emissions).
-- =====================================================

-- ENUMs (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'averba_doc_type') THEN
    CREATE TYPE public.averba_doc_type AS ENUM ('cte', 'nfe', 'mdfe');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'averba_status') THEN
    CREATE TYPE public.averba_status AS ENUM (
      'pending', 'processing', 'averbado', 'declarado', 'erro'
    );
  END IF;
END$$;

-- =====================================================
-- averbacoes: uma linha por tentativa de averbação/declaração
-- =====================================================
CREATE TABLE IF NOT EXISTS public.averbacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vínculos (documento averbado)
  doc_type public.averba_doc_type NOT NULL,
  cte_emission_id UUID REFERENCES public.cte_emissions(id) ON DELETE RESTRICT,
  mdfe_emission_id UUID REFERENCES public.mdfe_emissions(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES public.orders(id),

  ambiente public.focus_ambiente NOT NULL,
  operacao TEXT NOT NULL,               -- 'averbaCTe' | 'averbaNFe' | 'declaraMDFe'
  status public.averba_status NOT NULL DEFAULT 'pending',

  -- Identificação do documento
  chave TEXT,                           -- chave de acesso (44 díg.) do CT-e/NF-e/MDF-e
  doc_numero TEXT,
  doc_serie TEXT,

  -- Sucesso — seguro da carga (Retorno.Averbado / DadosSeguro)
  numero_averbacao TEXT,
  protocolo TEXT,
  dh_averbacao TIMESTAMPTZ,
  cnpj_seguradora TEXT,
  nome_seguradora TEXT,
  num_apolice TEXT,
  valor_averbado NUMERIC(14, 2),
  ramo_averbado TEXT,
  tp_mov TEXT,
  tp_ddr TEXT,
  dados_seguro JSONB,                   -- array completo DadosSeguro (pode ter N apólices)

  -- Sucesso — Responsabilidade Civil (Retorno.AverbadoRCV)
  protocolo_rcv TEXT,
  id_viagem TEXT,                       -- amarra na Viagem/VG
  rcv_erro_codigo TEXT,
  rcv_erro_descricao TEXT,

  -- Erros (Retorno.Erros.Erro[])
  erro_codigo TEXT,
  erro_descricao TEXT,
  erros JSONB,                          -- array ErroProcesso {Codigo,Descricao,ValorEsperado,ValorInformado}
  infos JSONB,                          -- array InfoProcesso

  -- Auditoria (NUNCA persistir senha/usuario aqui)
  request_sent JSONB,                   -- payload enviado (sem credenciais)
  response_received JSONB,              -- Retorno / RetornoMDFe cru
  retry_count SMALLINT NOT NULL DEFAULT 0,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Pelo menos um vínculo de documento
  CONSTRAINT averbacoes_doc_ref_chk CHECK (
    cte_emission_id IS NOT NULL OR mdfe_emission_id IS NOT NULL OR chave IS NOT NULL
  )
);

-- Idempotência: um doc só averba/declara uma vez (por chave)
CREATE UNIQUE INDEX IF NOT EXISTS uq_averbacoes_averbado
  ON public.averbacoes (doc_type, chave)
  WHERE status IN ('averbado', 'declarado') AND chave IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_averbacoes_cte ON public.averbacoes(cte_emission_id);
CREATE INDEX IF NOT EXISTS idx_averbacoes_mdfe ON public.averbacoes(mdfe_emission_id);
CREATE INDEX IF NOT EXISTS idx_averbacoes_order ON public.averbacoes(order_id);
CREATE INDEX IF NOT EXISTS idx_averbacoes_chave ON public.averbacoes(chave);
CREATE INDEX IF NOT EXISTS idx_averbacoes_status ON public.averbacoes(status);
CREATE INDEX IF NOT EXISTS idx_averbacoes_created ON public.averbacoes(created_at DESC);

-- =====================================================
-- Trigger updated_at
-- =====================================================
DROP TRIGGER IF EXISTS update_averbacoes_updated_at ON public.averbacoes;
CREATE TRIGGER update_averbacoes_updated_at
  BEFORE UPDATE ON public.averbacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- RLS (espelha cte_emissions)
-- =====================================================
ALTER TABLE public.averbacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "averbacoes_select_authorized" ON public.averbacoes
  FOR SELECT TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro','operacional','comercial']::public.user_profile[]));

CREATE POLICY "averbacoes_manage_admin_financeiro" ON public.averbacoes
  FOR ALL TO authenticated
  USING (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]))
  WITH CHECK (public.has_profile(ARRAY['admin','financeiro']::public.user_profile[]));

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE public.averbacoes IS 'Averbação de seguro de carga via Averba/AT&M (ATMWebSvr SOAP). Uma linha por averbaCTe/averbaNFe/declaraMDFe.';
COMMENT ON COLUMN public.averbacoes.operacao IS 'Operação SOAP: averbaCTe | averbaNFe | declaraMDFe';
COMMENT ON COLUMN public.averbacoes.dados_seguro IS 'Retorno.Averbado.DadosSeguro[] — pode conter N apólices (ex.: RCTR-C + RC-DC)';
COMMENT ON COLUMN public.averbacoes.id_viagem IS 'Retorno.AverbadoRCV.IdViagem — vínculo com a Viagem/VG';
COMMENT ON COLUMN public.averbacoes.request_sent IS 'Payload enviado à Averba SEM credenciais (usuario/senha/codatm ficam em secrets da Edge Function)';
COMMENT ON COLUMN public.averbacoes.response_received IS 'Retorno/RetornoMDFe cru da Averba — trilha de auditoria';
