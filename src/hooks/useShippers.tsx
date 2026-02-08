import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';

type Shipper = Database['public']['Tables']['shippers']['Row'];
type ShipperInsert = Database['public']['Tables']['shippers']['Insert'];

export function useShippers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['shippers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shippers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Shipper[];
    },
    enabled: !!user,
  });
}

export function useCreateShipper() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shipper: ShipperInsert) => {
      const { data, error } = await supabase
        .from('shippers')
        .insert(shipper)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shippers'] });
    },
  });
}
