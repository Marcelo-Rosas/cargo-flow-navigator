-- =============================================================================
-- Mover capacity_kg/m3 de vehicle_types para vehicles + qtd_pallets
-- =============================================================================
-- Capacidade depende da configuracao real do bau (FECHADA, sider, frigorifico,
-- cabine estendida, etc.) — atributo do veiculo individual, nao do tipo.
-- qtd_pallets fica como override; o calculo automatico floor(capacity_m3/3.0)
-- mora no helper src/lib/pallets.ts (mantém o cadastro flexivel).
-- =============================================================================

-- 1. Adicionar colunas em vehicles
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS capacity_kg numeric NULL,
  ADD COLUMN IF NOT EXISTS capacity_m3 numeric NULL,
  ADD COLUMN IF NOT EXISTS qtd_pallets integer NULL;

COMMENT ON COLUMN public.vehicles.capacity_kg IS
  'Capacidade de carga em kg do veiculo individual';
COMMENT ON COLUMN public.vehicles.capacity_m3 IS
  'Volume util em m3 do veiculo individual (depende da configuracao real do bau)';
COMMENT ON COLUMN public.vehicles.qtd_pallets IS
  'Override manual da quantidade de pallets PBR (1m x 1,20m). NULL = usar calculo automatico floor(capacity_m3 / 3.0).';

-- 2. Backfill: copiar do vehicle_type para os veiculos
UPDATE public.vehicles v
SET
  capacity_kg = COALESCE(v.capacity_kg, vt.capacity_kg),
  capacity_m3 = COALESCE(v.capacity_m3, vt.capacity_m3)
FROM public.vehicle_types vt
WHERE v.vehicle_type_id = vt.id
  AND (v.capacity_kg IS NULL OR v.capacity_m3 IS NULL);

-- 3. Remover colunas de vehicle_types
ALTER TABLE public.vehicle_types
  DROP COLUMN IF EXISTS capacity_kg,
  DROP COLUMN IF EXISTS capacity_m3;
