-- ============================================
-- FASE 1A: Schema de Precificação (Vectra Cargo)
-- ============================================

-- Verificar dependências de roles antes de prosseguir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    RAISE EXCEPTION 'Dependência não encontrada: tipo app_role não existe';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_any_role') THEN
    RAISE EXCEPTION 'Dependência não encontrada: função has_any_role não existe';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role') THEN
    RAISE EXCEPTION 'Dependência não encontrada: função has_role não existe';
  END IF;
END $$;

-- ============================================
-- 1) TABELA: price_tables
-- ============================================
CREATE TABLE IF NOT EXISTS public.price_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  modality text NOT NULL CHECK (modality IN ('lotacao', 'fracionado')),
  active boolean NOT NULL DEFAULT false,
  valid_from date NULL,
  valid_until date NULL,
  version integer NOT NULL DEFAULT 1,
  created_by uuid NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice parcial: apenas 1 tabela ativa por modalidade
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_tables_unique_active_modality
  ON public.price_tables (modality)
  WHERE active = true;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_price_tables_updated_at ON public.price_tables;
CREATE TRIGGER update_price_tables_updated_at
  BEFORE UPDATE ON public.price_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.price_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view price_tables" ON public.price_tables;
CREATE POLICY "Authenticated users can view price_tables"
  ON public.price_tables
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin and Operacao can insert price_tables" ON public.price_tables;
CREATE POLICY "Admin and Operacao can insert price_tables"
  ON public.price_tables
  FOR INSERT
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin and Operacao can update price_tables" ON public.price_tables;
CREATE POLICY "Admin and Operacao can update price_tables"
  ON public.price_tables
  FOR UPDATE
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin can delete price_tables" ON public.price_tables;
CREATE POLICY "Admin can delete price_tables"
  ON public.price_tables
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE public.price_tables IS 'Tabelas de preço de frete (Lotação/Fracionado)';
COMMENT ON COLUMN public.price_tables.modality IS 'Modalidade: lotacao ou fracionado';
COMMENT ON COLUMN public.price_tables.active IS 'Se true, é a tabela vigente para a modalidade';

-- ============================================
-- 2) TABELA: price_table_rows
-- ============================================
CREATE TABLE IF NOT EXISTS public.price_table_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_table_id uuid NOT NULL REFERENCES public.price_tables(id) ON DELETE CASCADE,
  km_from integer NOT NULL CHECK (km_from >= 0),
  km_to integer NOT NULL,
  cost_per_ton numeric NULL,
  cost_per_kg numeric NULL,
  cost_value_percent numeric NULL,
  gris_percent numeric NULL,
  tso_percent numeric NULL,
  toll_percent numeric NULL,
  ad_valorem_percent numeric NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_table_rows_km_range_check CHECK (km_to >= km_from),
  CONSTRAINT price_table_rows_unique_range UNIQUE (price_table_id, km_from, km_to)
);

-- RLS
ALTER TABLE public.price_table_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view price_table_rows" ON public.price_table_rows;
CREATE POLICY "Authenticated users can view price_table_rows"
  ON public.price_table_rows
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin and Operacao can insert price_table_rows" ON public.price_table_rows;
CREATE POLICY "Admin and Operacao can insert price_table_rows"
  ON public.price_table_rows
  FOR INSERT
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin and Operacao can update price_table_rows" ON public.price_table_rows;
CREATE POLICY "Admin and Operacao can update price_table_rows"
  ON public.price_table_rows
  FOR UPDATE
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin can delete price_table_rows" ON public.price_table_rows;
CREATE POLICY "Admin can delete price_table_rows"
  ON public.price_table_rows
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE public.price_table_rows IS 'Linhas de preço por faixa de KM';
COMMENT ON COLUMN public.price_table_rows.km_from IS 'KM inicial da faixa (inclusive)';
COMMENT ON COLUMN public.price_table_rows.km_to IS 'KM final da faixa (inclusive)';

-- ============================================
-- 3) TABELA: icms_rates
-- ============================================
CREATE TABLE IF NOT EXISTS public.icms_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_state char(2) NOT NULL,
  destination_state char(2) NOT NULL,
  rate_percent numeric NOT NULL CHECK (rate_percent >= 0 AND rate_percent <= 100),
  valid_from date NULL,
  valid_until date NULL,
  created_by uuid NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT icms_rates_origin_state_format CHECK (origin_state ~ '^[A-Z]{2}$'),
  CONSTRAINT icms_rates_destination_state_format CHECK (destination_state ~ '^[A-Z]{2}$'),
  CONSTRAINT icms_rates_unique_route UNIQUE (origin_state, destination_state, valid_from)
);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_icms_rates_updated_at ON public.icms_rates;
CREATE TRIGGER update_icms_rates_updated_at
  BEFORE UPDATE ON public.icms_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.icms_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view icms_rates" ON public.icms_rates;
CREATE POLICY "Authenticated users can view icms_rates"
  ON public.icms_rates
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin and Operacao can insert icms_rates" ON public.icms_rates;
CREATE POLICY "Admin and Operacao can insert icms_rates"
  ON public.icms_rates
  FOR INSERT
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin and Operacao can update icms_rates" ON public.icms_rates;
CREATE POLICY "Admin and Operacao can update icms_rates"
  ON public.icms_rates
  FOR UPDATE
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin can delete icms_rates" ON public.icms_rates;
CREATE POLICY "Admin can delete icms_rates"
  ON public.icms_rates
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE public.icms_rates IS 'Alíquotas de ICMS por UF origem x UF destino';
COMMENT ON COLUMN public.icms_rates.rate_percent IS 'Alíquota em percentual (0-100)';

-- ============================================
-- 4) ALTER TABLE quotes - Novas colunas
-- ============================================
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS price_table_id uuid NULL REFERENCES public.price_tables(id),
  ADD COLUMN IF NOT EXISTS freight_modality text NULL CHECK (freight_modality IN ('lotacao', 'fracionado')),
  ADD COLUMN IF NOT EXISTS cargo_value numeric NULL,
  ADD COLUMN IF NOT EXISTS km_distance integer NULL,
  ADD COLUMN IF NOT EXISTS pricing_breakdown jsonb NULL;

COMMENT ON COLUMN public.quotes.price_table_id IS 'FK para tabela de preço usada no cálculo';
COMMENT ON COLUMN public.quotes.freight_modality IS 'Modalidade: lotacao ou fracionado';
COMMENT ON COLUMN public.quotes.cargo_value IS 'Valor da mercadoria (para cálculo de ad valorem)';
COMMENT ON COLUMN public.quotes.km_distance IS 'Distância em KM usada no cálculo';
COMMENT ON COLUMN public.quotes.pricing_breakdown IS 'Snapshot JSONB do cálculo para auditoria';