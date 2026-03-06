# Mapeamento do modelo de dados — Cards Kanban (Comercial, Operações, Financeiro)

## 1. Tabelas e identidades centrais

| Board       | Identidade do card | Tabela(s) principal(is) | View(s) usada(s) no board |
|-------------|--------------------|-------------------------|----------------------------|
| Comercial   | `quotes.id`        | `public.quotes`         | —                          |
| Operações   | `orders.id`        | `public.orders`         | — (select com joins)       |
| Financeiro  | `financial_documents.id` | `public.financial_documents`, `public.financial_installments` | `financial_receivable_kanban`, `financial_payable_kanban` |

Não existe um único `card_id` transversal; a ligação é feita por FKs e `source_type`/`source_id`.

## 2. Relacionamentos (FKs e lógica)

### quotes
- **PK**: `quotes.id`
- **Referenciado por**:
  - `orders.quote_id` → `quotes.id` (FK em `20260112121340_...sql`: `ON DELETE SET NULL`)
  - `financial_documents`: quando `source_type = 'quote'`, `source_id = quotes.id` (sem FK explícito; validado na RPC `ensure_financial_document`)
  - `documents.quote_id` → `quotes.id`

### orders
- **PK**: `orders.id`
- **FKs**: `orders.quote_id` → `quotes.id`, `orders.client_id` → `clients.id`, `orders.created_by` → auth.users
- **Referenciado por**:
  - `occurrences.order_id` → `orders.id`
  - `documents.order_id` → `orders.id`
  - `financial_documents`: quando `source_type = 'order'`, `source_id = orders.id`

### financial_documents
- **PK**: `financial_documents.id`
- **Campos de ligação**: `source_type` (`'quote' | 'order'`), `source_id` (UUID)
- **Referenciado por**: `financial_installments.financial_document_id` → `financial_documents.id` (FK CASCADE)
- **Sem FK** para `quotes`/`orders`; existência de `source_id` garantida na RPC `ensure_financial_document` (migração `20260219000500_financial_documents_tables.sql`).

### financial_installments
- **PK**: `financial_installments.id`
- **FK**: `financial_document_id` → `financial_documents.id` ON DELETE CASCADE

## 3. Views do board financeiro

- **financial_documents_kanban**  
  Base: `financial_documents` + subqueries para `is_overdue`, `installments_total`, `installments_pending`, `installments_settled`, `next_due_date` a partir de `financial_installments`.

- **financial_receivable_kanban**  
  `financial_documents_kanban k` JOIN `quotes q` ON `q.id = k.source_id` WHERE `k.type = 'FAT'`.  
  Colunas adicionais: `q.client_name`, `q.origin`, `q.destination`, `q.value AS quote_value`.

- **financial_payable_kanban**  
  `financial_documents_kanban k` JOIN `orders o` ON `o.id = k.source_id` WHERE `k.type = 'PAG'`.  
  Colunas adicionais: `o.client_name`, `o.origin`, `o.destination`, `o.value AS order_value`, `o.carreteiro_real`, `o.carreteiro_antt`.

Migrações posteriores (ex.: `20260226140000_enrich_financial_kanban_views.sql`, `20260228000000_enrich_receivable_kanban_reconciliation.sql`, `20260302000000_enrich_payable_kanban_trip.sql`) acrescentam mais colunas às views.

## 4. Fluxo de dados entre boards

- **Cotação → OS**: conversão via `useConvertQuoteToOrder` (insert em `orders` com `quote_id` e cópia de campos da cotação).
- **Cotação → FAT**: criação de documento financeiro via `ensure_financial_document('FAT', quote_id)`; view `financial_receivable_kanban` lê dados atuais de `quotes` por join.
- **OS → PAG**: `ensure_financial_document('PAG', order.id)`; view `financial_payable_kanban` lê dados atuais de `orders` por join.

Campos duplicados entre `quotes` e `orders` (client_name, origin, destination, value) podem divergir após edições em apenas uma das tabelas; as views financeiras refletem sempre o estado atual da tabela de origem (`quotes` ou `orders`).
