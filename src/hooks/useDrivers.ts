import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Driver {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
}

export function useDrivers() {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, name, phone, active')
        .eq('active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Driver[];
    },
  });
}

export function useDriver(id: string | null | undefined) {
  return useQuery({
    queryKey: ['drivers', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('drivers')
        .select('id, name, phone, active')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Driver | null;
    },
    enabled: !!id,
  });
}
