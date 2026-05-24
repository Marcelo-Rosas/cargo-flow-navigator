-- v4.x: Permitir proof_type 'a_vista' na tabela payment_proofs (comprovantes à vista do carreteiro)

alter table public.payment_proofs
  drop constraint if exists payment_proofs_proof_type_check;

alter table public.payment_proofs
  add constraint payment_proofs_proof_type_check
  check (proof_type in ('a_vista','adiantamento','saldo','outros'));
