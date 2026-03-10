import { CalendarDays, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { useLoadingFollowUp } from '@/hooks/useLoadingFollowUp';
import { Badge } from '@/components/ui/badge';

const STAGE_LABELS: Record<string, string> = {
  novo_pedido: 'Novo',
  qualificacao: 'Qualificação',
  precificacao: 'Precificação',
  enviado: 'Enviado',
  negociacao: 'Negociação',
};

function formatDateBR(d: string): string {
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
}

function daysUntil(d: string): number {
  const target = new Date(d + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

export function LoadingFollowUpPanel() {
  const { data: rows, isLoading, isError } = useLoadingFollowUp();

  if (isLoading) {
    return (
      <div className="border rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-muted rounded w-48 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !rows || rows.length === 0) {
    return null;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-primary/5 border-b px-4 py-3 flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Follow-up de Carregamento</h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {rows.length} cotações
        </Badge>
      </div>
      <div className="divide-y max-h-[400px] overflow-y-auto">
        {rows.map((row) => {
          const days = daysUntil(row.estimated_loading_date);
          const isOverdue = days < 0;
          const isUrgent = days >= 0 && days <= 3;
          return (
            <div
              key={row.id}
              className={`px-4 py-3 flex items-center gap-3 text-sm ${
                isOverdue ? 'bg-destructive/5' : isUrgent ? 'bg-warning/5' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">
                    {row.quote_code || row.id.slice(0, 8)}
                  </span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {STAGE_LABELS[row.stage] || row.stage}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {row.client_name} — {row.origin} → {row.destination}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1.5 justify-end">
                  {(isOverdue || isUrgent) && (
                    <AlertTriangle
                      className={`w-3.5 h-3.5 ${isOverdue ? 'text-destructive' : 'text-warning'}`}
                    />
                  )}
                  <span
                    className={`text-xs font-semibold ${
                      isOverdue ? 'text-destructive' : isUrgent ? 'text-warning' : 'text-foreground'
                    }`}
                  >
                    {formatDateBR(row.estimated_loading_date)}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {isOverdue ? `${Math.abs(days)}d atrasado` : days === 0 ? 'Hoje' : `em ${days}d`}{' '}
                  · {formatCurrency(row.value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
