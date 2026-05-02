import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CnhCategory {
  code: string;
  description: string;
}

export function useCnhCategories() {
  return useQuery<CnhCategory[]>({
    queryKey: ['cnh-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cnh_categories')
        .select('code, description')
        .eq('active', true)
        .order('code');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: Infinity,
  });
}
