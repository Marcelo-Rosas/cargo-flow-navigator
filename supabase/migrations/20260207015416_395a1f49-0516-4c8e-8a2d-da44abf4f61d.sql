-- =====================================================
-- PRICING RULES MIGRATION
-- Regras completas de precificação do referencial
-- =====================================================

-- Verificação de dependências
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    RAISE EXCEPTION 'Dependência ausente: tipo app_role não existe';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role') THEN
    RAISE EXCEPTION 'Dependência ausente: função has_role não existe';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_any_role') THEN
    RAISE EXCEPTION 'Dependência ausente: função has_any_role não existe';
  END IF;
END $$;

-- =====================================================
-- 1. PRICING PARAMETERS (parâmetros gerais)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.pricing_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value numeric NOT NULL,
  unit text,
  description text,
  valid_from date,
  valid_until date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_parameters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view pricing_parameters" ON public.pricing_parameters;
CREATE POLICY "Authenticated users can view pricing_parameters" ON public.pricing_parameters
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin and Operacao can insert pricing_parameters" ON public.pricing_parameters;
CREATE POLICY "Admin and Operacao can insert pricing_parameters" ON public.pricing_parameters
  FOR INSERT WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin and Operacao can update pricing_parameters" ON public.pricing_parameters;
CREATE POLICY "Admin and Operacao can update pricing_parameters" ON public.pricing_parameters
  FOR UPDATE USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin can delete pricing_parameters" ON public.pricing_parameters;
CREATE POLICY "Admin can delete pricing_parameters" ON public.pricing_parameters
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_pricing_parameters_updated_at
  BEFORE UPDATE ON public.pricing_parameters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 2. VEHICLE TYPES (tipos de veículo)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.vehicle_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  axes_count integer,
  capacity_kg numeric,
  capacity_m3 numeric,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view vehicle_types" ON public.vehicle_types;
CREATE POLICY "Authenticated users can view vehicle_types" ON public.vehicle_types
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin and Operacao can insert vehicle_types" ON public.vehicle_types;
CREATE POLICY "Admin and Operacao can insert vehicle_types" ON public.vehicle_types
  FOR INSERT WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin and Operacao can update vehicle_types" ON public.vehicle_types;
CREATE POLICY "Admin and Operacao can update vehicle_types" ON public.vehicle_types
  FOR UPDATE USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin can delete vehicle_types" ON public.vehicle_types;
CREATE POLICY "Admin can delete vehicle_types" ON public.vehicle_types
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_vehicle_types_updated_at
  BEFORE UPDATE ON public.vehicle_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 3. WAITING TIME RULES (estadia/hora parada)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.waiting_time_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type_id uuid REFERENCES public.vehicle_types(id) ON DELETE SET NULL,
  context text NOT NULL DEFAULT 'both' CHECK (context IN ('loading', 'unloading', 'both')),
  free_hours numeric NOT NULL DEFAULT 6,
  rate_per_hour numeric,
  rate_per_day numeric,
  min_charge numeric,
  valid_from date,
  valid_until date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waiting_time_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view waiting_time_rules" ON public.waiting_time_rules;
CREATE POLICY "Authenticated users can view waiting_time_rules" ON public.waiting_time_rules
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin and Operacao can insert waiting_time_rules" ON public.waiting_time_rules;
CREATE POLICY "Admin and Operacao can insert waiting_time_rules" ON public.waiting_time_rules
  FOR INSERT WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin and Operacao can update waiting_time_rules" ON public.waiting_time_rules;
CREATE POLICY "Admin and Operacao can update waiting_time_rules" ON public.waiting_time_rules
  FOR UPDATE USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin can delete waiting_time_rules" ON public.waiting_time_rules;
CREATE POLICY "Admin can delete waiting_time_rules" ON public.waiting_time_rules
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_waiting_time_rules_updated_at
  BEFORE UPDATE ON public.waiting_time_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 4. TOLL ROUTES (pedágio por rota)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.toll_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_state char(2) NOT NULL,
  origin_city text,
  destination_state char(2) NOT NULL,
  destination_city text,
  vehicle_type_id uuid REFERENCES public.vehicle_types(id) ON DELETE SET NULL,
  toll_value numeric NOT NULL,
  distance_km integer,
  via_description text,
  valid_from date,
  valid_until date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.toll_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view toll_routes" ON public.toll_routes;
