import { Calendar, Clock } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

interface QuoteModalHistoryTabProps {
  createdAt: string;
  updatedAt: string;
  advanceDueDate?: string | null;
  balanceDueDate?: string | null;
  advancePercent?: number | null;
  totalCliente: number;
}

export function QuoteModalHistoryTab({
  createdAt,
  updatedAt,
  advanceDueDate,
  balanceDueDate,
  advancePercent = 0,
  totalCliente,
}: QuoteModalHistoryTabProps) {
  const hasAdvance = advancePercent != null && advancePercent > 0;
  const advanceVal = hasAdvance ? (totalCliente * advancePercent) / 100 : 0;
  const balanceVal = hasAdvance ? (totalCliente * (100 - advancePercent)) / 100 : totalCliente;

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Timeline
        </h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">Criado em</span>
            <span className="text-sm font-medium tabular-nums">{formatDateTime(createdAt)}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">Atualizado em</span>
            <span className="text-sm font-medium tabular-nums">{formatDateTime(updatedAt)}</span>
          </div>
        </div>
      </div>
      {hasAdvance && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Adiantamento e Saldo
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-primary/5 border-primary/20">
              <p className="text-xs font-semibold text-muted-foreground mb-0.5">
                Adiantamento {advancePercent}%
              </p>
              <p className="font-semibold text-foreground">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(advanceVal)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {advanceDueDate ? formatDate(advanceDueDate, { month: 'long' }) : '—'}
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground mb-0.5">
                Saldo {100 - advancePercent}%
              </p>
              <p className="font-semibold text-foreground">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(balanceVal)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {balanceDueDate ? formatDate(balanceDueDate, { month: 'long' }) : '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
