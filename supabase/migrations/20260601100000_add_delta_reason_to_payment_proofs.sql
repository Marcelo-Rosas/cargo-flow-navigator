-- Add delta_reason column to quote_payment_proofs for reconciliation tracking
alter table public.quote_payment_proofs
  add column if not exists delta_reason text;

comment on column public.quote_payment_proofs.delta_reason
  is 'Reason for amount divergence: mao_de_obra, avaria, atraso, negociacao, taxa_banco, arredondamento, outro';
