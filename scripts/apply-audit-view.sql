-- ============================================================
-- VIEW DE AUDITORIA DRE — aplique no SQL Editor do Supabase
-- ============================================================
-- Passos:
-- 1. Acesse https://supabase.com/dashboard/project/epgedaiukjippepujuzc/sql/new
-- 2. Cole este script inteiro
-- 3. Clique em "Run"
-- 4. Recarregue a página de Auditoria no app
-- ============================================================

DROP VIEW IF EXISTS public.v_dre_audit_mismatches;

CREATE OR REPLACE VIEW public.v_dre_audit_mismatches AS

-- 1. COTs ganhas que NUNCA geraram OS
SELECT
  'cot_sem_os' AS mismatch_type,
  q.id AS quote_id,
  q.quote_code,
  NULL::uuid AS order_id,
  NULL::text AS os_number,
  'COT ganha (' || COALESCE(q.quote_code, q.id::text) || ') sem OS vinculada. Real ficará zerado no DRE.' AS description,
  'high' AS severity,
  q.created_at AS reference_date
FROM public.quotes q
LEFT JOIN public.orders o ON o.quote_id = q.id
WHERE q.stage = 'ganho'
  AND o.id IS NULL

UNION ALL

-- 2. OSs sem COT vinculada (presumido ausente)
SELECT
  'os_sem_cot' AS mismatch_type,
  NULL::uuid AS quote_id,
  NULL::text AS quote_code,
  o.id AS order_id,
  o.os_number,
  'OS (' || COALESCE(o.os_number, o.id::text) || ') sem COT vinculada. Presumido ficará em branco no DRE.' AS description,
  'high' AS severity,
  o.created_at AS reference_date
FROM public.orders o
WHERE o.quote_id IS NULL
  AND o.value > 0

UNION ALL

-- 3. Pares COT/OS onde OS não tem custos reais lançados
--    (apenas quando COT ganha e OS entregue — custos reais devem estar apurados)
--    Descarga só é exigida se a COT incluiu custos de descarga no pricing_breakdown.
SELECT
  'os_sem_custos_reais' AS mismatch_type,
  q.id AS quote_id,
  q.quote_code,
  o.id AS order_id,
  o.os_number,
  'OS (' || COALESCE(o.os_number, o.id::text) || ') vinculada à COT ' || COALESCE(q.quote_code, q.id::text) ||
  ' não possui custos reais (carreteiro_real, pedagio_real ou descarga_real nulos).' AS description,
  'medium' AS severity,
  o.created_at AS reference_date
FROM public.orders o
JOIN public.quotes q ON q.id = o.quote_id
WHERE q.stage = 'ganho'
  AND o.stage = 'entregue'
  AND o.value > 0
  AND (
    o.carreteiro_real IS NULL
    OR o.pedagio_real IS NULL
    OR (
      o.descarga_real IS NULL
      AND COALESCE(
        (q.pricing_breakdown->'profitability'->>'custosDescarga')::numeric,
        (q.pricing_breakdown->'profitability'->>'custos_descarga')::numeric,
        0
      ) > 0
    )
  )

UNION ALL

-- 4. COTs ganhas com pricing_breakdown nulo ou vazio (exceto legacy)
SELECT
  'cot_breakdown_nulo' AS mismatch_type,
  q.id AS quote_id,
  q.quote_code,
  NULL::uuid AS order_id,
  NULL::text AS os_number,
  'COT ganha (' || COALESCE(q.quote_code, q.id::text) || ') com pricing_breakdown nulo ou vazio. Presumido será zerado no DRE.' AS description,
  'high' AS severity,
  q.created_at AS reference_date
FROM public.quotes q
WHERE q.stage = 'ganho'
  AND (
    q.pricing_breakdown IS NULL
    OR q.pricing_breakdown = '{}'::jsonb
    OR jsonb_typeof(q.pricing_breakdown) = 'null'
  )
  AND (q.is_legacy IS NULL OR q.is_legacy = false)

UNION ALL

-- 5. COTs ganhas com pricing_breakdown incompleto (sem impostos ou custos)
SELECT
  'cot_breakdown_incompleto' AS mismatch_type,
  q.id AS quote_id,
  q.quote_code,
  NULL::uuid AS order_id,
  NULL::text AS os_number,
  'COT ganha (' || COALESCE(q.quote_code, q.id::text) || ') com pricing_breakdown incompleto (impostos=0 e custos=0 no JSON). Verifique se passou pelo calculate-freight.' AS description,
  'high' AS severity,
  q.created_at AS reference_date
FROM public.quotes q
WHERE q.stage = 'ganho'
  AND q.pricing_breakdown IS NOT NULL
  AND q.pricing_breakdown <> '{}'::jsonb
  AND (q.is_legacy IS NULL OR q.is_legacy = false)
  AND (
    (
      COALESCE((q.pricing_breakdown->'totals'->>'das')::numeric, 0) = 0
      AND COALESCE((q.pricing_breakdown->'totals'->>'icms')::numeric, 0) = 0
    )
    OR
    (
      COALESCE((q.pricing_breakdown->'profitability'->>'custoMotorista')::numeric, 0) = 0
      AND COALESCE((q.pricing_breakdown->'profitability'->>'custosCarreteiro')::numeric, 0) = 0
      AND COALESCE((q.pricing_breakdown->'profitability'->>'custo_motorista')::numeric, 0) = 0
      AND COALESCE((q.pricing_breakdown->'profitability'->>'custos_carreteiro')::numeric, 0) = 0
    )
  )

UNION ALL

-- 6. OSs com value = 0 vinculadas a COT (faturamento real inválido)
SELECT
  'os_valor_zero' AS mismatch_type,
  q.id AS quote_id,
  q.quote_code,
  o.id AS order_id,
  o.os_number,
  'OS (' || COALESCE(o.os_number, o.id::text) || ') vinculada à COT ' || COALESCE(q.quote_code, q.id::text) ||
  ' possui value = 0. Faturamento real inválido para DRE.' AS description,
  'high' AS severity,
  o.created_at AS reference_date
FROM public.orders o
JOIN public.quotes q ON q.id = o.quote_id
WHERE o.value = 0

UNION ALL

-- 7. Pares onde faturamento da OS difere > 10% da COT
SELECT
  'divergencia_valor' AS mismatch_type,
  q.id AS quote_id,
  q.quote_code,
  o.id AS order_id,
  o.os_number,
  'OS (' || COALESCE(o.os_number, o.id::text) || ') tem valor R$ ' ||
  TO_CHAR(o.value, 'FM999G999G999D99') || ' enquanto COT era R$ ' ||
  TO_CHAR(q.value, 'FM999G999G999D99') || ' (divergência > 10%).' AS description,
  'low' AS severity,
  o.created_at AS reference_date
FROM public.orders o
JOIN public.quotes q ON q.id = o.quote_id
WHERE q.value > 0
  AND ABS(o.value - q.value) / q.value > 0.10;

-- Permissão de leitura para authenticated
GRANT SELECT ON public.v_dre_audit_mismatches TO authenticated;
GRANT SELECT ON public.v_dre_audit_mismatches TO anon;

-- Comentário para documentação
COMMENT ON VIEW public.v_dre_audit_mismatches IS
'Auditoria de qualidade dos pares COT/OS para DRE Comparativo. Lista todas as inconsistências que impedem ou distorcem o cálculo Presumido vs Real.';
