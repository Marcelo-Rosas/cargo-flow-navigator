import { formatDate } from '@/lib/formatters';

interface FinancialDueDateProps {
  dueDate: string;
}

export function FinancialDueDate({ dueDate }: FinancialDueDateProps) {
  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border">
      <p className="text-xs text-muted-foreground">Próximo vencimento</p>
      <p className="font-medium">{formatDate(dueDate, { month: 'long' })}</p>
    </div>
  );
}
