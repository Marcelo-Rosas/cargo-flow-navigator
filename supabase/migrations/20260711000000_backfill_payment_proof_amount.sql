-- Backfill quote_payment_proofs.amount where null but expected_amount is known.
-- Caused by a bug in process-quote-payment-proof (fixed in PR #78) that set amount: null on upsert.
-- Safe to run multiple times (idempotent via WHERE clause).
UPDATE quote_payment_proofs
SET amount = expected_amount
WHERE amount IS NULL
  AND expected_amount IS NOT NULL;
