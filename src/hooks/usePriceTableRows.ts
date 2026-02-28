import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb, asInsert, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
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
        .eq('price_table_id', asDb(priceTableId))
        .order('km_from', { ascending: true });

      if (error) throw error;
      return filterSupabaseRows<PriceTableRow>(data);
    },
    enabled: !!priceTableId,
  });
}

export function usePriceTableRowByKmRange(priceTableId: string, kmDistance: number) {
  const kmRounded = Math.round(kmDistance);
  return useQuery({
    queryKey: ['price_table_rows', priceTableId, 'km', kmRounded],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_table_rows')
        .select('*')
        .eq('price_table_id', asDb(priceTableId))
        .lte('km_from', asDb(kmRounded))
        .gte('km_to', asDb(kmRounded))
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<PriceTableRow>(data);
    },
    enabled: !!priceTableId && kmDistance >= 0,
  });
}

/** Mapeia modalidade para arredondamento: lotação = ceil, fracionado = round */
function roundingForModality(modality?: 'lotacao' | 'fracionado'): 'ceil' | 'floor' | 'round' {
  return modality === 'lotacao' ? 'ceil' : 'round';
}

/** Busca faixa via Edge Function price-row (usa RPC find_price_row_by_km) */
export function usePriceTableRowByKmFromEdgeFn(
  priceTableId: string,
  kmDistance: number,
  modality?: 'lotacao' | 'fracionado',
  isAuthenticated?: boolean
) {
  const rounding = roundingForModality(modality);
  return useQuery({
    queryKey: ['price_table_rows', 'edgefn', priceTableId, kmDistance, rounding, isAuthenticated],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      let token = sessionData?.session?.access_token;
      if (!token) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        token = refreshData?.session?.access_token ?? undefined;
      }
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const { data, error } = await supabase.functions.invoke('price-row', {
        body: {
          p_price_table_id: asDb(priceTableId),
          p_km_numeric: Number(kmDistance),
          p_rounding: rounding,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        const ctx = (error as { name?: string; context?: Response }).context;
        if (ctx && typeof (ctx as Response).json === 'function') {
          const body = (await (ctx as Response).json().catch(() => ({}))) as { error?: string };
          const msg = body?.error ?? (error as Error).message;
          throw new Error(msg);
        }
        throw error;
      }
      const row = data?.row ?? data?.rows?.[0] ?? null;
      return row ? filterSupabaseSingle<PriceTableRow>(row) : null;
    },
    // Só chama a Edge Function se usuário autenticado, tabela definida e KM > 0
    enabled: !!isAuthenticated && !!priceTableId && kmDistance > 0,
    // Evita ficar insistindo em erros de autenticação
    retry: (failureCount, error) => {
      const msg = (error as Error)?.message || '';
      if (/401|403|unauthoriz/i.test(msg)) return false;
      return failureCount < 3;
    },
    refetchOnWindowFocus: false,
  });
}

export function useCreatePriceTableRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (row: PriceTableRowInsert) => {
      const { data, error } = await supabase
        .from('price_table_rows')
        .insert(asInsert(row))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const row = filterSupabaseSingle<{ price_table_id: string }>(data);
      if (row)
        queryClient.invalidateQueries({ queryKey: ['price_table_rows', row.price_table_id] });
    },
  });
}

export function useCreatePriceTableRowsBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: PriceTableRowInsert[]) => {
      const { data, error } = await supabase
        .from('price_table_rows')
        .insert(asInsert(rows))
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const validRows = filterSupabaseRows<{ price_table_id: string }>(data);
      if (validRows.length > 0) {
        queryClient.invalidateQueries({
          queryKey: ['price_table_rows', validRows[0].price_table_id],
        });
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
        .update(asInsert(updates))
        .eq('id', asDb(id))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const row = filterSupabaseSingle<{ price_table_id: string }>(data);
      if (row)
        queryClient.invalidateQueries({ queryKey: ['price_table_rows', row.price_table_id] });
    },
  });
}

export function useDeletePriceTableRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, priceTableId }: { id: string; priceTableId: string }) => {
      const { error } = await supabase.from('price_table_rows').delete().eq('id', asDb(id));

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
        .eq('price_table_id', asDb(priceTableId));

      if (error) throw error;
      return { priceTableId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['price_table_rows', result.priceTableId] });
    },
  });
}
