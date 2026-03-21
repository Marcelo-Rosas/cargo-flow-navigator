-- =====================================================================
-- CARGO FLOW NAVIGATOR — Comprehensive Database Audit
-- Run in Supabase SQL Editor (as service_role or superuser)
-- =====================================================================
-- This script audits the database for security, integrity, performance,
-- and data quality issues. Each section is a standalone SELECT.
-- =====================================================================

-- =====================================================================
-- 1. RLS (Row Level Security) Status
-- =====================================================================
-- Check all tables in the public schema and whether RLS is enabled.
-- Tables without RLS are flagged as CRITICAL.

SELECT
  '1. RLS STATUS' AS section,
  c.relname AS table_name,
  CASE WHEN c.relrowsecurity THEN 'ENABLED' ELSE 'DISABLED — CRITICAL' END AS rls_status,
  CASE WHEN c.relrowsecurity THEN 'OK' ELSE 'CRITICAL' END AS severity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relrowsecurity ASC, c.relname;


-- =====================================================================
-- 2. Index Coverage
-- =====================================================================

-- 2a. Tables with >1000 estimated rows that might need review
SELECT
  '2a. LARGE TABLES (>1000 rows)' AS section,
  relname AS table_name,
  n_live_tup AS estimated_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_live_tup > 1000
ORDER BY n_live_tup DESC;

-- 2b. Foreign key columns without indexes
WITH fk_columns AS (
  SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS referenced_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
),
indexed_columns AS (
  SELECT
    t.relname AS table_name,
    a.attname AS column_name
  FROM pg_index i
  JOIN pg_class t ON t.oid = i.indrelid
  JOIN pg_namespace ns ON ns.oid = t.relnamespace
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
  WHERE ns.nspname = 'public'
)
SELECT
  '2b. FK COLUMNS WITHOUT INDEX' AS section,
  fk.table_name,
  fk.column_name,
  fk.referenced_table,
  'MISSING INDEX' AS status
FROM fk_columns fk
LEFT JOIN indexed_columns ic
  ON ic.table_name = fk.table_name AND ic.column_name = fk.column_name
WHERE ic.column_name IS NULL
ORDER BY fk.table_name, fk.column_name;

-- 2c. Common query columns without indexes
WITH target_columns AS (
  SELECT unnest(ARRAY['created_at', 'updated_at', 'status', 'stage']) AS col_name
),
tables_with_column AS (
  SELECT
    c.table_name,
    c.column_name
  FROM information_schema.columns c
  JOIN target_columns tc ON tc.col_name = c.column_name
  WHERE c.table_schema = 'public'
),
indexed_columns AS (
  SELECT
    t.relname AS table_name,
    a.attname AS column_name
  FROM pg_index i
  JOIN pg_class t ON t.oid = i.indrelid
  JOIN pg_namespace ns ON ns.oid = t.relnamespace
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
  WHERE ns.nspname = 'public'
)
SELECT
  '2c. COMMON COLUMNS WITHOUT INDEX' AS section,
  tw.table_name,
  tw.column_name,
  CASE WHEN ic.column_name IS NULL THEN 'NO INDEX' ELSE 'INDEXED' END AS index_status
FROM tables_with_column tw
LEFT JOIN indexed_columns ic
  ON ic.table_name = tw.table_name AND ic.column_name = tw.column_name
WHERE ic.column_name IS NULL
ORDER BY tw.table_name, tw.column_name;


-- =====================================================================
-- 3. Orphaned Records
-- =====================================================================

-- 3a. Quotes with invalid client_id (client deleted but reference remains)
SELECT
  '3a. ORPHAN: quotes with invalid client_id' AS section,
  q.id AS quote_id,
  q.quote_code,
  q.client_id,
  q.client_name,
  q.created_at
FROM public.quotes q
WHERE q.client_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = q.client_id);

-- 3b. Orders without a valid quote_id
SELECT
  '3b. ORPHAN: orders with invalid quote_id' AS section,
  o.id AS order_id,
  o.os_number,
  o.quote_id,
  o.created_at
FROM public.orders o
WHERE o.quote_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = o.quote_id);

-- 3c. Financial documents with broken source references
SELECT
  '3c. ORPHAN: financial_documents with broken source' AS section,
  fd.id AS document_id,
  fd.code,
  fd.type,
  fd.source_type,
  fd.source_id,
  fd.created_at
FROM public.financial_documents fd
WHERE (
  (fd.source_type = 'quote' AND NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = fd.source_id))
  OR
  (fd.source_type = 'order' AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = fd.source_id))
);

