import { QuotePaymentProofList } from '@/components/documents/QuotePaymentProofList';

interface FinancialQuoteReconciliationProps {
  quoteId: string;
}

export function FinancialQuoteReconciliation({ quoteId }: FinancialQuoteReconciliationProps) {
  return (
    <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
      <h4 className="font-semibold text-foreground text-sm">Conciliação de Recebimento</h4>
      <QuotePaymentProofList quoteId={quoteId} />
    </div>
  );
}
