import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { QuotePaymentProofList } from '@/components/documents/QuotePaymentProofList';
import { useProcessQuotePaymentProof } from '@/hooks/useQuotePaymentProofs';

interface FinancialQuoteReconciliationProps {
  quoteId: string;
}

export function FinancialQuoteReconciliation({ quoteId }: FinancialQuoteReconciliationProps) {
  const queryClient = useQueryClient();
  const processProofMutation = useProcessQuotePaymentProof();

  const handleDocCreated = async (documentId: string) => {
    try {
      await processProofMutation.mutateAsync(documentId);
    } catch {
      toast.error('Arquivo salvo, mas erro ao processar conciliação');
    }
  };

  return (
    <div className="space-y-3">
      {/* Financeiro pode fazer upload direto aqui (sem depender do comercial) */}
      <DocumentUpload
        quoteId={quoteId}
        financialContext="quote_receivable"
        onQuotePaymentDocCreated={handleDocCreated}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['documents'] })}
      />
      {/* Tabela de conciliação: comprovantes, valores, delta e motivo */}
      <QuotePaymentProofList quoteId={quoteId} />
    </div>
  );
}
