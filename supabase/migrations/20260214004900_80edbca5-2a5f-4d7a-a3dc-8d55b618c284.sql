
-- =====================================================
-- MIGRATION: Tabelas de configuração para qualificação
-- =====================================================

BEGIN;

-- Verificar dependências de roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    RAISE EXCEPTION 'Dependência app_role não encontrada';
  END IF;
END $$;

-- =====================================================
-- 1. TABELA: discharge_checklist_items
-- =====================================================

CREATE TABLE IF NOT EXISTS public.discharge_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.discharge_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view discharge_checklist_items"
  ON public.discharge_checklist_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and Operacao can insert discharge_checklist_items"
  ON public.discharge_checklist_items FOR INSERT
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

CREATE POLICY "Admin and Operacao can update discharge_checklist_items"
  ON public.discharge_checklist_items FOR UPDATE
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

CREATE POLICY "Admin can delete discharge_checklist_items"
  ON public.discharge_checklist_items FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_discharge_checklist_items_updated_at
  BEFORE UPDATE ON public.discharge_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 2. TABELA: delivery_conditions
-- =====================================================

CREATE TABLE IF NOT EXISTS public.delivery_conditions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view delivery_conditions"
  ON public.delivery_conditions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and Operacao can insert delivery_conditions"
  ON public.delivery_conditions FOR INSERT
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

CREATE POLICY "Admin and Operacao can update delivery_conditions"
  ON public.delivery_conditions FOR UPDATE
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operacao'::app_role]));

CREATE POLICY "Admin can delete delivery_conditions"
  ON public.delivery_conditions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_delivery_conditions_updated_at
  BEFORE UPDATE ON public.delivery_conditions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 3. ADICIONAR COLUNAS NA TABELA QUOTES
-- =====================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS delivery_conditions_selected JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS discharge_checklist_selected JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- =====================================================
-- 4. SEED: Itens padrão de condições de entrega
-- =====================================================

INSERT INTO public.delivery_conditions (label, description, sort_order) VALUES
  ('Dock disponível', 'Local possui doca para descarga', 1),
  ('Empilhadeira no local', 'Empilhadeira disponível para descarga', 2),
  ('Horário restrito', 'Restrição de horário para entrega', 3),
  ('Agendamento obrigatório', 'Necessário agendar previamente', 4),
  ('Acesso restrito', 'Restrições de acesso ao local de entrega', 5),
  ('Paletizado', 'Carga deve estar paletizada', 6);

-- =====================================================
-- 5. SEED: Itens padrão de checklist de descarga
-- =====================================================

INSERT INTO public.discharge_checklist_items (label, description, sort_order) VALUES
  ('Conferência de volumes', 'Conferir quantidade de volumes na descarga', 1),
  ('Verificar avarias', 'Inspecionar mercadoria por danos visíveis', 2),
  ('Canhoto assinado', 'Coletar canhoto da NF-e assinado pelo recebedor', 3),
  ('Foto da entrega', 'Registrar foto da mercadoria entregue', 4),
  ('Identificação do recebedor', 'Registrar nome e documento do recebedor', 5);

COMMIT;
