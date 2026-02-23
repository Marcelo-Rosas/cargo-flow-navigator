-- =============================================================================
-- Sessão 9 — Migration: ANTT, vehicle_type_id, snapshot columns
-- Rodar no Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================================================

-- Garantir execução como owner das tabelas
SET ROLE postgres;

-- 1. Adicionar ANTT (RNTRC) na tabela drivers
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS antt text NULL;
COMMENT ON COLUMN public.drivers.antt IS 'Registro ANTT (RNTRC) do motorista';

-- 2. Adicionar vehicle_type_id na tabela vehicles (FK → vehicle_types)
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS vehicle_type_id uuid NULL
  REFERENCES public.vehicle_types(id);
CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_type_id ON public.vehicles(vehicle_type_id);

-- 3. Adicionar campos de snapshot ao orders (para persistir dados do veículo/motorista na OS)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS driver_cnh text,
  ADD COLUMN IF NOT EXISTS driver_antt text,
  ADD COLUMN IF NOT EXISTS vehicle_brand text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS vehicle_type_name text;

COMMENT ON COLUMN public.orders.driver_cnh IS 'Snapshot: CNH do motorista no momento da atribuição';
COMMENT ON COLUMN public.orders.driver_antt IS 'Snapshot: ANTT/RNTRC do motorista no momento da atribuição';
COMMENT ON COLUMN public.orders.vehicle_brand IS 'Snapshot: Marca do veículo no momento da atribuição';
COMMENT ON COLUMN public.orders.vehicle_model IS 'Snapshot: Modelo do veículo no momento da atribuição';
COMMENT ON COLUMN public.orders.vehicle_type_name IS 'Snapshot: Tipo de veículo no momento da atribuição';

-- 4. Garantir que o role authenticated tem acesso às colunas novas
-- (As policies de RLS já existem nas tabelas — só precisamos garantir GRANT nos novos campos)
GRANT SELECT, INSERT, UPDATE ON public.drivers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT SELECT ON public.vehicle_types TO authenticated;

-- Restaurar role padrão
RESET ROLE;
