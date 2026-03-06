/**
 * Pure helpers for multi-column Kanban drag-and-drop with @dnd-kit/sortable.
 *
 * These helpers operate on `ItemsState = Record<ColumnId, T[]>` and are
 * side-effect-free so they can be tested without a DOM.
 */
import { UniqueIdentifier } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

export type ColumnId = string;

export interface ItemWithId {
  id: UniqueIdentifier;
}

/** Canonical state shape: a map from column id to its ordered items. */
export type ItemsState<T extends ItemWithId> = Record<ColumnId, T[]>;

/**
 * Returns the column id that contains an item, or the column id itself when
 * `id` matches a column (empty droppable). Returns null if not found.
 */
export function findContainer<T extends ItemWithId>(
  items: ItemsState<T>,
  id: UniqueIdentifier
): ColumnId | null {
  // id is a column itself (e.g. when dropped on an empty column)
  if (id in items) return id as ColumnId;

  // id is an item inside a column
  for (const colId of Object.keys(items)) {
    if (items[colId].some((item) => item.id === id)) return colId;
  }

  return null;
}

/**
 * Moves `activeId` relative to `overId`.
 *
 * - Same column  → reorder with `arrayMove` based on indices.
 * - Different column:
 *   - `overId` is an item  → insert at that item's index.
 *   - `overId` is a column → append at the end (empty drop zone).
 *
 * Returns a new `ItemsState` if anything changed, or `null` when there is
 * nothing to do (so callers can skip `setState`).
 */
export function moveItem<T extends ItemWithId>(
  items: ItemsState<T>,
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier | null
): ItemsState<T> | null {
  if (!overId) return null;

  const activeContainer = findContainer(items, activeId);
  const overContainer = findContainer(items, overId);

  if (!activeContainer || !overContainer) return null;

  const activeItems = items[activeContainer];
  const activeIndex = activeItems.findIndex((i) => i.id === activeId);
  if (activeIndex === -1) return null;

  if (activeContainer === overContainer) {
    // Same column — reorder
    const overIndex = activeItems.findIndex((i) => i.id === overId);
    if (overIndex === -1 || activeIndex === overIndex) return null;

    return {
      ...items,
      [activeContainer]: arrayMove(activeItems, activeIndex, overIndex),
    };
  }

  // Different column — move item
  const overItems = items[overContainer];
  const overIndex = overItems.findIndex((i) => i.id === overId);

  // If overId is the column itself (empty drop zone) insert at end; else at overIndex
  const insertAt = overIndex === -1 ? overItems.length : overIndex;

  return {
    ...items,
    [activeContainer]: activeItems.filter((i) => i.id !== activeId),
    [overContainer]: [
      ...overItems.slice(0, insertAt),
      activeItems[activeIndex],
      ...overItems.slice(insertAt),
    ],
  };
}
