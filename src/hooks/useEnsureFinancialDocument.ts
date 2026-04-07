import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/supabase-invoke';
import type { FinancialDocType } from '@/types/financial';

type EnsureFinancialDocumentInput = {
  docType: FinancialDocType; // 'FAT' | 'PAG'
  sourceId: string; // uuid
  totalAmount?: number | null; // optional fallback
};

type EnsureFinancialDocumentResponse = {
  data: unknown;
};

export function useEnsureFinancialDocument() {
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ['ensure-financial-document'],
    mutationFn: async (input: EnsureFinancialDocumentInput) => {
      return invokeEdgeFunction<EnsureFinancialDocumentResponse>(
        'ensure-financial-document',
        input
      );
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['financial-kanban'] }),
        qc.invalidateQueries({ queryKey: ['quotes'] }),
        qc.invalidateQueries({ queryKey: ['orders'] }),
        qc.invalidateQueries({ queryKey: ['card'] }),
        qc.invalidateQueries({ queryKey: ['cash-flow-summary'] }),
      ]);
    },
  });
}
