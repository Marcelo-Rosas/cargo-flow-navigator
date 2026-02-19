import { MapPin, DollarSign } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { FinancialKanbanRow } from '@/types/financial';

interface FinancialDetailModalProps {
  open: boolean;
  onClose: () => void;
  doc: FinancialKanbanRow | null;
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
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateStr));
}

export function FinancialDetailModal({ open, onClose, doc }: FinancialDetailModalProps) {
  if (!doc) return null;

  const rawAmount = doc.total_amount ?? doc.quote_value ?? doc.order_value ?? 0;
  const amount = Number(rawAmount);
  const name = (doc.client_name ?? doc.supplier_name ?? '—') as string;
  const dueDate = (doc.next_due_date ?? doc.due_date) as string | null | undefined;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{doc.code ?? doc.id?.slice(0, 8)}</span>
            <Badge variant={doc.is_overdue ? 'destructive' : 'secondary'}>
              {doc.status}
              {doc.is_overdue && ' • Atrasado'}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <p className="text-sm text-muted-foreground">Cliente</p>
            <p className="font-medium">{name}</p>
          </div>
          {doc.origin && doc.destination && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">Rota</p>
                <p className="font-medium">
                  {doc.origin} → {doc.destination}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Valor</p>
              <p className="text-xl font-bold">{formatCurrency(amount)}</p>
            </div>
          </div>
          {dueDate && (
            <div>
              <p className="text-sm text-muted-foreground">Próximo vencimento</p>
              <p className="font-medium">{formatDate(dueDate)}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
