import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb, asInsert, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderInsert = Database['public']['Tables']['orders']['Insert'];
type OrderUpdate = Database['public']['Tables']['orders']['Update'];
type OrderStage = Database['public']['Enums']['order_stage'];
type Occurrence = Database['public']['Tables']['occurrences']['Row'];
type Quote = Database['public']['Tables']['quotes']['Row'];

export interface OrderWithOccurrences extends Order {
  occurrences: Occurrence[];
  quote?:
    | (Pick<
        Quote,
        | 'id'
        | 'shipper_name'
        | 'shipper_id'
        | 'client_name'
        | 'client_id'
        | 'origin'
        | 'origin_cep'
        | 'destination'
        | 'destination_cep'
        | 'freight_type'
        | 'km_distance'
        | 'vehicle_type_id'
      > & {
        vehicle_type?: {
          axes_count: number | null;
          code: string;
          name: string;
        } | null;
      })
    | null;
}

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          `
          *,
          occurrences (*),
          quote:quotes (
            id,
            shipper_name,
            shipper_id,
            client_name,
            client_id,
            origin,
            origin_cep,
            destination,
            destination_cep,
            freight_type,
            km_distance,
            vehicle_type_id,
            vehicle_type:vehicle_types (
              axes_count,
              code,
              name
            )
          )
        `
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      return filterSupabaseRows<OrderWithOccurrences>(data);
    },
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          `
          *,
          occurrences (*),
          quote:quotes (
            id,
            shipper_name,
            shipper_id,
            client_name,
            client_id,
            origin,
            origin_cep,
            destination,
            destination_cep,
            freight_type,
            km_distance,
            vehicle_type_id,
            vehicle_type:vehicle_types (
              axes_count,
              code,
              name
            )
          )
        `
        )
        .eq('id', asDb(id))
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<OrderWithOccurrences>(data);
    },
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (order: Omit<OrderInsert, 'os_number'> & { os_number?: string }) => {
      // Generate OS number using the database function
      const { data: osNumber } = await supabase.rpc('generate_os_number');

      const { data, error } = await supabase
        .from('orders')
        .insert(asInsert({ ...order, os_number: osNumber || order.os_number || '' }))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: OrderUpdate }) => {
      const { data, error } = await supabase
        .from('orders')
        .update(asInsert(updates))
        .eq('id', asDb(id))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useUpdateOrderStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: OrderStage }) => {
      const { data, error } = await supabase
        .from('orders')
        .update(asInsert({ stage }))
        .eq('id', asDb(id))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('orders').delete().eq('id', asDb(id));

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useConvertQuoteToOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quoteId: string) => {
      // Get the quote data
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', asDb(quoteId))
        .single();

      if (quoteError) throw quoteError;

      const quote = filterSupabaseSingle<{
        id: string;
        client_id: string;
        client_name: string;
        origin: string;
        destination: string;
        value: number;
      }>(quoteData);
      if (!quote) throw new Error('Quote not found');

      const anttTotalRaw =
        (quoteData as { pricing_breakdown?: { meta?: { antt?: { total?: unknown } } } })
          ?.pricing_breakdown?.meta?.antt?.total ?? null;
      const anttTotal =
        anttTotalRaw == null
          ? null
          : Number.isFinite(Number(anttTotalRaw))
            ? Number(anttTotalRaw)
            : null;

      if (anttTotalRaw != null && anttTotal == null) {
        throw new Error(
          'Cotação com ANTT inválido (meta.antt.total). Recalcule e salve a cotação antes de converter para OS.'
        );
      }

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Generate OS number
      const { data: osNumber } = await supabase.rpc('generate_os_number');

      // Create order from quote
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(
          asInsert({
            os_number: osNumber || '',
            quote_id: quote.id,
            client_id: quote.client_id,
            client_name: quote.client_name,
            origin: quote.origin,
            destination: quote.destination,
            value: quote.value,
            created_by: user.id,
            carreteiro_antt: anttTotal,
            carreteiro_real: null,
          })
        )
        .select()
        .single();

      if (orderError) throw orderError;

      // Update quote stage to 'ganho'
      await supabase
        .from('quotes')
        .update(asInsert({ stage: 'ganho' }))
        .eq('id', asDb(quoteId));

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}
