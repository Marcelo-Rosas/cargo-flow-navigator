-- =============================================
-- CRM VECTRA CARGO - DATABASE SCHEMA
-- =============================================

-- 1. Create ENUM for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'comercial', 'operacao', 'fiscal', 'leitura');

-- 2. Create ENUM for quote stages
CREATE TYPE public.quote_stage AS ENUM (
  'novo_pedido', 
  'qualificacao', 
  'precificacao', 
  'enviado', 
  'negociacao', 
  'ganho', 
  'perdido'
);

-- 3. Create ENUM for order stages
CREATE TYPE public.order_stage AS ENUM (
  'ordem_criada', 
  'busca_motorista', 
  'documentacao', 
  'coleta_realizada', 
  'em_transito', 
  'entregue'
);

-- 4. Create ENUM for document types
CREATE TYPE public.document_type AS ENUM ('nfe', 'cte', 'pod', 'outros');

-- 5. Create ENUM for occurrence severity
CREATE TYPE public.occurrence_severity AS ENUM ('baixa', 'media', 'alta', 'critica');

-- =============================================
-- PROFILES TABLE
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- USER ROLES TABLE (separate for security)
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'leitura',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- CLIENTS TABLE
-- =============================================
CREATE TABLE public.clients (
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

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- =============================================
-- QUOTES TABLE (Cotações)
-- =============================================
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  value DECIMAL(12,2) NOT NULL DEFAULT 0,
  stage quote_stage NOT NULL DEFAULT 'novo_pedido',
  tags TEXT[] DEFAULT '{}',
  weight DECIMAL(10,2),
  volume DECIMAL(10,2),
  cargo_type TEXT,
  validity_date DATE,
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ORDERS TABLE (Ordens de Serviço)
-- =============================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_number TEXT NOT NULL UNIQUE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  value DECIMAL(12,2) NOT NULL DEFAULT 0,
  stage order_stage NOT NULL DEFAULT 'ordem_criada',
  driver_name TEXT,
  driver_phone TEXT,
  vehicle_plate TEXT,
  eta TIMESTAMPTZ,
  has_nfe BOOLEAN NOT NULL DEFAULT false,
  has_cte BOOLEAN NOT NULL DEFAULT false,
  has_pod BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- =============================================
-- DOCUMENTS TABLE
-- =============================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE,
  type document_type NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  nfe_key TEXT,
  validation_status TEXT DEFAULT 'pending',
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- =============================================
-- OCCURRENCES TABLE
-- =============================================
CREATE TABLE public.occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  severity occurrence_severity NOT NULL DEFAULT 'baixa',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.occurrences ENABLE ROW LEVEL SECURITY;

-- =============================================
-- AUDIT LOG TABLE
-- =============================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any of the specified roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- Function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'operacao' THEN 2
      WHEN 'comercial' THEN 3
      WHEN 'fiscal' THEN 4
      WHEN 'leitura' THEN 5
    END
  LIMIT 1
$$;

-- =============================================
-- TRIGGER FUNCTION FOR UPDATED_AT
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply trigger to all tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_occurrences_updated_at
  BEFORE UPDATE ON public.occurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TRIGGER FOR AUTO-CREATE PROFILE ON SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  
  -- Assign default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'leitura');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- FUNCTION FOR OS NUMBER GENERATION
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_os_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  year_part TEXT;
  next_seq INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(os_number FROM 'OS-\d{4}-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO next_seq
  FROM public.orders
  WHERE os_number LIKE 'OS-' || year_part || '-%';
  
  RETURN 'OS-' || year_part || '-' || LPAD(next_seq::TEXT, 4, '0');
END;
$$;

-- Trigger to auto-generate OS number
CREATE OR REPLACE FUNCTION public.set_os_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.os_number IS NULL OR NEW.os_number = '' THEN
    NEW.os_number := public.generate_os_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_order_os_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_os_number();

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- PROFILES POLICIES
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- USER ROLES POLICIES
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- CLIENTS POLICIES
CREATE POLICY "Authenticated users can view clients"
  ON public.clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Comercial and Admin can create clients"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'comercial']::app_role[]));

CREATE POLICY "Comercial and Admin can update clients"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'comercial']::app_role[]));

CREATE POLICY "Admin can delete clients"
  ON public.clients FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- QUOTES POLICIES
CREATE POLICY "Authenticated users can view quotes"
  ON public.quotes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Comercial and Admin can create quotes"
  ON public.quotes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'comercial']::app_role[]));

CREATE POLICY "Comercial and Admin can update quotes"
  ON public.quotes FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'comercial']::app_role[]));

CREATE POLICY "Admin can delete quotes"
  ON public.quotes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ORDERS POLICIES
CREATE POLICY "Authenticated users can view orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operacao, Comercial and Admin can create orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'comercial', 'operacao']::app_role[]));

CREATE POLICY "Operacao and Admin can update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'operacao']::app_role[]));

CREATE POLICY "Admin can delete orders"
  ON public.orders FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- DOCUMENTS POLICIES
CREATE POLICY "Authenticated users can view documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create documents"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Uploader and Admin can update documents"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = uploaded_by 
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admin can delete documents"
  ON public.documents FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- OCCURRENCES POLICIES
CREATE POLICY "Authenticated users can view occurrences"
  ON public.occurrences FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Operacao and Admin can create occurrences"
  ON public.occurrences FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'operacao']::app_role[]));

CREATE POLICY "Operacao and Admin can update occurrences"
  ON public.occurrences FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'operacao']::app_role[]));

CREATE POLICY "Admin can delete occurrences"
  ON public.occurrences FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- AUDIT LOGS POLICIES (Read only for admins)
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_quotes_stage ON public.quotes(stage);
CREATE INDEX idx_quotes_client_id ON public.quotes(client_id);
CREATE INDEX idx_quotes_created_by ON public.quotes(created_by);
CREATE INDEX idx_orders_stage ON public.orders(stage);
CREATE INDEX idx_orders_quote_id ON public.orders(quote_id);
CREATE INDEX idx_orders_client_id ON public.orders(client_id);
CREATE INDEX idx_orders_os_number ON public.orders(os_number);
CREATE INDEX idx_documents_order_id ON public.documents(order_id);
CREATE INDEX idx_documents_type ON public.documents(type);
CREATE INDEX idx_occurrences_order_id ON public.occurrences(order_id);
CREATE INDEX idx_occurrences_severity ON public.occurrences(severity);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);