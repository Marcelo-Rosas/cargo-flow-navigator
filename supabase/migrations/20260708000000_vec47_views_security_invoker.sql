-- VEC-47: Convert 18 views from security_invoker=false to security_invoker=true.
--
-- Views with security_invoker=false run with the VIEW OWNER's privileges, effectively
-- bypassing RLS on the underlying tables (owner is postgres/supabase_admin).
-- Converting to security_invoker=true ensures the CALLER's identity is used for RLS
-- checks, so all existing RLS policies on the base tables are correctly enforced.
--
-- Safe: all underlying tables have authenticated SELECT policies in place.
-- Views only present in production use EXECUTE + EXCEPTION to skip in preview.

DO $$
DECLARE
  views TEXT[] := ARRAY[
    'financial_documents_kanban',
    'financial_payable_kanban',
    'financial_receivable_kanban',
    'insurance_metrics_error_breakdown',
    'insurance_metrics_latency',
    'insurance_metrics_volume',
    'load_composition_discount_summary',
    'load_composition_summary',
    'orders_rs_per_km',
    'trip_financial_summary',
    'v_cash_flow_summary',
    'v_order_payment_reconciliation',
    'v_quote_order_divergence',
    'v_quote_payment_reconciliation',
    'vw_ntc_publish_pattern',
    'vw_ntc_scrape_history',
    'vw_order_risk_status',
    'vw_trip_risk_summary'
  ];
  v TEXT;
BEGIN
  FOREACH v IN ARRAY views LOOP
    BEGIN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v);
    EXCEPTION WHEN undefined_table THEN
      -- view does not exist in this environment (preview branch), skip
      NULL;
    END;
  END LOOP;
END $$;
