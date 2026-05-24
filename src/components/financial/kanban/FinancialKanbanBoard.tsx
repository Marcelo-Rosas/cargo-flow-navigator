import { useState, useEffect, useRef, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
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
import { findContainer, moveItem, type ItemsState } from '@/lib/kanban-dnd';
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

/** Convert flat rows into the canonical ItemsState shape used by kanban-dnd helpers. */
function buildItemsState(
  rows: FinancialKanbanRow[],
  columnsConfig: ColumnConfig[]
): ItemsState<FinancialKanbanRow> {
  const state: ItemsState<FinancialKanbanRow> = {};
  for (const col of columnsConfig) {
    state[col.id] = [];
  }
  for (const row of rows) {
    const status = row.status ?? columnsConfig[0]?.id ?? 'INCLUIR';
    if (!state[status]) state[status] = [];
    state[status].push(row);
  }
  return state;
}

export function FinancialKanbanBoard({
  initialRows,
  type,
  columnsConfig,
  updateStatusMutation,
  onCardClick,
}: FinancialKanbanBoardProps) {
  const [items, setItems] = useState<ItemsState<FinancialKanbanRow>>(() =>
    buildItemsState(initialRows, columnsConfig)
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  // Snapshot captured at drag-start for reliable rollback on mutation error.
  const snapshotRef = useRef<ItemsState<FinancialKanbanRow> | null>(null);

  // Prevents jitter when a card crosses a container boundary rapidly.
  const recentlyMovedToNewContainer = useRef(false);

  // Keep local kanban state in sync with fresh server data while no drag is active.
  useEffect(() => {
    if (activeId) return;
    setItems(buildItemsState(initialRows, columnsConfig));
  }, [initialRows, columnsConfig, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeRow = useCallback((): FinancialKanbanRow | null => {
    if (!activeId) return null;
    for (const colId of Object.keys(items)) {
      const found = items[colId].find((r) => r.id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, items]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      setActiveId(id);
      snapshotRef.current = items;
    },
    [items]
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    setItems((previous) => {
      const next = moveItem(previous, active.id, over.id);
      if (!next) return previous;

      const fromContainer = findContainer(previous, active.id);
      const toContainer = findContainer(next, active.id);

      if (fromContainer && toContainer && fromContainer !== toContainer) {
        if (recentlyMovedToNewContainer.current) {
          return previous;
        }
        recentlyMovedToNewContainer.current = true;
        requestAnimationFrame(() => {
          recentlyMovedToNewContainer.current = false;
        });
      }

      return next;
    });
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) {
        if (snapshotRef.current) {
          setItems(snapshotRef.current);
          snapshotRef.current = null;
        }
        return;
      }

      const activeIdStr = String(active.id);
      const previous = snapshotRef.current ?? items;
      const fromContainer = findContainer(previous, activeIdStr);
      const toContainer = findContainer(items, activeIdStr);

      if (!fromContainer || !toContainer || fromContainer === toContainer) {
        snapshotRef.current = null;
        return;
      }

      const fullRow = items[toContainer]?.find((r) => r.id === activeIdStr);
      if (!fullRow) {
        snapshotRef.current = null;
        return;
      }

      const targetStatus = toContainer;
      const columnLabel = columnsConfig.find((c) => c.id === targetStatus)?.label ?? targetStatus;

      try {
        await updateStatusMutation.mutateAsync({
          id: activeIdStr,
          status: targetStatus,
        });
        toast.success(`Movido para ${columnLabel}`);
      } catch (error) {
        console.error('Falha ao mover card. Revertendo...', error);
        if (snapshotRef.current) {
          setItems(snapshotRef.current);
        }
        toast.error('Erro ao mover o card. Tente novamente.');
      } finally {
        snapshotRef.current = null;
      }
    },
    [items, columnsConfig, updateStatusMutation]
  );

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: '0.5' } },
    }),
  };

  const activeRowData = activeRow();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6">
        {columnsConfig.map((col) => {
          const columnItems = items[col.id] ?? [];
          return (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.label}
              count={columnItems.length}
              color={col.color}
              items={columnItems.map((r) => r.id)}
            >
              {columnItems.map((row) => (
                <FinancialCard
                  key={row.id}
                  row={row}
                  onEdit={() => onCardClick(row)}
                  canManageActions
                />
              ))}
            </KanbanColumn>
          );
        })}
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeRowData ? (
          <div className="opacity-80 rotate-2 scale-[1.02]">
            <FinancialCard row={activeRowData} canManageActions />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
