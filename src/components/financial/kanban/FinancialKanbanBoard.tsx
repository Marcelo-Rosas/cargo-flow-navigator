import { useState, useEffect, useRef, useCallback } from 'react';
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
  UniqueIdentifier,
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

/** Returns the target status for any droppable id (column or card). */
function resolveTargetStatus(
  rows: FinancialKanbanRow[],
  columnsConfig: ColumnConfig[],
  overId: UniqueIdentifier
): string | null {
  const overIdStr = String(overId);
  if (columnsConfig.some((c) => c.id === overIdStr)) return overIdStr;
  return rows.find((r) => r.id === overIdStr)?.status ?? null;
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

  // Snapshot captured at drag-start for reliable rollback on mutation error.
  const snapshotRef = useRef<FinancialKanbanRow[]>([]);

  // Prevents jitter when a card crosses a container boundary rapidly.
  const recentlyMovedToNewContainer = useRef(false);

  // Sync with fresh server data only while no drag is in progress.
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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveId(id);
    // Take a snapshot before any optimistic changes.
    setOptimisticRows((prev) => {
      snapshotRef.current = prev;
      return prev;
    });
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeIdStr = String(active.id);
      const overIdStr = String(over.id);
      if (activeIdStr === overIdStr) return;

      // Skip if we just moved to a new container this frame (anti-jitter).
      if (recentlyMovedToNewContainer.current) return;

      const targetStatus = resolveTargetStatus(optimisticRows, columnsConfig, overIdStr);
      if (!targetStatus) return;

      setOptimisticRows((prev) => {
        const activeIndex = prev.findIndex((r) => r.id === activeIdStr);
        if (activeIndex === -1) return prev;

        // Guard: avoid setState when nothing actually changes.
        if (prev[activeIndex].status === targetStatus) return prev;

        recentlyMovedToNewContainer.current = true;
        requestAnimationFrame(() => {
          recentlyMovedToNewContainer.current = false;
        });

        const newRows = [...prev];
        newRows[activeIndex] = { ...newRows[activeIndex], status: targetStatus };
        return newRows;
      });
    },
    [optimisticRows, columnsConfig]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const activeIdStr = String(active.id);
      const overIdStr = String(over.id);
      const targetStatus = resolveTargetStatus(optimisticRows, columnsConfig, overIdStr);
      const originalRow = snapshotRef.current.find((r) => r.id === activeIdStr);

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
          // Roll back to the snapshot taken at drag-start.
          setOptimisticRows(snapshotRef.current);
          toast.error('Erro ao mover o card. Tente novamente.');
        }
      }
    },
    [optimisticRows, columnsConfig, updateStatusMutation]
  );

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
