-- VEC-47: Convert 18 views from security_invoker=false to security_invoker=true.
--
-- Views with security_invoker=false run with the VIEW OWNER's privileges, effectively
-- bypassing RLS on the underlying tables (owner is postgres/supabase_admin).
-- Converting to security_invoker=true ensures the CALLER's identity is used for RLS
-- checks, so all existing RLS policies on the base tables are correctly enforced.
--
-- Safe: all underlying tables have authenticated SELECT policies in place.

ALTER VIEW financial_documents_kanban       SET (security_invoker = true);
ALTER VIEW financial_payable_kanban         SET (security_invoker = true);
ALTER VIEW financial_receivable_kanban      SET (security_invoker = true);
ALTER VIEW insurance_metrics_error_breakdown SET (security_invoker = true);
ALTER VIEW insurance_metrics_latency        SET (security_invoker = true);
ALTER VIEW insurance_metrics_volume         SET (security_invoker = true);
ALTER VIEW load_composition_discount_summary SET (security_invoker = true);
ALTER VIEW load_composition_summary         SET (security_invoker = true);
ALTER VIEW orders_rs_per_km                 SET (security_invoker = true);
ALTER VIEW trip_financial_summary           SET (security_invoker = true);
ALTER VIEW v_cash_flow_summary              SET (security_invoker = true);
ALTER VIEW v_order_payment_reconciliation   SET (security_invoker = true);
ALTER VIEW v_quote_order_divergence         SET (security_invoker = true);
ALTER VIEW v_quote_payment_reconciliation   SET (security_invoker = true);
ALTER VIEW vw_ntc_publish_pattern           SET (security_invoker = true);
ALTER VIEW vw_ntc_scrape_history            SET (security_invoker = true);
ALTER VIEW vw_order_risk_status             SET (security_invoker = true);
ALTER VIEW vw_trip_risk_summary             SET (security_invoker = true);