-- 3d. Financial installments with broken document reference
SELECT
  '3d. ORPHAN: financial_installments with broken doc ref' AS section,
  fi.id AS installment_id,
  fi.financial_document_id,
  fi.amount,
  fi.due_date
FROM public.financial_installments fi
WHERE NOT EXISTS (
  SELECT 1 FROM public.financial_documents fd WHERE fd.id = fi.financial_document_id
);

-- 3e. Price table rows without valid price_table_id
SELECT
  '3e. ORPHAN: price_table_rows with invalid price_table_id' AS section,
  ptr.id AS row_id,
  ptr.price_table_id,
  ptr.km_from,
  ptr.km_to
FROM public.price_table_rows ptr
WHERE NOT EXISTS (
  SELECT 1 FROM public.price_tables pt WHERE pt.id = ptr.price_table_id
);


-- =====================================================================
-- 4. Pricing Rules Audit
-- =====================================================================

-- 4a. Duplicate active rules (same key + vehicle_type_id)
WITH rule_dupes AS (
  SELECT
    key,
    vehicle_type_id,
    COUNT(*) AS cnt
  FROM public.pricing_rules_config
  WHERE is_active = true
  GROUP BY key, vehicle_type_id
  HAVING COUNT(*) > 1
)
SELECT
  '4a. DUPLICATE ACTIVE PRICING RULES' AS section,
  rd.key,
  rd.vehicle_type_id,
  rd.cnt AS duplicate_count,
  vt.name AS vehicle_type_name
FROM rule_dupes rd
LEFT JOIN public.vehicle_types vt ON vt.id = rd.vehicle_type_id
ORDER BY rd.key;

-- 4b. Active rules with value = 0
SELECT
  '4b. ACTIVE PRICING RULES WITH VALUE = 0' AS section,
  prc.id,
  prc.key,
  prc.label,
  prc.category::text,
  prc.value,
  prc.vehicle_type_id,
  vt.name AS vehicle_type_name
FROM public.pricing_rules_config prc
LEFT JOIN public.vehicle_types vt ON vt.id = prc.vehicle_type_id
WHERE prc.is_active = true
  AND prc.value = 0
ORDER BY prc.key;

-- 4c. Stale rules (not updated in 90+ days)
SELECT
  '4c. STALE PRICING RULES (>90 days)' AS section,
  prc.id,
  prc.key,
  prc.label,
  prc.value,
  prc.updated_at,
  NOW() - prc.updated_at AS age
FROM public.pricing_rules_config prc
WHERE prc.is_active = true
  AND prc.updated_at < NOW() - INTERVAL '90 days'
ORDER BY prc.updated_at ASC;


-- =====================================================================
-- 5. Data Quality
-- =====================================================================

-- 5a. Quotes with null or empty pricing_breakdown
SELECT
  '5a. QUOTES: null/empty pricing_breakdown' AS section,
  q.id,
  q.quote_code,
  q.stage::text,
  q.value,
  q.created_at
FROM public.quotes q
WHERE (q.pricing_breakdown IS NULL OR q.pricing_breakdown = '{}'::jsonb)
  AND q.stage NOT IN ('novo_pedido')
ORDER BY q.created_at DESC
LIMIT 50;

-- 5b. Quotes with value = 0 but not draft stage
SELECT
  '5b. QUOTES: value=0 but not draft' AS section,
  q.id,
  q.quote_code,
  q.stage::text,
  q.value,
  q.client_name,
  q.created_at
FROM public.quotes q
WHERE q.value = 0
  AND q.stage NOT IN ('novo_pedido', 'qualificacao')
ORDER BY q.created_at DESC;

-- 5c. Orders with null km_distance
SELECT
  '5c. ORDERS: null km_distance' AS section,
  o.id,
  o.os_number,
  o.origin,
  o.destination,
  o.stage::text,
  o.created_at
FROM public.orders o
WHERE o.km_distance IS NULL
ORDER BY o.created_at DESC
LIMIT 50;

-- 5d. Clients without CNPJ
SELECT
  '5d. CLIENTS WITHOUT CNPJ' AS section,
  c.id,
  c.name,
  c.email,
  c.created_at
FROM public.clients c
WHERE c.cnpj IS NULL OR TRIM(c.cnpj) = ''
ORDER BY c.created_at DESC;

-- 5e. Shippers without CNPJ
SELECT
  '5e. SHIPPERS WITHOUT CNPJ' AS section,
  s.id,
  s.name,
  s.email,
  s.created_at
FROM public.shippers s
WHERE s.cnpj IS NULL OR TRIM(s.cnpj) = ''
ORDER BY s.created_at DESC;


-- =====================================================================
-- 6. Quote Pipeline Health
-- =====================================================================

