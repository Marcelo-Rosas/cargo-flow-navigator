-- =============================================
-- SHIPPERS TABLE (Embarcadores)
-- =============================================
CREATE TABLE IF NOT EXISTS public.shippers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cnpj TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shippers ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_shippers_updated_at
  BEFORE UPDATE ON public.shippers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies (same pattern as clients)
CREATE POLICY "Authenticated users can view shippers"
  ON public.shippers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Comercial and Admin can create shippers"
  ON public.shippers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'comercial']::app_role[]));

CREATE POLICY "Comercial and Admin can update shippers"
  ON public.shippers FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'comercial']::app_role[]));

CREATE POLICY "Admin can delete shippers"
  ON public.shippers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_shippers_name ON public.shippers(name);
