---
name: simplify-kanban-card
description: Simplifies Kanban card components (QuoteCard, OrderCard) to reduce information density by moving secondary data into tooltips. Use when reducing Kanban card complexity, editing QuoteCard.tsx, OrderCard.tsx, or improving card readability.
---

# Simplificar Card do Kanban

## Quando Usar

- Usuário solicita reduzir complexidade visual dos cards do Kanban
- Edição de `QuoteCard.tsx` ou `OrderCard.tsx`

## Instruções

1. **Identifique o componente do card:** Localize o arquivo (ex: `src/components/boards/QuoteCard.tsx`).

2. **Priorize a informação:** Mantenha visíveis por padrão:
   - ID (Cotação/OS)
   - Nome do Cliente
   - Valor Total
   - Data

3. **Mova informações secundárias:** Envolva detalhes secundários (Rota, Embarcador, Tipo de Frete, etc.) em `Tooltip` (shadcn/ui) para exibição no hover.

4. **Use o template como guia:** Aplique a estrutura de [assets/simplified-card-template.tsx](assets/simplified-card-template.tsx) para reorganizar o JSX.

5. **Refatore o menu de ações:** Coloque todas as ações (Editar, Clonar, Deletar) em um `DropdownMenu` ativado por botão "mais opções" (`...`), visível apenas no hover do card.
