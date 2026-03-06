# Design: view/RPC agregadora de card e CanonicalCard

## 1. RPC `get_card_full_data`

**Assinatura**

- `get_card_full_data(p_quote_id uuid DEFAULT NULL, p_order_id uuid DEFAULT NULL) RETURNS jsonb`
- Pelo menos um dos parâmetros deve ser fornecido. Se ambos, `p_quote_id` tem precedência para definir a “célula” do card (cotação como origem).

**Comportamento**

1. Se `p_quote_id` informado:
   - Buscar `quotes` por `id = p_quote_id`.
   - Buscar `orders` com `quote_id = p_quote_id` (LIMIT 1).
   - Buscar `financial_documents` FAT com `source_type = 'quote'` e `source_id = p_quote_id` (LIMIT 1).
   - Se existir ordem, buscar `financial_documents` PAG com `source_type = 'order'` e `source_id = orders.id` (LIMIT 1).
2. Se só `p_order_id` informado:
   - Buscar `orders` por `id = p_order_id`.
   - Se `orders.quote_id` não for nulo, buscar `quotes` e FAT por esse `quote_id`; senão quote e FAT ficam nulos.
   - Buscar PAG com `source_id = p_order_id` (LIMIT 1).

**Retorno JSONB (estrutura)**

- `quote`: linha completa da tabela `quotes` (ou null).
- `order`: linha completa da tabela `orders` (ou null).
- `fat`: linha do documento FAT (tabela `financial_documents`) ou null.
- `pag`: linha do documento PAG (tabela `financial_documents`) ou null.

O frontend pode derivar daí um único “card” normalizado (CanonicalCard) escolhendo origem preferida (ex.: cliente/rota/valor da cotação se existir, senão da OS).

## 2. View `v_quote_order_financial_timeline` (opcional)

- Objetivo: listar todas as “células” de card (uma linha por cotação ou por OS sem cotação) para relatórios ou admin.
- Colunas principais: `quote_id`, `order_id`, `fat_id`, `pag_id`, `client_name`, `origin`, `destination`, `quote_value`, `order_value`, `created_at` (da quote ou da order).
- Implementação: UNION de (1) quotes LEFT JOIN orders ON orders.quote_id = quotes.id LEFT JOIN financial_documents fat ON fat.source_type='quote' AND fat.source_id = quotes.id LEFT JOIN financial_documents pag ON pag.source_type='order' AND pag.source_id = orders.id, (2) orders sem quote (quote_id IS NULL) com fat null e pag por order.id.
- O plano de consistência pode adotar primeiro só a RPC; a view pode ser adicionada depois se necessário.

## 3. Tipo e adapter no frontend: CanonicalCard

- **CanonicalCard**: tipo único que representa o “card completo” independente da aba (Comercial, Operações, Financeiro).
- Campos sugeridos (todos opcionais onde fizer sentido):
  - `quoteId`, `orderId`, `fatId`, `pagId`
  - `clientName`, `origin`, `destination`
  - `value` (valor principal: quote ou order)
  - `quoteValue`, `orderValue`
  - `stage` (quote_stage ou order_stage conforme origem)
  - `quoteCode`, `osNumber`
  - `carreteiroReal`, `carreteiroAntt`
  - Dados financeiros: `fatStatus`, `pagStatus`, `totalAmount`, `expectedAmount`, `paidAmount`, etc.
- **Fonte**: o hook `useCardDetails` chama a RPC `get_card_full_data(quoteId, orderId)` e mapeia o JSONB para `CanonicalCard` em `src/lib/card-mapping.ts` (função `mapCardFullDataToCanonicalCard`).
- **Uso**: modais de detalhe (cotação, OS, financeiro) podem usar `useCardDetails({ quoteId?, orderId? })` e exibir/editar a partir do mesmo estado, garantindo que qualquer edição invalide `['card', { quoteId?, orderId? }]` e as listas `['quotes']`, `['orders']`, `['financial-kanban']`.