-- 6a. Count by stage
SELECT
  '6a. QUOTE PIPELINE: count by stage' AS section,
  q.stage::text,
  COUNT(*) AS total,
  ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
FROM public.quotes q
GROUP BY q.stage
ORDER BY
  CASE q.stage
    WHEN 'novo_pedido' THEN 1
    WHEN 'qualificacao' THEN 2
    WHEN 'precificacao' THEN 3
    WHEN 'enviado' THEN 4
    WHEN 'negociacao' THEN 5
    WHEN 'ganho' THEN 6
    WHEN 'perdido' THEN 7
  END;

-- 6b. Average time in each stage (based on quotes that moved beyond it)
WITH stage_transitions AS (
  SELECT
    al.record_id AS quote_id,
    (al.old_values->>'stage')::text AS from_stage,
    (al.new_values->>'stage')::text AS to_stage,
    al.created_at AS transitioned_at,
    LAG(al.created_at) OVER (PARTITION BY al.record_id ORDER BY al.created_at) AS prev_transition
  FROM public.audit_logs al
  WHERE al.table_name = 'quotes'
    AND al.action = 'UPDATE'
    AND al.old_values->>'stage' IS NOT NULL
    AND al.new_values->>'stage' IS NOT NULL
    AND al.old_values->>'stage' != al.new_values->>'stage'
)
SELECT
  '6b. QUOTE PIPELINE: avg time in stage' AS section,
  from_stage,
  COUNT(*) AS transitions,
  ROUND(AVG(EXTRACT(EPOCH FROM (transitioned_at - COALESCE(prev_transition, transitioned_at - INTERVAL '1 day'))) / 86400)::numeric, 1) AS avg_days
FROM stage_transitions
WHERE prev_transition IS NOT NULL
GROUP BY from_stage
ORDER BY from_stage;

-- 6c. Stale quotes (in active stages for >30 days without update)
SELECT
  '6c. STALE QUOTES: pending >30 days' AS section,
  q.id,
  q.quote_code,
  q.stage::text,
  q.client_name,
  q.value,
  q.updated_at,
  NOW() - q.updated_at AS stale_for
FROM public.quotes q
WHERE q.stage IN ('qualificacao', 'precificacao', 'enviado', 'negociacao')
  AND q.updated_at < NOW() - INTERVAL '30 days'
ORDER BY q.updated_at ASC;


-- =====================================================================
-- 7. Financial Integrity
-- =====================================================================

-- 7a. Installments with negative amounts
SELECT
  '7a. FINANCIAL: negative installment amounts' AS section,
  fi.id AS installment_id,
  fi.financial_document_id,
  fd.code AS doc_code,
  fd.type::text AS doc_type,
  fi.amount,
  fi.due_date,
  fi.status::text
FROM public.financial_installments fi
JOIN public.financial_documents fd ON fd.id = fi.financial_document_id
WHERE fi.amount < 0
ORDER BY fi.due_date;

-- 7b. Financial documents where sum of installments != total_amount
WITH doc_totals AS (
  SELECT
    fi.financial_document_id,
    SUM(fi.amount) AS installment_sum
  FROM public.financial_installments fi
  GROUP BY fi.financial_document_id
)
SELECT
  '7b. FINANCIAL: mismatched doc totals' AS section,
  fd.id AS doc_id,
  fd.code,
  fd.type::text,
  fd.total_amount AS doc_total,
  dt.installment_sum,
  ABS(COALESCE(fd.total_amount, 0) - COALESCE(dt.installment_sum, 0)) AS delta
FROM public.financial_documents fd
LEFT JOIN doc_totals dt ON dt.financial_document_id = fd.id
WHERE fd.total_amount IS NOT NULL
  AND dt.installment_sum IS NOT NULL
  AND ABS(fd.total_amount - dt.installment_sum) > 0.01
ORDER BY ABS(fd.total_amount - COALESCE(dt.installment_sum, 0)) DESC;

-- 7c. Unpaid installments overdue by >60 days
SELECT
  '7c. FINANCIAL: overdue >60 days' AS section,
  fi.id AS installment_id,
  fd.code AS doc_code,
  fd.type::text AS doc_type,
  fi.amount,
  fi.due_date,
  NOW()::date - fi.due_date AS days_overdue,
  fi.status::text
FROM public.financial_installments fi
JOIN public.financial_documents fd ON fd.id = fi.financial_document_id
WHERE fi.status = 'pendente'
  AND fi.due_date < NOW() - INTERVAL '60 days'
ORDER BY fi.due_date ASC;


-- =====================================================================
-- 8. Table Size & Growth
-- =====================================================================

