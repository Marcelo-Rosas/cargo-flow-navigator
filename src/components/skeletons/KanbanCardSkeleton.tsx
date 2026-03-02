import { Skeleton } from '@/components/ui/skeleton';

export function KanbanCardSkeleton() {
  return (
    <div className="bg-card rounded-lg border shadow-sm p-4 space-y-3">
      <div className="flex justify-between items-start">
        <Skeleton className="h-3 w-16" /> {/* Código (ex: FAT-001) */}
        <Skeleton className="h-4 w-4 rounded-full" /> {/* Ícone/Menu */}
      </div>
      <Skeleton className="h-4 w-3/4" /> {/* Nome do Cliente */}
      <Skeleton className="h-3 w-1/2" /> {/* Rota/Cidade */}
      <div className="pt-2">
        <Skeleton className="h-6 w-24" /> {/* Valor */}
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-5 w-20 rounded" />
      </div>
    </div>
  );
}
