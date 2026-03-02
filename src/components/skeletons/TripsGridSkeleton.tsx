import { Skeleton } from '@/components/ui/skeleton';

export function TripsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-card rounded-lg border p-4 space-y-4">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((j) => (
              <div key={j} className="space-y-1">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-8 w-full rounded" />
        </div>
      ))}
    </div>
  );
}
