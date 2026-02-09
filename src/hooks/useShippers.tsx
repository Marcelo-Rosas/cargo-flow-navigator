import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';

type Shipper = Database['public']['Tables']['shippers']['Row'];
type ShipperInsert = Database['public']['Tables']['shippers']['Insert'];
type ShipperUpdate = Database['public']['Tables']['shippers']['Update'];

interface UseShippersOptions {
  enabled?: boolean;
}

export function useShippers(searchTerm?: string, options: UseShippersOptions = {}) {
  const { enabled = true } = options;
  const { user } = useAuth();

  return useQuery({
    queryKey: ['shippers', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('shippers')
        .select('*')
        .order('name', { ascending: true });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,cnpj.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Shipper[];
    },
    enabled: enabled && !!user,
  });
}

export function useShipper(id: string) {
  return useQuery({
    queryKey: ['shippers', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shippers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Shipper | null;
    },
    enabled: !!id,
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

export function useUpdateShipper() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ShipperUpdate }) => {
      const { data, error } = await supabase
        .from('shippers')
        .update(updates)
        .eq('id', id)
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

export function useDeleteShipper() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shippers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shippers'] });
    },
  });
}
