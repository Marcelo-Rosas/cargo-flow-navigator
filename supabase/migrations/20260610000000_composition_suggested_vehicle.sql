-- Composição de carga: veículo sugerido + peso/volume combinados
-- O tipo de caminhão é inferido pela soma de peso real das cotações (sem peso cubado).
-- Volume m³ é informativo para o operador validar capacidade do baú.

ALTER TABLE load_composition_suggestions
  ADD COLUMN IF NOT EXISTS suggested_vehicle_type_id uuid REFERENCES vehicle_types(id),
  ADD COLUMN IF NOT EXISTS suggested_vehicle_type_name text,
  ADD COLUMN IF NOT EXISTS suggested_axes_count smallint,
  ADD COLUMN IF NOT EXISTS total_combined_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS total_combined_volume_m3 numeric;

COMMENT ON COLUMN load_composition_suggestions.suggested_vehicle_type_id IS 'Menor veículo que comporta o peso total combinado';
COMMENT ON COLUMN load_composition_suggestions.suggested_axes_count IS 'Eixos do veículo sugerido — impacta pedágio';
COMMENT ON COLUMN load_composition_suggestions.total_combined_weight_kg IS 'Soma peso real (kg) das cotações, sem peso cubado';
COMMENT ON COLUMN load_composition_suggestions.total_combined_volume_m3 IS 'Soma volume real (m³) das cotações';
