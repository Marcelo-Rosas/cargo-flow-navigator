import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCashFlowSummary } from '@/hooks/useCashFlowSummary';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function CashFlowReport() {
  const { data: rows, isLoading, isError, error } = useCashFlowSummary();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-destructive">
        Erro ao carregar fluxo de caixa:{' '}
        {error instanceof Error ? error.message : 'Erro desconhecido'}
      </div>
    );
  }

  const items = rows ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold text-foreground mb-4">Resumo por mês</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">
                <span className="inline-flex items-center gap-1 text-success">
                  <TrendingUp className="w-4 h-4" />
                  Entradas
                </span>
              </TableHead>
              <TableHead className="text-right">
                <span className="inline-flex items-center gap-1 text-destructive">
                  <TrendingDown className="w-4 h-4" />
                  Saídas
                </span>
              </TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Nenhum dado de fluxo de caixa no período.
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.period}>
                  <TableCell className="font-medium">{row.periodLabel}</TableCell>
                  <TableCell className="text-right text-success">
                    {formatCurrency(row.entradas)}
                  </TableCell>
                  <TableCell className="text-right text-destructive">
                    {formatCurrency(row.saidas)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      row.saldo >= 0 ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {formatCurrency(row.saldo)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Placeholder para gráfico futuro (Recharts) */}
      <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-muted-foreground">
        <p className="text-sm">Gráfico de fluxo de caixa (futuro)</p>
        <p className="text-xs mt-1">Integração com Recharts</p>
      </div>
    </div>
  );
}
