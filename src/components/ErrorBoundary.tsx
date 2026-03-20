import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '@/components/ui/ErrorFallback';

interface SectionErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
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
        console.error('[GlobalErrorBoundary]', error, info.componentStack);
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}

/** Error boundary de seção — isola módulos individuais */
export function SectionErrorBoundary({ children, title, description }: SectionErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={(props) => (
        <ErrorFallback {...props} title={title} description={description} />
      )}
      onError={(error, info) => {
        console.error('[SectionErrorBoundary]', error, info.componentStack);
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
