import { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { toast } from 'sonner';

import { KanbanColumn } from '@/components/boards/KanbanColumn';
import { FinancialCard } from '@/components/financial/FinancialCard';
import { groupFinancialKanbanColumns } from '@/lib/financial-kanban';
import type { FinancialKanbanRow, FinancialDocType } from '@/types/financial';

interface ColumnConfig {
  id: string;
  label: string;
  color?: string;
}

interface FinancialKanbanBoardProps {
  initialRows: FinancialKanbanRow[];
  type: FinancialDocType;
  columnsConfig: ColumnConfig[];
  updateStatusMutation: { mutateAsync: (data: { id: string; status: string }) => Promise<unknown> };
  onCardClick: (doc: FinancialKanbanRow) => void;
}

export function FinancialKanbanBoard({
  initialRows,
  type,
  columnsConfig,
  updateStatusMutation,
  onCardClick,
}: FinancialKanbanBoardProps) {
  const [optimisticRows, setOptimisticRows] = useState(initialRows);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId) {
      setOptimisticRows(initialRows);
    }
  }, [initialRows, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const columns = groupFinancialKanbanColumns(optimisticRows, type);
  const activeRow = optimisticRows.find((row) => row.id === activeId);

  const findTargetStatus = (overId: string): string | null => {
    if (columnsConfig.some((c) => c.id === overId)) return overId;
    const targetCard = optimisticRows.find((r) => r.id === overId);
    if (targetCard) return targetCard.status;
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    if (activeIdStr === overIdStr) return;

    const targetStatus = findTargetStatus(overIdStr);
    if (!targetStatus) return;

    setOptimisticRows((prev) => {
      const activeIndex = prev.findIndex((r) => r.id === activeIdStr);
      if (activeIndex === -1) return prev;

      const newRows = [...prev];
      if (newRows[activeIndex].status !== targetStatus) {
        newRows[activeIndex] = { ...newRows[activeIndex], status: targetStatus };
      }
      return newRows;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const targetStatus = findTargetStatus(overIdStr);
    const originalRow = initialRows.find((r) => r.id === activeIdStr);

    if (targetStatus && originalRow && originalRow.status !== targetStatus) {
      const columnLabel = columnsConfig.find((c) => c.id === targetStatus)?.label ?? targetStatus;

      try {
        await updateStatusMutation.mutateAsync({
          id: activeIdStr,
          status: targetStatus,
        });
        toast.success(`Movido para ${columnLabel}`);
      } catch (error) {
        console.error('Falha ao mover card. Revertendo...', error);
        setOptimisticRows([...initialRows]);
        toast.error('Erro ao mover o card. Tente novamente.');
      }
    }
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: '0.5' } },
    }),
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6">
        {columns.map((col) => (
          <KanbanColumn
            key={col.status}
            id={col.status}
            title={col.label}
            count={col.items.length}
            color={columnsConfig.find((c) => c.id === col.status)?.color}
            items={col.items.map((r) => r.id)}
          >
            {col.items.map((row) => (
              <FinancialCard
                key={row.id}
                row={row}
                onEdit={() => onCardClick(row)}
                canManageActions
              />
            ))}
          </KanbanColumn>
        ))}
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeRow ? (
          <div className="opacity-80 rotate-2 scale-[1.02]">
            <FinancialCard row={activeRow} canManageActions />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
