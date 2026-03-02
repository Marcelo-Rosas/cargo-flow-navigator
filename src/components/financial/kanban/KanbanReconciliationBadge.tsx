import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface KanbanReconciliationBadgeProps {
  expectedAmount?: number | null;
  paidAmount?: number | null;
  isReconciled?: boolean | null;
  proofsCount?: number | null;
}

export function KanbanReconciliationBadge({
  expectedAmount,
  paidAmount,
  isReconciled,
  proofsCount,
}: KanbanReconciliationBadgeProps) {
  if (expectedAmount == null || Number(expectedAmount) <= 0) return null;

  const paid = paidAmount ?? 0;
  const proofs = proofsCount ?? 0;

  const wrapperClasses = 'flex flex-wrap items-center gap-1.5 pt-0.5';

  if (isReconciled === true) {
    return (
      <div className={wrapperClasses}>
        <span className="inline-flex items-center gap-1 text-[10px] text-success bg-success/10 rounded px-1.5 py-0.5">
          <CheckCircle2 className="w-3 h-3" />
          OK
        </span>
      </div>
    );
  }

  if (isReconciled === false) {
    if (proofs > 0 && paid === 0) {
      return (
        <div className={wrapperClasses}>
          <span className="inline-flex items-center gap-1 text-[10px] text-warning-foreground bg-warning/10 rounded px-1.5 py-0.5">
            <AlertCircle className="w-3 h-3" />
            Pendente confirmação
          </span>
        </div>
      );
    }

    if (proofs > 0 && paid !== 0) {
      return (
        <div className={wrapperClasses}>
          <span className="inline-flex items-center gap-1 text-[10px] text-destructive bg-destructive/10 rounded px-1.5 py-0.5">
            <XCircle className="w-3 h-3" />
            Divergente
          </span>
        </div>
      );
    }

    if (proofs === 0) {
      return (
        <div className={wrapperClasses}>
          <span className="inline-flex items-center gap-1 text-[10px] text-warning-foreground bg-warning/10 rounded px-1.5 py-0.5">
            <AlertCircle className="w-3 h-3" />
            Pendente
          </span>
        </div>
      );
    }
  }

  return null;
}
