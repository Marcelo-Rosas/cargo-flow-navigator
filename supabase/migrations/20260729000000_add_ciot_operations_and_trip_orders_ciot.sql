-- ============================================
-- CIOT Operations Table & Trip Orders Extension
-- ============================================

-- Tabela principal de operações CIOT
CREATE TABLE IF NOT EXISTS public.ciot_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID REFERENCES public.trip_orders(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  ciot_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'cancelled', 'error', 'validation_failed')),
  ambiente TEXT NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao', 'producao')),
  payload JSONB NOT NULL DEFAULT '{}',
  raw_response JSONB,
  error_message TEXT,
  antt_piso_minimo NUMERIC(12,2),
  below_floor BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.ciot_operations IS 'Registro de geração/consulta/encerramento de CIOT na ANTT';

-- Índices
CREATE INDEX IF NOT EXISTS idx_ciot_operations_service_order_id ON public.ciot_operations(service_order_id);
CREATE INDEX IF NOT EXISTS idx_ciot_operations_quote_id ON public.ciot_operations(quote_id);
CREATE INDEX IF NOT EXISTS idx_ciot_operations_status ON public.ciot_operations(status);
CREATE INDEX IF NOT EXISTS idx_ciot_operations_ciot_number ON public.ciot_operations(ciot_number);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_ciot_operations_updated_at ON public.ciot_operations;
CREATE TRIGGER set_ciot_operations_updated_at
  BEFORE UPDATE ON public.ciot_operations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Extensão da tabela trip_orders para CIOT
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ciot_number TEXT,
  ADD COLUMN IF NOT EXISTS ciot_status TEXT CHECK (ciot_status IN ('pending', 'generated', 'cancelled', 'error'));

CREATE INDEX IF NOT EXISTS idx_orders_ciot_status ON public.orders(ciot_status);

-- RLS Policies
ALTER TABLE public.ciot_operations ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem ler
DROP POLICY IF EXISTS "Allow authenticated read" ON public.ciot_operations;
CREATE POLICY "Allow authenticated read"
  ON public.ciot_operations
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: usuários autenticados podem inserir (vinculado ao seu próprio registro)
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.ciot_operations;
CREATE POLICY "Allow authenticated insert"
  ON public.ciot_operations
  FOR INSERT
  TO authenticated
  WITH CHECK ( (select auth.uid()) = created_by );

-- Política: usuários autenticados podem atualizar seus próprios registros
DROP POLICY IF EXISTS "Allow authenticated update own" ON public.ciot_operations;
CREATE POLICY "Allow authenticated update own"
  ON public.ciot_operations
  FOR UPDATE
  TO authenticated
  USING ( (select auth.uid()) = created_by )
  WITH CHECK ( (select auth.uid()) = created_by );

-- Política: service_role tem acesso total (Edge Functions)
DROP POLICY IF EXISTS "Allow service_role all" ON public.ciot_operations;
CREATE POLICY "Allow service_role all"
  ON public.ciot_operations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
