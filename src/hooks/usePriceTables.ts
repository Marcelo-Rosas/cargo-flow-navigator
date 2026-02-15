import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb, asInsert, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type PriceTable = Database['public']['Tables']['price_tables']['Row'];
type PriceTableInsert = Database['public']['Tables']['price_tables']['Insert'];
type PriceTableUpdate = Database['public']['Tables']['price_tables']['Update'];

export function usePriceTables() {
  return useQuery({
    queryKey: ['price_tables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_tables')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return filterSupabaseRows<PriceTable>(data);
    },
  });
}

export function usePriceTable(id: string) {
  return useQuery({
    queryKey: ['price_tables', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_tables')
        .select('*')
        .eq('id', asDb(id))
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<PriceTable>(data);
    },
    enabled: !!id,
  });
}

export function usePriceTablesByModality(modality: 'lotacao' | 'fracionado') {
  return useQuery({
    queryKey: ['price_tables', 'modality', modality],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_tables')
        .select('*')
        .eq('modality', asDb(modality))
        .order('created_at', { ascending: false });

      if (error) throw error;
      return filterSupabaseRows<PriceTable>(data);
    },
    enabled: !!modality,
  });
}

export function useActivePriceTable(modality: 'lotacao' | 'fracionado') {
  return useQuery({
    queryKey: ['price_tables', 'active', modality],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_tables')
        .select('*')
        .eq('modality', asDb(modality))
        .eq('active', asDb(true))
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<PriceTable>(data);
    },
    enabled: !!modality,
  });
}

export function useCreatePriceTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (priceTable: PriceTableInsert) => {
      const { data, error } = await supabase
        .from('price_tables')
        .insert(asInsert(priceTable))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price_tables'] });
    },
  });
}

export function useUpdatePriceTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PriceTableUpdate }) => {
      const { data, error } = await supabase
        .from('price_tables')
        .update(asInsert(updates))
        .eq('id', asDb(id))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price_tables'] });
    },
  });
}

export function useDeletePriceTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('price_tables').delete().eq('id', asDb(id));

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price_tables'] });
    },
  });
}

export function useSetActivePriceTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ modality, id }: { modality: 'lotacao' | 'fracionado'; id: string }) => {
      // First, deactivate all tables of the same modality
      const { error: deactivateError } = await supabase
        .from('price_tables')
        .update(asInsert({ active: false }))
        .eq('modality', asDb(modality))
        .neq('id', asDb(id));

      if (deactivateError) throw deactivateError;

      // Then, activate the target table
      const { data, error: activateError } = await supabase
        .from('price_tables')
        .update(asInsert({ active: true }))
        .eq('id', asDb(id))
        .select()
        .single();

      if (activateError) throw activateError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price_tables'] });
    },
  });
}
