# Kanban Financeiro / FAT / PAG / Parcelas

## Entrypoints

Páginas e componentes relacionados a financeiro (FAT/PAG, parcelas, fluxo de caixa).

## Tabelas Supabase

- `financial_entries`, `financial_groups`, `financial_documents`
- `payment_proofs`, `payment_terms`

## Hooks

`useEnsureFinancialDocument.ts`, `usePaymentProofs.ts`, `useQuotePaymentProofs.ts`, `useComplianceChecks.ts`

## Edge Functions

`process-payment-proof`, `process-quote-payment-proof`, `ensure-financial-document`
