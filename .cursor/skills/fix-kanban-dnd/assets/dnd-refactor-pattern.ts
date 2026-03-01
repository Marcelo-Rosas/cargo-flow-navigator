// Padrão para refatoração do D&D no Kanban
// Tipos: DragOverEvent e DragEndEvent de @dnd-kit/core
// Dependências: useState, findContainer, updateStageMutation (ex: useUpdateQuoteStage())
// @ts-nocheck — arquivo de referência, não executável

// 1. Mantenha o estado dos itens
const [items, setItems] = useState(initialItems);

// 2. Implemente onDragOver para feedback visual imediato
const handleDragOver = (event) => {
  const { active, over } = event;
  if (!over) return;

  const activeContainer = findContainer(active.id);
  const overContainer = findContainer(over.id);

  if (activeContainer && overContainer && activeContainer !== overContainer) {
    setItems((prev) => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const [draggedItem] = activeItems.splice(active.data.current.sortable.index, 1);
      overItems.push(draggedItem);
      return { ...prev };
    });
  }
};

// 3. Simplifique onDragEnd para persistir a mudança
const handleDragEnd = (event) => {
  const { active, over } = event;
  if (!over) return;

  const originalContainer = active.data.current.sortable.containerId;
  const newContainer = over.data.current.sortable.containerId;

  if (originalContainer !== newContainer) {
    updateStageMutation.mutateAsync({
      id: active.id,
      stage: newContainer,
    });
  }
};
