import { FileQuestion, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  isLoading?: boolean;
}

export function EmptyState({
  title = 'Nenhum dado encontrado',
  description = 'Não há informações para exibir no momento.',
  icon = <FileQuestion className="h-10 w-10 text-muted-foreground" />,
  actionLabel = 'Recarregar',
  onAction,
  isLoading = false,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center animate-in fade-in-50">
      <div className="rounded-full bg-muted p-4 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-sm">{description}</p>

      {onAction && (
        <Button variant="outline" onClick={onAction} disabled={isLoading}>
          {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
