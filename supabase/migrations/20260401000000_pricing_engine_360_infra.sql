-- Motor de Precificação 360° - Infraestrutura de Dados
-- Fase 1: Alinhamento AILOG/ANTT + Central de Regras de Precificação

-- 1. Alinhamento com Categorias AILOG/ANTT
ALTER TABLE public.vehicle_types 
  ADD COLUMN IF NOT EXISTS ailog_category text,
  ADD COLUMN IF NOT EXISTS rolling_type text DEFAULT 'dupla',
  ADD COLUMN IF NOT EXISTS vehicle_profile text DEFAULT 'CAMINHAO';

-- Seed de Mapeamento (Categorias Oficiais AILOG)
UPDATE public.vehicle_types SET ailog_category = '2', rolling_type = 'dupla' WHERE code IN ('TOCO', 'VUC');
UPDATE public.vehicle_types SET ailog_category = '4', rolling_type = 'dupla' WHERE code = 'TRUCK';
UPDATE public.vehicle_types SET ailog_category = '6', rolling_type = 'dupla' WHERE code = 'BI_TRUCK';
UPDATE public.vehicle_types SET ailog_category = '7', rolling_type = 'dupla' WHERE code = 'CARRETA_3';
UPDATE public.vehicle_types SET ailog_category = '8', rolling_type = 'dupla' WHERE code = 'CARRETA_4';
UPDATE public.vehicle_types SET ailog_category = '12', rolling_type = 'dupla' WHERE code = 'RODOTREM';

-- Garantir axes_count NOT NULL para tipos sem mapeamento explícito
UPDATE public.vehicle_types SET axes_count = COALESCE(axes_count, 6) WHERE axes_count IS NULL;
ALTER TABLE public.vehicle_types ALTER COLUMN axes_count SET NOT NULL;

-- 2. Central de Regras de Precificação
DO $$ BEGIN
  CREATE TYPE pricing_rule_category AS ENUM ('taxa', 'estadia', 'veiculo', 'markup', 'imposto', 'prazo');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE pricing_rule_value_type AS ENUM ('fixed', 'percentage', 'per_km', 'per_ton');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.pricing_rules_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL,
    label text NOT NULL,
    category pricing_rule_category NOT NULL,
    value_type pricing_rule_value_type NOT NULL,
    value numeric(15,4) NOT NULL,
    min_value numeric(15,4),
    max_value numeric(15,4),
    vehicle_type_id uuid REFERENCES public.vehicle_types(id) ON DELETE SET NULL,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}',
    updated_at timestamptz DEFAULT now(),
    UNIQUE NULLS NOT DISTINCT (key, vehicle_type_id)
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_lookup 
  ON public.pricing_rules_config(key, vehicle_type_id) 
  WHERE is_active = true;

-- RLS
ALTER TABLE public.pricing_rules_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pricing_rules_select" ON public.pricing_rules_config;
CREATE POLICY "pricing_rules_select" ON public.pricing_rules_config 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pricing_rules_insert" ON public.pricing_rules_config;
CREATE POLICY "pricing_rules_insert" ON public.pricing_rules_config 
  FOR INSERT TO authenticated WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));

DROP POLICY IF EXISTS "pricing_rules_update" ON public.pricing_rules_config;
CREATE POLICY "pricing_rules_update" ON public.pricing_rules_config 
  FOR UPDATE TO authenticated USING (public.has_profile(ARRAY['admin','operacional']::public.user_profile[])) 
  WITH CHECK (public.has_profile(ARRAY['admin','operacional']::public.user_profile[]));

DROP POLICY IF EXISTS "pricing_rules_delete" ON public.pricing_rules_config;
CREATE POLICY "pricing_rules_delete" ON public.pricing_rules_config 
  FOR DELETE TO authenticated USING (public.is_admin());

-- Seed de regras globais (fallback para motor)
INSERT INTO public.pricing_rules_config (key, label, category, value_type, value, min_value, max_value, vehicle_type_id) VALUES
  ('das_percent', 'DAS (%)', 'imposto', 'percentage', 14, 0, 30, NULL),
  ('markup_percent', 'Markup (%)', 'markup', 'percentage', 30, 0, 100, NULL),
  ('overhead_percent', 'Overhead (%)', 'markup', 'percentage', 15, 0, 50, NULL),
  ('tde_percent', 'TDE NTC (%)', 'taxa', 'percentage', 20, 0, 100, NULL),
  ('tear_percent', 'TEAR NTC (%)', 'taxa', 'percentage', 20, 0, 100, NULL),
  ('icms_uf_sp', 'ICMS SP (%)', 'imposto', 'percentage', 18, 0, 25, NULL),
  ('icms_uf_rj', 'ICMS RJ (%)', 'imposto', 'percentage', 20, 0, 25, NULL),
  ('icms_uf_mg', 'ICMS MG (%)', 'imposto', 'percentage', 18, 0, 25, NULL),
  ('icms_uf_pr', 'ICMS PR (%)', 'imposto', 'percentage', 18, 0, 25, NULL),
  ('icms_uf_rs', 'ICMS RS (%)', 'imposto', 'percentage', 18, 0, 25, NULL),
  ('icms_uf_sc', 'ICMS SC (%)', 'imposto', 'percentage', 17, 0, 25, NULL),
  ('icms_default', 'ICMS padrão (%)', 'imposto', 'percentage', 12, 0, 25, NULL)
ON CONFLICT (key, vehicle_type_id) DO NOTHING;
