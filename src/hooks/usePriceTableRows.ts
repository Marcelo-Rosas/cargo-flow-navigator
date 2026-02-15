import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type PriceTableRow = Database['public']['Tables']['price_table_rows']['Row'];
type PriceTableRowInsert = Database['public']['Tables']['price_table_rows']['Insert'];
type PriceTableRowUpdate = Database['public']['Tables']['price_table_rows']['Update'];

export function usePriceTableRows(priceTableId: string) {
  return useQuery({
    queryKey: ['price_table_rows', priceTableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_table_rows')
        .select('*')
        .eq('price_table_id', priceTableId)
        .order('km_from', { ascending: true });

      if (error) throw error;
      return data as PriceTableRow[];
    },
    enabled: !!priceTableId,
  });
}

export function usePriceTableRowByKmRange(priceTableId: string, kmDistance: number) {
  return useQuery({
    queryKey: ['price_table_rows', priceTableId, 'km', kmDistance],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_table_rows')
        .select('*')
        .eq('price_table_id', priceTableId)
        .lte('km_from', kmDistance)
        .gte('km_to', kmDistance)
        .maybeSingle();

      if (error) throw error;
      return data as PriceTableRow | null;
    },
    enabled: !!priceTableId && kmDistance >= 0,
  });
}

export function useCreatePriceTableRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (row: PriceTableRowInsert) => {
      const { data, error } = await supabase.from('price_table_rows').insert(row).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['price_table_rows', data.price_table_id] });
    },
  });
}

export function useCreatePriceTableRowsBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: PriceTableRowInsert[]) => {
      const { data, error } = await supabase.from('price_table_rows').insert(rows).select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data && data.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['price_table_rows', data[0].price_table_id] });
      }
    },
  });
}

export function useUpdatePriceTableRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PriceTableRowUpdate }) => {
      const { data, error } = await supabase
        .from('price_table_rows')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['price_table_rows', data.price_table_id] });
    },
  });
}

export function useDeletePriceTableRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, priceTableId }: { id: string; priceTableId: string }) => {
      const { error } = await supabase.from('price_table_rows').delete().eq('id', id);

      if (error) throw error;
      return { priceTableId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['price_table_rows', result.priceTableId] });
    },
  });
}

export function useDeleteRowsByTableId() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (priceTableId: string) => {
      const { error } = await supabase
        .from('price_table_rows')
        .delete()
        .eq('price_table_id', priceTableId);

      if (error) throw error;
      return { priceTableId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['price_table_rows', result.priceTableId] });
    },
  });
}
