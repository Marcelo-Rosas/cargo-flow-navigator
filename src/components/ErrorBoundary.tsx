import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { useLocation } from 'react-router-dom';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { logger } from '@/lib/logger';

function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError/i.test(msg);
}

interface SectionErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  resetKeys?: unknown[];
}

/** Error boundary global — envolve toda a aplicação */
export function GlobalErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={(props) => (
        <div className="flex min-h-screen items-center justify-center bg-background p-8">
          <div className="w-full max-w-md">
            <ErrorFallback
              {...props}
              title="Erro na aplicação"
              description="A aplicação encontrou um erro crítico. Recarregue a página ou tente novamente."
            />
          </div>
        </div>
      )}
      onError={(error, info) => {
        if (isChunkLoadError(error)) {
          window.location.reload();
          return;
        }
        logger.captureException(error, { componentStack: info.componentStack ?? '' });
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}

/** Error boundary de seção — isola módulos individuais */
export function SectionErrorBoundary({
  children,
  title,
  description,
  resetKeys,
}: SectionErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={(props) => (
        <ErrorFallback {...props} title={title} description={description} />
      )}
      onError={(error, info) => {
        if (isChunkLoadError(error)) {
          window.location.reload();
          return;
        }
        logger.captureException(error, { componentStack: info.componentStack ?? '' });
      }}
      resetKeys={resetKeys}
    >
      {children}
    </ReactErrorBoundary>
  );
}

/** Route-aware error boundary — auto-resets when the URL changes */
export function RouteErrorBoundary({
  children,
  title,
  description,
}: Omit<SectionErrorBoundaryProps, 'resetKeys'>) {
  const location = useLocation();
  return (
    <SectionErrorBoundary title={title} description={description} resetKeys={[location.pathname]}>
      {children}
    </SectionErrorBoundary>
  );
}
