import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb, asInsert, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';

export interface Driver {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
}

type UseDriversOptions = { enabled?: boolean };

export function useDrivers(activeOnly = true, options: UseDriversOptions = {}) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: ['drivers', activeOnly],
    enabled,
    queryFn: async () => {
      let query = supabase
        .from('drivers')
        .select('id, name, phone, active')
        .order('name', { ascending: true });
      if (activeOnly) {
        query = query.eq('active', asDb(true));
      }
      const { data, error } = await query;
      if (error) throw error;
      return filterSupabaseRows<Driver>(data);
    },
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (driver: { name: string; phone?: string | null; active?: boolean }) => {
      const { data, error } = await supabase
        .from('drivers')
        .insert(asInsert(driver))
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drivers'] }),
  });
}

export function useUpdateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: { name?: string; phone?: string | null; active?: boolean };
    }) => {
      const { data, error } = await supabase
        .from('drivers')
        .update(asInsert(updates))
        .eq('id', asDb(id))
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drivers'] }),
  });
}

export function useDeleteDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('drivers').delete().eq('id', asDb(id));
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drivers'] }),
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
        .eq('id', asDb(id))
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<Driver>(data);
    },
    enabled: !!id,
  });
}
