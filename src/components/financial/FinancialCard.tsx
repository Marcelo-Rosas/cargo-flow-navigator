import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { KanbanReconciliationBadge } from '@/components/financial/kanban/KanbanReconciliationBadge';
import { KanbanTripChip } from '@/components/financial/kanban/KanbanTripChip';
import { KanbanEnrichedChips } from '@/components/financial/kanban/KanbanEnrichedChips';
import { cn } from '@/lib/utils';
import type { FinancialKanbanRow } from '@/types/financial';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface FinancialCardProps {
  row: FinancialKanbanRow;
  onEdit?: () => void;
  canManageActions?: boolean;
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
      data-testid={`financial-card-${row.id}`}
      style={style}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'bg-card rounded-lg border border-border shadow-card p-4 cursor-pointer group',
        'hover:shadow-card-hover hover:border-primary/30 transition-all duration-200',
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
              data-testid={`financial-card-drag-handle-${row.id}`}
              aria-label="Arrastar cartão"
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

            {/* Trip chip (PAG only) */}
            <KanbanTripChip
              tripId={row.trip_id as string | null}
              tripNumber={row.trip_number as string | null}
            />

            {/* Reconciliation badges (PAG and FAT) */}
            <KanbanReconciliationBadge
              expectedAmount={row.expected_amount as number | null}
              paidAmount={row.paid_amount as number | null}
              isReconciled={row.is_reconciled as boolean | null}
              proofsCount={row.proofs_count as number | null}
            />

            {/* Enriched info chips */}
            <KanbanEnrichedChips
              paymentTermName={row.payment_term_name as string | null}
              cargoType={row.cargo_type as string | null}
              kmDistance={row.km_distance as number | null}
              tollValue={row.toll_value as number | null}
            />

            {dueDate && (
              <p className="text-xs text-muted-foreground">Venc: {formatDate(dueDate)}</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
