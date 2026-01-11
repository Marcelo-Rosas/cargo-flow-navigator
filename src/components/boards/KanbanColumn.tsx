import { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  id: string;
  title: string;
  count: number;
  color?: string;
  children: ReactNode;
  items: string[];
}

export function KanbanColumn({ id, title, count, color, children, items }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col min-w-[280px] max-w-[320px] flex-shrink-0"
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", color || "bg-muted")} />
          <h3 className="font-semibold text-foreground">{title}</h3>
          <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {count}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 rounded-lg bg-muted/30 min-h-[200px] transition-colors",
          isOver && "bg-primary/5 ring-2 ring-primary/20 ring-dashed"
        )}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {children}
          </div>
        </SortableContext>
      </div>
    </motion.div>
  );
}
