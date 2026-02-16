-- Corrige find_price_row_by_km: borda superior INCLUSIVA (km_to >= v_km)
-- Para bater com as faixas do projeto (KM inicial e final inclusive)
-- Antes: km_to > v_km (exclusivo) — não encontrava faixas tipo [1501, 1719]
-- Depois: km_to >= v_km (inclusivo)
CREATE OR REPLACE FUNCTION public.find_price_row_by_km(
  p_price_table_id uuid,
  p_km_numeric numeric,
  p_rounding text DEFAULT 'ceil'
)
RETURNS TABLE (
  id uuid,
  km_from integer,
  km_to integer,
  cost_per_ton numeric,
  matched_km integer
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_km integer;
BEGIN
  IF p_rounding = 'floor' THEN
    v_km := FLOOR(p_km_numeric)::int;
  ELSIF p_rounding = 'round' THEN
    v_km := ROUND(p_km_numeric)::int;
  ELSE
    v_km := CEILING(p_km_numeric)::int;
  END IF;

  RETURN QUERY
  SELECT r.id, r.km_from, r.km_to, r.cost_per_ton, v_km AS matched_km
  FROM public.price_table_rows r
  WHERE r.price_table_id = p_price_table_id
    AND r.km_from <= v_km
    AND r.km_to >= v_km   -- INCLUSIVO: inclui o limite superior
  ORDER BY r.km_from DESC
  LIMIT 1;
END;
$$;

-- Create composite index to speed up lookups by table and km range
CREATE INDEX IF NOT EXISTS idx_price_table_rows_table_km_range
  ON public.price_table_rows (price_table_id, km_from, km_to);
