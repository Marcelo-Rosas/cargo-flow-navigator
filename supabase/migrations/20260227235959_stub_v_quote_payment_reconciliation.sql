-- Stub view para permitir que financial_receivable_kanban (20260228) compile.
-- v_quote_payment_reconciliation é substituída pela definição real em 20260318090000,
-- que cria a tabela quote_payment_proofs e depois faz CREATE OR REPLACE VIEW.

CREATE OR REPLACE VIEW public.v_quote_payment_reconciliation AS
SELECT
  q.id            AS quote_id,
  q.quote_code,
  COALESCE(q.value, 0) AS expected_amount,
  0::numeric      AS paid_amount,
  0::numeric      AS delta_amount,
  false           AS is_reconciled,
  0::bigint       AS proofs_count
FROM public.quotes q
WHERE false;
