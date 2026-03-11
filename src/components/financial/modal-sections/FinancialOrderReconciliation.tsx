import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { CarrierPaymentProofList } from '@/components/documents/CarrierPaymentProofList';
import { useProcessPaymentProof } from '@/hooks/usePaymentProofs';
import type { Database } from '@/integrations/supabase/types';

type DocumentType = Database['public']['Enums']['document_type'];

interface FinancialOrderReconciliationProps {
  orderId: string;
  allowComprovanteDescarga?: boolean;
}

export function FinancialOrderReconciliation({
  orderId,
  allowComprovanteDescarga = false,
}: FinancialOrderReconciliationProps) {
  const queryClient = useQueryClient();
  const processProofMutation = useProcessPaymentProof();

  const handleCarrierDocCreated = async (documentId: string, _type: DocumentType) => {
    try {
      await processProofMutation.mutateAsync(documentId);
    } catch {
      toast.error('Arquivo salvo, mas erro ao processar comprovante');
    }
  };

  return (
    <div className="space-y-3">
      <DocumentUpload
        orderId={orderId}
        financialContext="carrier_payment"
        allowComprovanteDescarga={allowComprovanteDescarga}
        onCarrierPaymentDocCreated={handleCarrierDocCreated}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['payment_proofs'] })}
      />
      <CarrierPaymentProofList orderId={orderId} />
    </div>
  );
}
