-- ═══════════════════════════════════════════════════════
-- market_indices — Snapshot semanal consolidado
-- Alimentado pelo agente NTC (cowork) via ntc-ingest Edge Function
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.market_indices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_referencia TEXT NOT NULL UNIQUE,   -- ex: "Março/2026"
  gerado_em       DATE NOT NULL,

  -- INCTF
  inctf_mensal    NUMERIC(8,4),
  inctf_acumulado NUMERIC(8,4),

  -- INCTL por faixa de distância
  inctl_mensal    NUMERIC(8,4),
  inctl_acumulado NUMERIC(8,4),
  inctl_por_faixa JSONB DEFAULT '{}',       -- { "50km": 1.23, "400km": 2.34, ... }

  -- Diesel
  diesel_s10      NUMERIC(6,4),
  diesel_s500     NUMERIC(6,4),
  diesel_variacao_mensal  NUMERIC(6,2),
  diesel_variacao_anual   NUMERIC(6,2),

  -- Reajuste sugerido pelo agente
  reajuste_sugerido       NUMERIC(6,2),
  alerta_reajuste         TEXT CHECK (alerta_reajuste IN ('estavel', 'atencao', 'urgente')),
  justificativa_reajuste  TEXT,

  -- Metadados do agente
  fonte           TEXT DEFAULT 'ntc-agent',
  agente_versao   TEXT,
  relatorio_url   TEXT,
  raw_payload     JSONB,

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_market_indices_periodo ON public.market_indices (periodo_referencia);
CREATE INDEX IF NOT EXISTS idx_market_indices_gerado  ON public.market_indices (gerado_em DESC);

-- RLS
ALTER TABLE public.market_indices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública para autenticados"
  ON public.market_indices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Insert/update via service role"
  ON public.market_indices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_market_indices_updated_at
  BEFORE UPDATE ON public.market_indices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
