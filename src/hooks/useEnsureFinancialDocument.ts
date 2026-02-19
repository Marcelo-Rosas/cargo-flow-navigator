import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
      const { data, error } = await supabase.functions.invoke<EnsureFinancialDocumentResponse>(
        'ensure-financial-document',
        { body: input }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['financial-kanban'] }),
        qc.invalidateQueries({ queryKey: ['quotes'] }),
        qc.invalidateQueries({ queryKey: ['orders'] }),
      ]);
    },
  });
}
