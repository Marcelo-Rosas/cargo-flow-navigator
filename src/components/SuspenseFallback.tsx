import { Loader2 } from 'lucide-react';

/** Loading spinner used as fallback for React.lazy / Suspense boundaries */
export function SuspenseFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
