import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import {
  GripVertical,
  CreditCard,
  Package,
  Route,
  Landmark,
  Truck,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FinancialKanbanRow } from '@/types/financial';

interface FinancialCardProps {
  row: FinancialKanbanRow;
  onEdit?: () => void;
  canManageActions?: boolean;
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

export function FinancialCard({ row, onEdit, canManageActions = true }: FinancialCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const rawAmount =
    row.type === 'PAG'
      ? (row.carreteiro_real ?? row.total_amount ?? row.order_value ?? 0)
      : (row.total_amount ?? row.quote_value ?? row.order_value ?? 0);
  const amount = Number(rawAmount);
  const name = (row.client_name ?? row.supplier_name ?? '—') as string;
  const dueDate = (row.next_due_date ?? row.due_date) as string | null | undefined;
  const code = (row.code ?? row.id?.slice(0, 8)) as string;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'bg-card rounded-lg border shadow-sm p-4 cursor-pointer group',
        'hover:shadow-md hover:border-primary/40 transition-all duration-200',
        isDragging && 'opacity-90 rotate-1 scale-[1.02] shadow-xl z-50',
        row.is_overdue && 'border-l-4 border-l-destructive'
      )}
      onClick={onEdit}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {canManageActions && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground">{code}</span>
              {row.is_overdue && (
                <Badge variant="destructive" className="text-xs shrink-0">
                  Atrasado
                </Badge>
              )}
            </div>
            <p className="font-medium text-sm truncate">{name}</p>
            {row.origin && row.destination && (
              <p className="text-xs text-muted-foreground truncate">
                {row.origin} → {row.destination}
              </p>
            )}
            <p className="text-lg font-semibold text-foreground">{formatCurrency(amount)}</p>

            {/* Trip chip + reconciliation badge (PAG) */}
            {(row.trip_id ?? row.trip_number) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                  <Truck className="w-3 h-3" />
                  {row.trip_number ?? `Trip`}
                </span>
                {row.is_reconciled === true && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-success bg-success/10 rounded px-1.5 py-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                    OK
                  </span>
                )}
                {row.is_reconciled === false &&
                  row.proofs_count != null &&
                  row.proofs_count > 0 &&
                  (row.paid_amount ?? 0) === 0 &&
                  row.expected_amount != null &&
                  Number(row.expected_amount) > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-warning-foreground bg-warning/10 rounded px-1.5 py-0.5">
                      <AlertCircle className="w-3 h-3" />
                      Pendente confirmação
                    </span>
                  )}
                {row.is_reconciled === false &&
                  row.proofs_count != null &&
                  row.proofs_count > 0 &&
                  !(
                    (row.paid_amount ?? 0) === 0 &&
                    row.expected_amount != null &&
                    Number(row.expected_amount) > 0
                  ) && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-destructive bg-destructive/10 rounded px-1.5 py-0.5">
                      <XCircle className="w-3 h-3" />
                      Divergente
                    </span>
                  )}
                {row.is_reconciled === false &&
                  (row.proofs_count ?? 0) === 0 &&
                  row.expected_amount != null &&
                  Number(row.expected_amount) > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-warning-foreground bg-warning/10 rounded px-1.5 py-0.5">
                      <AlertCircle className="w-3 h-3" />
                      Pendente
                    </span>
                  )}
              </div>
            )}

            {/* Enriched info chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {row.payment_term_name && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                  <CreditCard className="w-3 h-3" />
                  {row.payment_term_name}
                </span>
              )}
              {row.cargo_type && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                  <Package className="w-3 h-3" />
                  {row.cargo_type}
                </span>
              )}
              {row.km_distance != null && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                  <Route className="w-3 h-3" />
                  {Number(row.km_distance).toLocaleString('pt-BR')} km
                </span>
              )}
              {row.toll_value != null && Number(row.toll_value) > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                  <Landmark className="w-3 h-3" />
                  {formatCurrency(Number(row.toll_value))}
                </span>
              )}
            </div>

            {dueDate && (
              <p className="text-xs text-muted-foreground">Venc: {formatDate(dueDate)}</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
