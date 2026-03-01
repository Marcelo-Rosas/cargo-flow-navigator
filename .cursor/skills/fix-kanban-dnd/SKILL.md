---
name: fix-kanban-dnd
description: Refactors Kanban drag-and-drop logic to use onDragOver and a proper collision strategy, fixing card movement between columns. Use when Kanban cards fail to move between columns, DnD feels laggy, or editing Commercial.tsx, Operations.tsx, or DndContext-based pages.
---

# Refatorar Lógica de Drag-and-Drop do Kanban

## Quando Usar

- Usuário solicita correção da movimentação de cards no Kanban
- Arquivo de página (`Commercial.tsx`, `Operations.tsx`) usa `DndContext` com `onDragEnd` monolítico

## Instruções

1. **Identifique o arquivo alvo:** Encontre o componente React com `DndContext` para o Kanban (em `src/pages/`).

2. **Modifique a lógica de eventos:**
   - Implemente `onDragOver` para atualizar o estado local da UI e mover o card visualmente entre colunas.
   - Simplifique `onDragEnd` para disparar a mutação ao backend (`updateStageMutation` ou similar) apenas quando a coluna do card foi alterada.

3. **Aplique o padrão de refatoração:** Use como guia o arquivo [assets/dnd-refactor-pattern.ts](assets/dnd-refactor-pattern.ts).

4. **Ajuste a estratégia de colisão:** Em `DndContext`, altere `collisionDetection` de `closestCenter` para `rectIntersection` ou `pointerWithin`.

5. **Adicione rolagem horizontal:** No JSX, no `div` que envolve as colunas do Kanban, adicione as classes `overflow-x-auto` e `pb-4`.

6. **Valide:** Confirme que a movimentação está fluida e a chamada ao backend ocorre corretamente.
