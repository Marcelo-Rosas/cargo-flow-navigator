import { Skeleton } from '@/components/ui/skeleton';
import { KanbanCardSkeleton } from './KanbanCardSkeleton';

interface KanbanSkeletonProps {
  columnCount?: number;
  columnLabels?: { id: string; label: string }[];
}

export function KanbanSkeleton({ columnCount = 5, columnLabels }: KanbanSkeletonProps) {
  const columns =
    columnLabels ??
    Array.from({ length: columnCount }, (_, i) => ({
      id: `col-${i}`,
      label: `Coluna ${i + 1}`,
    }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 custom-scrollbar">
      {columns.map((col) => (
        <div key={col.id} className="flex-1 min-w-[280px] max-w-[320px] flex-shrink-0 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <span className="text-sm font-semibold text-muted-foreground/50">{col.label}</span>
            </div>
            <Skeleton className="h-5 w-8 rounded-full" /> {/* Badge de contagem */}
          </div>

          <div className="flex-1 p-2 rounded-lg bg-muted/20 min-h-[200px] space-y-3">
            <KanbanCardSkeleton />
            <KanbanCardSkeleton />
            <KanbanCardSkeleton />
          </div>
        </div>
      ))}
    </div>
  );
}
