import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import type { Database } from '@/integrations/supabase/types.generated';

type QuoteContract = Database['public']['Tables']['quote_contracts']['Row'];

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
    staleTime: 30_000,
  });
}

export function useGenerateContract(quoteId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (forceRegenerate = false) => {
      if (!quoteId) throw new Error('quote_id is required');
      return invokeEdgeFunction<{
        contract_id: string;
        pdf_storage_path: string;
        pdf_file_name: string;
        version: number;
        signed_url: string | null;
        already_existed: boolean;
      }>('generate-contract-pdf', {
        body: { quote_id: quoteId, force_regenerate: forceRegenerate },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote_contracts', quoteId] });
    },
  });
}
