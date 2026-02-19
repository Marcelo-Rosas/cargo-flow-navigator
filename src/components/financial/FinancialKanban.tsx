import { Loader2 } from 'lucide-react';
import { useFinancialBoardData } from '@/hooks/useFinancialBoardData';
import type { FinancialDocType } from '@/types/financial';
import type { FinancialKanbanRow } from '@/types/financial';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FinancialKanbanProps {
  type: FinancialDocType;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function FinancialCard({ row }: { row: FinancialKanbanRow }) {
  const amount = row.amount ?? 0;
  const name = row.client_name ?? row.supplier_name ?? '—';

  return (
    <Card className={cn('cursor-default', row.is_overdue && 'border-destructive/50')}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium text-sm truncate">{name}</span>
          {row.is_overdue && (
            <Badge variant="destructive" className="shrink-0 text-xs">
              Atrasado
            </Badge>
          )}
        </div>
        <div className="text-lg font-semibold">{formatCurrency(amount)}</div>
        {row.due_date && (
          <div className="text-xs text-muted-foreground">Venc: {formatDate(row.due_date)}</div>
        )}
      </CardContent>
    </Card>
  );
}

export function FinancialKanban({ type }: FinancialKanbanProps) {
  const { columns, isLoading, isError, error } = useFinancialBoardData(type);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-destructive">
        Erro ao carregar: {error instanceof Error ? error.message : 'Erro desconhecido'}
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div key={col.status} className="flex flex-col min-w-[280px] max-w-[320px] flex-shrink-0">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-semibold text-foreground">{col.label}</h3>
            <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {col.items.length}
            </span>
          </div>
          <div className="flex-1 p-2 rounded-lg bg-muted/30 min-h-[200px] space-y-3">
            {col.items.map((row) => (
              <FinancialCard key={row.id} row={row} />
            ))}
          </div>
        </div>
      ))}
      {columns.length === 0 && (
        <div className="w-full py-16 text-center text-muted-foreground">
          Nenhum registro encontrado.
        </div>
      )}
    </div>
  );
}
