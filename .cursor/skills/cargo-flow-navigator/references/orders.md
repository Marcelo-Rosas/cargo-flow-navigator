# Ordem de Serviço / Kanban Operacional / Trips

## Entrypoints

| Tipo | Arquivo |
|------|---------|
| Página | `src/pages/Operations.tsx` |
| Form | `src/components/forms/OrderForm.tsx` |
| Modal | `src/components/modals/OrderDetailModal.tsx` |
| Hooks | `useOrders.tsx` |

## Tabelas Supabase

- `orders` — ordem de serviço; stages operacionais
- `trips` — viagens vinculadas

## DnD Kanban

dnd-kit em Operations.tsx. Colunas por stage. Mutação para mover ordem.
