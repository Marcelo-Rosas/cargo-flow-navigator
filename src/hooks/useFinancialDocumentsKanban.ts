import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FinancialDocType } from '@/types/financial';
import type { FinancialKanbanRow } from '@/types/financial';

type Params = {
  type: FinancialDocType;
  status?: string;
  overdueOnly?: boolean;
  rich?: boolean;
  enabled?: boolean;
};

const VIEW_BY_TYPE: Record<FinancialDocType, string> = {
  FAT: 'financial_receivable_kanban',
  PAG: 'financial_payable_kanban',
};

export function useFinancialDocumentsKanban(params: Params) {
  const { type, rich = false, enabled = true } = params;
  const viewName = VIEW_BY_TYPE[type];

  return useQuery({
    queryKey: ['financial-kanban', type, params.status, params.overdueOnly, rich],
    queryFn: async (): Promise<FinancialKanbanRow[]> => {
      try {
        const query = supabase.from(viewName as 'documents').select('*');
        const { data, error } = await query;

        if (error) {
          // View may not exist yet
          if (error.code === '42P01' || error.code === 'PGRST116') return [];
          throw error;
        }
        return (data ?? []) as FinancialKanbanRow[];
      } catch {
        return [];
      }
    },
    enabled,
  });
}
