import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type Params = {
  id: string;
  status: string;
};

export function useUpdateFinancialDocumentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: Params) => {
      const { error } = await supabase.from('financial_documents').update({ status }).eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
    },
  });
}