CREATE POLICY "Authenticated users can view toll_routes" ON public.toll_routes
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin and Operacao can insert toll_routes" ON public.toll_routes;
CREATE POLICY "Admin and Operacao can insert toll_routes" ON public.toll_routes
  FOR INSERT WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin and Operacao can update toll_routes" ON public.toll_routes;
CREATE POLICY "Admin and Operacao can update toll_routes" ON public.toll_routes
  FOR UPDATE USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin can delete toll_routes" ON public.toll_routes;
CREATE POLICY "Admin can delete toll_routes" ON public.toll_routes
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_toll_routes_updated_at
  BEFORE UPDATE ON public.toll_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 5. TAC RATES (ajuste combustível)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tac_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_date date NOT NULL UNIQUE,
  diesel_price_base numeric NOT NULL,
  diesel_price_current numeric NOT NULL,
  variation_percent numeric GENERATED ALWAYS AS (
    CASE WHEN diesel_price_base > 0 
      THEN ROUND(((diesel_price_current - diesel_price_base) / diesel_price_base) * 100, 2)
      ELSE 0 
    END
  ) STORED,
  adjustment_percent numeric NOT NULL DEFAULT 0,
  source_description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tac_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view tac_rates" ON public.tac_rates;
CREATE POLICY "Authenticated users can view tac_rates" ON public.tac_rates
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin and Operacao can insert tac_rates" ON public.tac_rates;
CREATE POLICY "Admin and Operacao can insert tac_rates" ON public.tac_rates
  FOR INSERT WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin and Operacao can update tac_rates" ON public.tac_rates;
CREATE POLICY "Admin and Operacao can update tac_rates" ON public.tac_rates
  FOR UPDATE USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin can delete tac_rates" ON public.tac_rates;
CREATE POLICY "Admin can delete tac_rates" ON public.tac_rates
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_tac_rates_updated_at
  BEFORE UPDATE ON public.tac_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 6. CONDITIONAL FEES (taxas condicionais)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.conditional_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  fee_type text NOT NULL CHECK (fee_type IN ('percentage', 'fixed', 'per_kg')),
  fee_value numeric NOT NULL,
  min_value numeric,
  max_value numeric,
  applies_to text NOT NULL DEFAULT 'freight' CHECK (applies_to IN ('freight', 'cargo_value', 'total')),
  conditions jsonb,
  active boolean NOT NULL DEFAULT true,
  valid_from date,
  valid_until date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conditional_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view conditional_fees" ON public.conditional_fees;
CREATE POLICY "Authenticated users can view conditional_fees" ON public.conditional_fees
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin and Operacao can insert conditional_fees" ON public.conditional_fees;
CREATE POLICY "Admin and Operacao can insert conditional_fees" ON public.conditional_fees
  FOR INSERT WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin and Operacao can update conditional_fees" ON public.conditional_fees;
CREATE POLICY "Admin and Operacao can update conditional_fees" ON public.conditional_fees
  FOR UPDATE USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin can delete conditional_fees" ON public.conditional_fees;
CREATE POLICY "Admin can delete conditional_fees" ON public.conditional_fees
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_conditional_fees_updated_at
  BEFORE UPDATE ON public.conditional_fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 7. PAYMENT TERMS (prazo de pagamento)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payment_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  days integer NOT NULL,
  adjustment_percent numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view payment_terms" ON public.payment_terms;
CREATE POLICY "Authenticated users can view payment_terms" ON public.payment_terms
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin and Operacao can insert payment_terms" ON public.payment_terms;
CREATE POLICY "Admin and Operacao can insert payment_terms" ON public.payment_terms
  FOR INSERT WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin and Operacao can update payment_terms" ON public.payment_terms;
CREATE POLICY "Admin and Operacao can update payment_terms" ON public.payment_terms
  FOR UPDATE USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin can delete payment_terms" ON public.payment_terms;
