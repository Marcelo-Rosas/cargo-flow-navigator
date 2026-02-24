import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

export interface BudgetConfigEntry {
  id: string;
  key: string;
  value: number;
  description: string | null;
  updated_at: string;
}

// ─────────────────────────────────────────────────────
// Hook: Read budget config
// ─────────────────────────────────────────────────────

export function useAiBudgetConfig() {
  return useQuery({
    queryKey: ['ai-budget-config'],
    queryFn: async (): Promise<BudgetConfigEntry[]> => {
      const { data, error } = await supabase
        .from('ai_budget_config' as never)
        .select('*')
        .order('key');

      if (error) {
        console.warn('Failed to fetch AI budget config:', error.message);
        return [];
      }

      return (data || []) as unknown as BudgetConfigEntry[];
    },
    staleTime: 60_000, // Budget config doesn't change often
  });
}

// ─────────────────────────────────────────────────────
// Hook: Update budget config
// ─────────────────────────────────────────────────────

export function useUpdateBudgetConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: number }) => {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('ai_budget_config' as never)
        .update({
          value,
          updated_by: userData?.user?.id || null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('key' as never, key as never);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-budget-config'] });
      queryClient.invalidateQueries({ queryKey: ['ai-usage-stats'] });
      toast({
        title: 'Configuração atualizada',
        description: 'O limite de budget foi alterado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar',
        description: String(error),
        variant: 'destructive',
      });
    },
  });
}
