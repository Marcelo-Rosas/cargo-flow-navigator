-- =====================================================
-- ANTT FLOOR RATES (Tabela A / Carga Geral - coeficientes CCD e CC)
-- Objetivo: parametrizar piso mínimo (carreteiro) no app sem hardcode.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.antt_floor_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Hoje o app vai usar sempre Tabela A e Carga Geral, mas deixamos extensível
  operation_table text NOT NULL CHECK (operation_table IN ('A', 'B', 'C', 'D')),
  cargo_type text NOT NULL,

  axes_count integer NOT NULL CHECK (axes_count > 0),
  ccd numeric NOT NULL CHECK (ccd >= 0), -- R$/km
  cc numeric NOT NULL CHECK (cc >= 0),   -- R$

  -- Vigência opcional (para atualizações futuras da ANTT)
  valid_from date,
  valid_until date,

  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- NOTE: expression-based uniqueness (COALESCE(valid_from,...)) cannot be used in a table UNIQUE constraint.
  -- We'll create an expression index below.
);

-- Unicidade por (tabela, tipo de carga, eixos, vigência)
-- Observação: UNIQUE permite múltiplos NULLs em valid_from. Se você quiser bloquear isso,
-- podemos trocar por um índice único por expressão (COALESCE) depois.
CREATE UNIQUE INDEX IF NOT EXISTS antt_floor_rates_unique
  ON public.antt_floor_rates (operation_table, cargo_type, axes_count, valid_from);

ALTER TABLE public.antt_floor_rates ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado
DROP POLICY IF EXISTS "Authenticated users can view antt_floor_rates" ON public.antt_floor_rates;
CREATE POLICY "Authenticated users can view antt_floor_rates" ON public.antt_floor_rates
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Escrita: admin/operacao (ajuste conforme sua governança)
DROP POLICY IF EXISTS "Admin and Operacao can insert antt_floor_rates" ON public.antt_floor_rates;
CREATE POLICY "Admin and Operacao can insert antt_floor_rates" ON public.antt_floor_rates
  FOR INSERT WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin and Operacao can update antt_floor_rates" ON public.antt_floor_rates;
CREATE POLICY "Admin and Operacao can update antt_floor_rates" ON public.antt_floor_rates
  FOR UPDATE USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

DROP POLICY IF EXISTS "Admin can delete antt_floor_rates" ON public.antt_floor_rates;
CREATE POLICY "Admin can delete antt_floor_rates" ON public.antt_floor_rates
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger (reusa função já existente)
DROP TRIGGER IF EXISTS update_antt_floor_rates_updated_at ON public.antt_floor_rates;
CREATE TRIGGER update_antt_floor_rates_updated_at
  BEFORE UPDATE ON public.antt_floor_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
