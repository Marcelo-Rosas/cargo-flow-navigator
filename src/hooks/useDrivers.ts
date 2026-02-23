import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb, asInsert, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';

export interface Driver {
  id: string;
  name: string;
  phone: string | null;
  cnh: string | null;
  cnh_category: string | null;
  antt: string | null;
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
        .select('id, name, phone, cnh, cnh_category, antt, active')
        .order('name', { ascending: true });
      if (activeOnly) {
        query = query.eq('active', asDb(true));
      }
      const { data, error } = await query;

      if (error) {
        // Fallback gracioso: tenta select mínimo se colunas novas ainda não existem no banco
        const msg = error.message || '';
        if (
          msg.includes('column') ||
          msg.includes('cnh') ||
          msg.includes('active') ||
          msg.includes('relation')
        ) {
          const { data: fd, error: fe } = await supabase
            .from('drivers')
            .select('id, name, phone')
            .order('name', { ascending: true });
          if (fe) throw fe;
          return (filterSupabaseRows<Driver>(fd) || []).map((d) => ({
            ...d,
            cnh: null,
            cnh_category: null,
            antt: null,
            active: true, // assume ativo enquanto banco não tem a coluna
          }));
        }
        throw error;
      }

      return filterSupabaseRows<Driver>(data);
    },
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (driver: {
      name: string;
      phone?: string | null;
      cnh?: string | null;
      cnh_category?: string | null;
      antt?: string | null;
      active?: boolean;
    }) => {
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
      updates: {
        name?: string;
        phone?: string | null;
        cnh?: string | null;
        cnh_category?: string | null;
        antt?: string | null;
        active?: boolean;
      };
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
        .select('id, name, phone, cnh, cnh_category, antt, active')
        .eq('id', asDb(id))
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<Driver>(data);
    },
    enabled: !!id,
  });
}
