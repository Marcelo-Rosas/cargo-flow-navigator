// src/components/ai/AnalysisSkeleton.tsx
export function AnalysisSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-5 w-24 rounded-full bg-muted" />
        <div className="h-4 w-16 rounded bg-muted" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-4/5 rounded bg-muted" />
      </div>
      <div className="space-y-1">
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
      <div className="h-16 w-full rounded-lg bg-muted" />
    </div>
  );
}
