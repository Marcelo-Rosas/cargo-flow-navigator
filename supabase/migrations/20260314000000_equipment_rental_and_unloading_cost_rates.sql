-- Tabela de Aluguel de Máquinas e Equipamentos
CREATE TABLE IF NOT EXISTS public.equipment_rental_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  unit text NOT NULL DEFAULT 'dia',
  value numeric(12, 2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  valid_from date,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de Custo de Descarga
CREATE TABLE IF NOT EXISTS public.unloading_cost_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  unit text NOT NULL DEFAULT 'unidade',
  value numeric(12, 2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  valid_from date,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.equipment_rental_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unloading_cost_rates ENABLE ROW LEVEL SECURITY;

-- Leitura para usuários autenticados
CREATE POLICY "equipment_rental_rates_select_authenticated"
  ON public.equipment_rental_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "unloading_cost_rates_select_authenticated"
  ON public.unloading_cost_rates FOR SELECT
  TO authenticated
  USING (true);

-- Administração para service_role
CREATE POLICY "equipment_rental_rates_all_service_role"
  ON public.equipment_rental_rates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "unloading_cost_rates_all_service_role"
  ON public.unloading_cost_rates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Autenticados podem gerenciar (controle de UI no app)
CREATE POLICY "equipment_rental_rates_all_authenticated"
  ON public.equipment_rental_rates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "unloading_cost_rates_all_authenticated"
  ON public.unloading_cost_rates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Dados iniciais: Aluguel
INSERT INTO public.equipment_rental_rates (name, code, unit, value) VALUES
  ('Empilhadeira', 'empilhadeira', 'dia', 0),
  ('Munck', 'munck', 'dia', 0),
  ('Paleteira', 'paleteira', 'dia', 0)
ON CONFLICT (code) DO NOTHING;

-- Dados iniciais: Descarga
INSERT INTO public.unloading_cost_rates (name, code, unit, value) VALUES
  ('Chapa', 'chapa', 'unidade', 0)
ON CONFLICT (code) DO NOTHING;
