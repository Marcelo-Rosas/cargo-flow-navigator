import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type CompanySettings = Database['public']['Tables']['company_settings']['Row'];
type CompanySettingsUpdate = Database['public']['Tables']['company_settings']['Update'];

const QUERY_KEY = ['company_settings'] as const;

export function useCompanySettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('company_settings').select('*').maybeSingle();
      if (error) throw error;
      return data as CompanySettings | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: CompanySettingsUpdate & { id: string }) => {
      const { id, ...rest } = updates;
      const { data, error } = await supabase
        .from('company_settings')
        .update(rest)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as CompanySettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
