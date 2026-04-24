-- VEC-295: Ensure v_quote_payment_reconciliation uses security_invoker
-- Without this, the view runs with SECURITY DEFINER (owner privileges),
-- bypassing RLS on quotes, financial_documents, and quote_payment_proofs.
ALTER VIEW v_quote_payment_reconciliation SET (security_invoker = true);
