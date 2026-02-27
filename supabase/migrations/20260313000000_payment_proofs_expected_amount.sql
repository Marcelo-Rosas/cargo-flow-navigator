-- Add expected_amount to payment_proofs for audit/compliance
-- Value is calculated from carreteiro_real + carrier_payment_term advance_percent
-- adiantamento: carreteiro_real * advance_percent / 100
-- saldo: carreteiro_real * (100 - advance_percent) / 100

begin;

alter table public.payment_proofs
  add column if not exists expected_amount numeric;

comment on column public.payment_proofs.expected_amount is
  'Valor esperado para este proof (adiantamento ou saldo) calculado a partir de carreteiro_real e advance_percent da condição de pagamento';

commit;