-- 8a. Estimated row counts for all public tables
SELECT
  '8a. TABLE SIZES: row estimates' AS section,
  relname AS table_name,
  n_live_tup AS estimated_rows,
  pg_size_pretty(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname))) AS total_size,
  pg_size_pretty(pg_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname))) AS table_size,
  pg_size_pretty(
    pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname))
    - pg_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname))
  ) AS index_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname)) DESC;


-- =====================================================================
-- 9. SUMMARY — Critical Issues Count
-- =====================================================================
WITH rls_issues AS (
  SELECT COUNT(*) AS cnt
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND NOT c.relrowsecurity
),
orphan_quotes AS (
  SELECT COUNT(*) AS cnt
  FROM public.quotes q
  WHERE q.client_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = q.client_id)
),
orphan_orders AS (
  SELECT COUNT(*) AS cnt
  FROM public.orders o
  WHERE o.quote_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = o.quote_id)
),
orphan_fin_docs AS (
  SELECT COUNT(*) AS cnt
  FROM public.financial_documents fd
  WHERE (
    (fd.source_type = 'quote' AND NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = fd.source_id))
    OR
    (fd.source_type = 'order' AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = fd.source_id))
  )
),
orphan_fin_inst AS (
  SELECT COUNT(*) AS cnt
  FROM public.financial_installments fi
  WHERE NOT EXISTS (
    SELECT 1 FROM public.financial_documents fd WHERE fd.id = fi.financial_document_id
  )
),
orphan_ptr AS (
  SELECT COUNT(*) AS cnt
  FROM public.price_table_rows ptr
  WHERE NOT EXISTS (
    SELECT 1 FROM public.price_tables pt WHERE pt.id = ptr.price_table_id
  )
),
dup_pricing AS (
  SELECT COUNT(*) AS cnt
  FROM (
    SELECT key, vehicle_type_id
    FROM public.pricing_rules_config
    WHERE is_active = true
    GROUP BY key, vehicle_type_id
    HAVING COUNT(*) > 1
  ) sub
),
negative_installments AS (
  SELECT COUNT(*) AS cnt
  FROM public.financial_installments fi
  WHERE fi.amount < 0
),
mismatched_docs AS (
  SELECT COUNT(*) AS cnt
  FROM (
    SELECT fd.id
    FROM public.financial_documents fd
    JOIN (
      SELECT financial_document_id, SUM(amount) AS s
      FROM public.financial_installments
      GROUP BY financial_document_id
    ) fi ON fi.financial_document_id = fd.id
    WHERE fd.total_amount IS NOT NULL
      AND ABS(fd.total_amount - fi.s) > 0.01
  ) sub
),
overdue_60 AS (
  SELECT COUNT(*) AS cnt
  FROM public.financial_installments fi
  WHERE fi.status = 'pendente'
    AND fi.due_date < NOW() - INTERVAL '60 days'
),
stale_quotes AS (
  SELECT COUNT(*) AS cnt
  FROM public.quotes q
  WHERE q.stage IN ('qualificacao', 'precificacao', 'enviado', 'negociacao')
    AND q.updated_at < NOW() - INTERVAL '30 days'
),
fk_no_index AS (
  SELECT COUNT(*) AS cnt
  FROM (
    SELECT
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  ) fk
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
    WHERE ns.nspname = 'public'
      AND t.relname = fk.table_name
      AND a.attname = fk.column_name
  )
)
SELECT '9. AUDIT SUMMARY' AS section, * FROM (
  VALUES
    ('Tables without RLS (CRITICAL)',           (SELECT cnt FROM rls_issues)),
    ('Orphaned quotes (invalid client_id)',     (SELECT cnt FROM orphan_quotes)),
    ('Orphaned orders (invalid quote_id)',      (SELECT cnt FROM orphan_orders)),
    ('Orphaned financial_documents',            (SELECT cnt FROM orphan_fin_docs)),
    ('Orphaned financial_installments',         (SELECT cnt FROM orphan_fin_inst)),
    ('Orphaned price_table_rows',               (SELECT cnt FROM orphan_ptr)),
    ('Duplicate active pricing rules',          (SELECT cnt FROM dup_pricing)),
    ('Negative installment amounts',            (SELECT cnt FROM negative_installments)),
    ('Financial docs with mismatched totals',   (SELECT cnt FROM mismatched_docs)),
    ('Overdue installments (>60 days)',         (SELECT cnt FROM overdue_60)),
    ('Stale quotes (>30 days in pipeline)',     (SELECT cnt FROM stale_quotes)),
    ('FK columns without indexes',             (SELECT cnt FROM fk_no_index))
) AS summary(check_name, issue_count)
ORDER BY issue_count DESC;
