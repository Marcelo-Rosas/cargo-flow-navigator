import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import type { Database } from '@/integrations/supabase/types.generated';

type QuoteContract = Database['public']['Tables']['quote_contracts']['Row'];

type GenerateContractResponse = {
  contract_id: string;
  pdf_storage_path: string;
  pdf_file_name: string;
  version: number;
  signed_url: string | null;
  already_existed: boolean;
};

export function useQuoteContract(quoteId: string | undefined) {
  return useQuery({
    queryKey: ['quote_contracts', quoteId],
    enabled: !!quoteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_contracts')
        .select('*')
        .eq('quote_id', quoteId!)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as QuoteContract | null;
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

export function useGenerateContract(quoteId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<GenerateContractResponse, Error, boolean>({
    mutationFn: async (forceRegenerate) => {
      if (!quoteId) throw new Error('quote_id is required');
      return invokeEdgeFunction<GenerateContractResponse>('generate-contract-pdf', {
        body: { quote_id: quoteId, force_regenerate: forceRegenerate },
      });
    },
    onSuccess: async (data) => {
      if (quoteId && data.contract_id) {
        queryClient.setQueryData<QuoteContract | null>(
          ['quote_contracts', quoteId],
          (prev) =>
            ({
              ...(prev ?? ({} as QuoteContract)),
              id: data.contract_id,
              quote_id: quoteId,
              version: data.version,
              pdf_storage_path: data.pdf_storage_path,
              pdf_file_name: data.pdf_file_name,
              generated_at: new Date().toISOString(),
              signature_status: prev?.signature_status ?? 'pending',
            }) as QuoteContract
        );
      }
      await queryClient.refetchQueries({ queryKey: ['quote_contracts', quoteId] });
    },
  });
}
