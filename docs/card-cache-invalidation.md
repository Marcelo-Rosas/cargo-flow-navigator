# Análise: queryKeys e invalidations (hooks Kanban)

## QueryKeys atuais

| Hook / uso | queryKey |
|------------|----------|
| `useQuotes()` | `['quotes']` |
| `useQuote(id)` | `['quotes', id]` |
| `useOrders()` | `['orders']` |
| `useOrder(id)` | `['orders', id]` |
| `useFinancialDocumentsKanban(params)` | `['financial-kanban', type, status?, overdueOnly?, rich]` |

Não existe hoje `['card', …]`; cada aba usa apenas a chave do seu domínio.

## Invalidations atuais por mutation

### Quotes
- `useCreateQuote`, `useUpdateQuote`, `useUpdateQuoteStage`, `useDeleteQuote`: invalidam **apenas** `['quotes']`. **Não** invalidam `['financial-kanban']` nem `['orders']`.
- `useSendQuoteEmail`: invalida `['quotes']`.

### Orders
- `useUpdateOrder`: invalida `['orders']` **e** `['financial-kanban']`.
- `useCreateOrder`, `useUpdateOrderStage`, `useDeleteOrder`: invalidam **apenas** `['orders']` (não invalidam `['financial-kanban']`).
- `useConvertQuoteToOrder`: invalida `['orders']` e `['quotes']` (não `['financial-kanban']`).

### Financeiro
- `useUpdateFinancialDocumentStatus`: invalida **apenas** `['financial-kanban']`.
- `useEnsureFinancialDocument`: invalida `['financial-kanban']`, `['quotes']`, `['orders']`.

### Realtime
- `useRealtimeSubscription`: escuta `quotes`, `orders`, `occurrences`, `clients`. Invalida:
  - quotes → `['quotes']`
  - orders → `['orders']`
  - occurrences → `['occurrences']`, `['orders']`
  - clients → `['clients']`
- **Não** escuta `financial_documents` nem `financial_installments`; não há invalidation de `['financial-kanban']` por Realtime.

## Padrão de queryKeys (definido para consistência)

- **Listas (inalteradas)**: `['quotes']`, `['orders']`, `['financial-kanban', type, ...]`.
- **Card completo (novo)**: `['card', { quoteId?: string, orderId?: string }]` — pelo menos um dos dois presente. Usado por `useCardDetails(quoteId?, orderId?)` e alimentado pela RPC `get_card_full_data`.

Helper de construção (frontend): `cardQueryKey(quoteId?, orderId?)` retorna `['card', { quoteId, orderId }]` (undefined quando ausente) para invalidateQueries e hook.

## Regras de invalidation (a aplicar)

- **Quote mutations** (`useCreateQuote`, `useUpdateQuote`, `useUpdateQuoteStage`, `useDeleteQuote`): invalidar `['quotes']`, `['financial-kanban']`, e `['card', { quoteId }]` quando aplicável (ex.: update/delete por id).
- **Order mutations** (`useCreateOrder`, `useUpdateOrder`, `useUpdateOrderStage`, `useDeleteOrder`): invalidar `['orders']`, `['financial-kanban']`, e `['card', { orderId }]` (e, no convert, também `['quotes']` e `['card', { quoteId }]`).
- **Financial mutations** (`useUpdateFinancialDocumentStatus`, `useEnsureFinancialDocument`): invalidar `['financial-kanban']` e, quando possível, o `['card', …]` correspondente ao source (quote_id ou order_id do documento).
- **Realtime**: manter invalidation de `['quotes']` e `['orders']` nos canais existentes; adicionar canal para `financial_documents` e `financial_installments` que invalide `['financial-kanban']` (e, se viável, `['card', …]` por source_id/source_type).
