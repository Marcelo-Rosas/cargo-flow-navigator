-- Identifica cotações de lotação com value abaixo do Piso ANTT vigente.
-- Read-only. Exportar como CSV para compliance.
--
-- Uso: psql -f scripts/audit-antt-floor.sql -o antt_violations.csv --csv

SELECT
  q.id,
  q.quote_code,
  q.client_name,
  q.stage,
  q.value                                       AS valor_atual,
  (q.pricing_breakdown->'meta'->>'anttPisoCarreteiro')::numeric AS piso_no_breakdown,
  q.value - (q.pricing_breakdown->'meta'->>'anttPisoCarreteiro')::numeric AS gap,
  (q.pricing_breakdown->>'calculatedAt')        AS breakdown_calculado_em,
  pt.modality,
  q.km_distance,
  vt.axes_count,
  q.created_at,
  q.updated_at
FROM quotes q
LEFT JOIN price_tables  pt ON pt.id = q.price_table_id
LEFT JOIN vehicle_types vt ON vt.id = q.vehicle_type_id
WHERE pt.modality = 'lotacao'
  AND q.stage IN ('precificacao', 'enviado', 'negociacao', 'ganho', 'aprovado')
  AND (q.pricing_breakdown->'meta'->>'anttPisoCarreteiro') IS NOT NULL
  AND q.value < (q.pricing_breakdown->'meta'->>'anttPisoCarreteiro')::numeric
ORDER BY gap ASC;
