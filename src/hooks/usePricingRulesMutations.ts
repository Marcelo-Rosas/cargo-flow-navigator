import { useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';

export function useUpdatePricingRuleConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const sb = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };
      const { data, error } = await sb
        .from('pricing_rules_config')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('id', asDb(id))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-rules-config'] });
    },
  });
}
