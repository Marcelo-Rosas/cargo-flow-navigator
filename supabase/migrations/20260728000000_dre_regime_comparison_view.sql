-- View comparativa de regime tributário: Simples Nacional vs Lucro Presumido
-- Agrupa por mês/ano e regime fiscal, mostrando onde a tributação pesou mais.

CREATE OR REPLACE VIEW public.v_dre_regime_comparison AS
WITH monthly AS (
  SELECT
    DATE_TRUNC('month', q.created_at)::date AS month,
    TO_CHAR(DATE_TRUNC('month', q.created_at), 'YYYY-MM') AS month_label,
    CASE
      -- Regra de transição: até mar/2026 = Simples Nacional; a partir de abr/2026 = Lucro Presumido
      WHEN q.created_at < '2026-04-01' THEN 'simples_nacional'
      ELSE 'lucro_presumido'
    END AS regime_fiscal,
    COUNT(DISTINCT q.id) AS cot_count,
    COUNT(DISTINCT o.id) AS os_count,
    COALESCE(SUM((q.pricing_breakdown->'totals'->>'totalCliente')::numeric), 0) AS receita_bruta,
    COALESCE(SUM((q.pricing_breakdown->'totals'->>'das')::numeric), 0) AS das_total,
    COALESCE(SUM((q.pricing_breakdown->'totals'->>'icms')::numeric), 0) AS icms_total,
    COALESCE(SUM((q.pricing_breakdown->'totals'->>'pis')::numeric), 0) AS pis_total,
    COALESCE(SUM((q.pricing_breakdown->'totals'->>'cofins')::numeric), 0) AS cofins_total,
    COALESCE(SUM((q.pricing_breakdown->'totals'->>'csll')::numeric), 0) AS csll_total,
    COALESCE(SUM((q.pricing_breakdown->'totals'->>'irpj')::numeric), 0) AS irpj_total,
    COALESCE(SUM((q.pricing_breakdown->'totals'->>'totalImpostos')::numeric), 0) AS total_impostos,
    COALESCE(SUM((q.pricing_breakdown->'profitability'->>'resultadoLiquido')::numeric), 0) AS resultado_liquido,
    COALESCE(SUM((q.pricing_breakdown->'profitability'->>'margemPercent')::numeric), 0) AS margem_percent_sum
  FROM public.quotes q
  LEFT JOIN public.orders o ON o.quote_id = q.id
  WHERE q.stage = 'ganho'
    AND q.pricing_breakdown IS NOT NULL
    AND q.pricing_breakdown <> '{}'::jsonb
  GROUP BY
    DATE_TRUNC('month', q.created_at),
    COALESCE(
      q.pricing_breakdown->'profitability'->>'regimeFiscal',
      q.pricing_breakdown->'profitability'->>'regime_fiscal',
      'simples_nacional'
    )
)
SELECT
  month,
  month_label,
  regime_fiscal,
  cot_count,
  os_count,
  ROUND(receita_bruta, 2) AS receita_bruta,
  ROUND(das_total, 2) AS das,
  ROUND(icms_total, 2) AS icms,
  ROUND(pis_total, 2) AS pis,
  ROUND(cofins_total, 2) AS cofins,
  ROUND(csll_total, 2) AS csll,
  ROUND(irpj_total, 2) AS irpj,
  ROUND(total_impostos, 2) AS total_impostos,
  CASE WHEN receita_bruta > 0 THEN ROUND((total_impostos / receita_bruta) * 100, 2) ELSE 0 END AS carga_tributaria_pct,
  ROUND(resultado_liquido, 2) AS resultado_liquido,
  CASE WHEN cot_count > 0 THEN ROUND(margem_percent_sum / cot_count, 2) ELSE 0 END AS margem_liquida_avg
FROM monthly
ORDER BY month_label, regime_fiscal;

COMMENT ON VIEW public.v_dre_regime_comparison IS
'Comparativo mensal de regime tributário (Simples Nacional vs Lucro Presumido). Fonte: pricing_breakdown de COTs ganhas.';
