-- Add source column to distinguish ANP historical data from API current prices
-- ANP records: fetched_at set to midnight UTC (date only) by the seed script
-- API records: fetched_at has actual timestamp from Edge Function

ALTER TABLE petrobras_diesel_prices
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'api';

-- Mark records inserted by our ANP seed (fetched_at is exactly midnight UTC)
UPDATE petrobras_diesel_prices
SET source = 'anp'
WHERE fetched_at = date_trunc('day', fetched_at);

-- Recreate the diesel-cost-by-route RPC to only use ANP source records
CREATE OR REPLACE FUNCTION get_diesel_cost_by_route(
  p_from date DEFAULT '2025-01-01',
  p_to   date DEFAULT NULL
)
RETURNS TABLE (
  rota             text,
  origin_uf        text,
  dest_uf          text,
  ctes             bigint,
  km_medio         numeric,
  diesel_orig      numeric,
  diesel_dest      numeric,
  media_rota       numeric,
  custo_por_km     numeric,
  diesel_total_medio numeric,
  diesel_total_soma  numeric,
  receita_media    numeric,
  pct_ticket       numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH cte_with_diesel AS (
    SELECT
      (regexp_match(o.origin,      '-\s+([A-Z]{2})[,\s]'))[1]      AS o_uf,
      (regexp_match(o.destination, '-\s+([A-Z]{2})[,\s]'))[1]      AS d_uf,
      o.km_distance,
      o.value,
      o.created_at::date                                            AS cte_date,
      orig_p.preco_medio                                            AS diesel_orig,
      dest_p.preco_medio                                            AS diesel_dest,
      (orig_p.preco_medio + dest_p.preco_medio) / 2                AS media_rota,
      o.km_distance * ((orig_p.preco_medio + dest_p.preco_medio) / 2 * 0.3) AS diesel_total
    FROM orders o
    -- ANP price for origin UF on/before CT-e date (source='anp' only)
    LEFT JOIN LATERAL (
      SELECT pdp.preco_medio
      FROM petrobras_diesel_prices pdp
      WHERE pdp.uf      = (regexp_match(o.origin, '-\s+([A-Z]{2})[,\s]'))[1]
        AND pdp.source  = 'anp'
        AND pdp.periodo_coleta::date <= o.created_at::date
      ORDER BY pdp.periodo_coleta::date DESC
      LIMIT 1
    ) orig_p ON true
    -- ANP price for destination UF on/before CT-e date (source='anp' only)
    LEFT JOIN LATERAL (
      SELECT pdp.preco_medio
      FROM petrobras_diesel_prices pdp
      WHERE pdp.uf      = (regexp_match(o.destination, '-\s+([A-Z]{2})[,\s]'))[1]
        AND pdp.source  = 'anp'
        AND pdp.periodo_coleta::date <= o.created_at::date
      ORDER BY pdp.periodo_coleta::date DESC
      LIMIT 1
    ) dest_p ON true
    WHERE o.has_cte = true
      AND o.km_distance > 0
      AND o.value > 0
      AND orig_p.preco_medio IS NOT NULL
      AND dest_p.preco_medio IS NOT NULL
      AND o.created_at::date >= p_from
      AND (p_to IS NULL OR o.created_at::date <= p_to)
  )
  SELECT
    cd.o_uf || ' → ' || cd.d_uf                    AS rota,
    cd.o_uf                                         AS origin_uf,
    cd.d_uf                                         AS dest_uf,
    COUNT(*)                                        AS ctes,
    ROUND(AVG(cd.km_distance)::numeric, 0)          AS km_medio,
    ROUND(AVG(cd.diesel_orig)::numeric, 3)          AS diesel_orig,
    ROUND(AVG(cd.diesel_dest)::numeric, 3)          AS diesel_dest,
    ROUND(AVG(cd.media_rota)::numeric, 3)           AS media_rota,
    ROUND((AVG(cd.media_rota) * 0.3)::numeric, 4)  AS custo_por_km,
    ROUND(AVG(cd.diesel_total)::numeric, 2)         AS diesel_total_medio,
    ROUND(SUM(cd.diesel_total)::numeric, 2)         AS diesel_total_soma,
    ROUND(AVG(cd.value)::numeric, 2)                AS receita_media,
    ROUND((AVG(cd.diesel_total) / NULLIF(AVG(cd.value), 0) * 100)::numeric, 1) AS pct_ticket
  FROM cte_with_diesel cd
  GROUP BY cd.o_uf, cd.d_uf
  ORDER BY diesel_total_soma DESC;
$$;

GRANT EXECUTE ON FUNCTION get_diesel_cost_by_route(date, date) TO authenticated;
