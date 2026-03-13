# Cotação / Kanban Comercial / QuoteForm

## Entrypoints

| Tipo | Arquivo |
|------|---------|
| Página | `src/pages/Commercial.tsx` |
| Card | `src/components/boards/QuoteCard.tsx` |
| Form | `src/components/forms/QuoteForm.tsx` |
| Wizard | `src/components/forms/quote-form/QuoteFormWizard.tsx` |
| Modal | `src/components/modals/QuoteDetailModal.tsx`, `ConvertQuoteModal.tsx`, `SendQuoteEmailModal.tsx` |
| Hooks | `useQuotes.tsx`, `useCalculateFreight.ts`, `useSendQuoteEmail.ts` |

## Tabelas Supabase

- `quotes` — cotação; stages comerciais
- `price_tables`, `price_table_rows` — tabelas de preço

## DnD Kanban

dnd-kit: `DndContext` + `SortableContext`. Colunas por stage. Hook de mutação para mover card.
