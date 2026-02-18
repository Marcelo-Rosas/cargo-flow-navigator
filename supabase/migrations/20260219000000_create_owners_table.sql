-- =============================================
-- OWNERS TABLE (Proprietários)
-- =============================================
CREATE TABLE IF NOT EXISTS public.owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cpf_cnpj TEXT,
  rg TEXT,
  rg_emitter TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state VARCHAR(2),
  zip_code VARCHAR(10),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at (same as shippers)
CREATE TRIGGER update_owners_updated_at
  BEFORE UPDATE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies (same pattern as shippers)
CREATE POLICY "Authenticated users can view owners"
  ON public.owners FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Comercial and Admin can create owners"
  ON public.owners FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'comercial']::app_role[]));

CREATE POLICY "Comercial and Admin can update owners"
  ON public.owners FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'comercial']::app_role[]));

CREATE POLICY "Admin can delete owners"
  ON public.owners FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_owners_name ON public.owners(name);
CREATE INDEX idx_owners_active ON public.owners(active);