CREATE POLICY "Admin can delete payment_terms" ON public.payment_terms
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_payment_terms_updated_at
  BEFORE UPDATE ON public.payment_terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 8. ALTER QUOTES (novas colunas)
-- =====================================================
ALTER TABLE public.quotes 
  ADD COLUMN IF NOT EXISTS vehicle_type_id uuid REFERENCES public.vehicle_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_term_id uuid REFERENCES public.payment_terms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cubage_weight numeric,
  ADD COLUMN IF NOT EXISTS billable_weight numeric,
  ADD COLUMN IF NOT EXISTS toll_value numeric,
  ADD COLUMN IF NOT EXISTS tac_percent numeric,
  ADD COLUMN IF NOT EXISTS waiting_time_cost numeric,
  ADD COLUMN IF NOT EXISTS conditional_fees_breakdown jsonb;

-- =====================================================
-- 9. ALTER ORDERS (novas colunas)
-- =====================================================
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS waiting_time_hours numeric,
  ADD COLUMN IF NOT EXISTS waiting_time_cost numeric;

-- =====================================================
-- 10. SEED DATA (dados iniciais)
-- =====================================================

-- Parâmetros gerais
INSERT INTO public.pricing_parameters (key, value, unit, description) VALUES
  ('cubage_factor', 300, 'kg/m3', 'Fator de cubagem padrão'),
  ('min_freight', 150, 'BRL', 'Frete mínimo'),
  ('insurance_min', 50, 'BRL', 'Seguro mínimo')
ON CONFLICT (key) DO NOTHING;

-- Tipos de veículo
INSERT INTO public.vehicle_types (code, name, axes_count, capacity_kg, capacity_m3) VALUES
  ('VUC', 'VUC (Veículo Urbano de Carga)', 2, 3500, 18),
  ('TOCO', 'Caminhão Toco', 2, 6000, 30),
  ('TRUCK', 'Caminhão Truck', 3, 14000, 45),
  ('BI_TRUCK', 'Bi-Truck', 4, 18000, 55),
  ('CARRETA_3', 'Carreta 3 Eixos', 5, 25000, 80),
  ('CARRETA_4', 'Carreta 4 Eixos (LS)', 6, 30000, 90),
  ('RODOTREM', 'Rodotrem', 9, 57000, 150)
ON CONFLICT (code) DO NOTHING;

-- Prazos de pagamento
INSERT INTO public.payment_terms (code, name, days, adjustment_percent) VALUES
  ('AVISTA', 'À Vista', 0, -2.0),
  ('D15', '15 dias', 15, 0.0),
  ('D30', '30 dias', 30, 1.5),
  ('D45', '45 dias', 45, 2.5),
  ('D60', '60 dias', 60, 3.5),
  ('D90', '90 dias', 90, 5.0)
ON CONFLICT (code) DO NOTHING;

-- Taxas condicionais
INSERT INTO public.conditional_fees (code, name, description, fee_type, fee_value, applies_to) VALUES
  ('TDE', 'Taxa Dificuldade Entrega', 'Entrega em local de difícil acesso', 'percentage', 10, 'freight'),
  ('TEAR', 'Taxa Entrega Agendada Restrita', 'Janela de entrega menor que 2 horas', 'fixed', 150, 'freight'),
  ('SCHEDULING', 'Taxa de Agendamento', 'Agendamento prévio obrigatório', 'fixed', 80, 'freight'),
  ('OFF_HOURS', 'Fora de Horário', 'Entrega fora do horário comercial', 'percentage', 15, 'freight'),
  ('RETURN', 'Devolução', 'Mercadoria devolvida ao remetente', 'percentage', 50, 'freight'),
  ('REDELIVERY', 'Reentrega', 'Segunda tentativa de entrega', 'percentage', 30, 'freight')
ON CONFLICT (code) DO NOTHING;

-- Regra padrão de estadia
INSERT INTO public.waiting_time_rules (vehicle_type_id, context, free_hours, rate_per_hour, min_charge)
SELECT NULL, 'both', 6, 50, 100
WHERE NOT EXISTS (SELECT 1 FROM public.waiting_time_rules WHERE vehicle_type_id IS NULL AND context = 'both');