import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import {
  normalizeCompanySettingsPayload,
  mapCompanySettingsSaveError,
} from '@/lib/company-settings-normalize';

type CompanySettings = Database['public']['Tables']['company_settings']['Row'];
type CompanySettingsUpdate = Database['public']['Tables']['company_settings']['Update'];

const QUERY_KEY = ['company_settings'] as const;

export { normalizeCompanySettingsPayload } from '@/lib/company-settings-normalize';

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
      const payload = normalizeCompanySettingsPayload(rest);
      const { data, error } = await supabase
        .from('company_settings')
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw new Error(mapCompanySettingsSaveError(error));
      if (!data) {
        throw new Error(mapCompanySettingsSaveError({ code: 'PGRST116' }));
      }
      return data as CompanySettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
