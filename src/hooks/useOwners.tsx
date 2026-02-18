import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb, asInsert, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';

type Owner = Database['public']['Tables']['owners']['Row'];
type OwnerInsert = Database['public']['Tables']['owners']['Insert'];
type OwnerUpdate = Database['public']['Tables']['owners']['Update'];

interface UseOwnersOptions {
  enabled?: boolean;
}

export function useOwners(searchTerm?: string, options: UseOwnersOptions = {}) {
  const { enabled = true } = options;
  const { user } = useAuth();

  return useQuery({
    queryKey: ['owners', searchTerm],
    queryFn: async () => {
      let query = supabase.from('owners').select('*').order('name', { ascending: true });

      if (searchTerm) {
        query = query.or(
          `name.ilike.%${searchTerm}%,cpf_cnpj.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      return filterSupabaseRows<Owner>(data);
    },
    enabled: enabled && !!user,
  });
}

export function useOwner(id: string | null | undefined) {
  return useQuery({
    queryKey: ['owners', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('owners')
        .select('*')
        .eq('id', asDb(id))
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<Owner>(data);
    },
    enabled: !!id,
  });
}

export function useCreateOwner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (owner: OwnerInsert) => {
      const { data, error } = await supabase
        .from('owners')
        .insert(asInsert(owner))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owners'] });
    },
  });
}

export function useUpdateOwner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: OwnerUpdate }) => {
      const { data, error } = await supabase
        .from('owners')
        .update(asInsert(updates))
        .eq('id', asDb(id))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owners'] });
    },
  });
}

export function useDeleteOwner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('owners').delete().eq('id', asDb(id));

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owners'] });
    },
  });
}
