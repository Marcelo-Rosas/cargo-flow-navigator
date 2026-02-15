import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
            vehicle_type_id
          )
        `
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OrderWithOccurrences[];
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
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as OrderWithOccurrences | null;
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
        .insert({ ...order, os_number: osNumber || order.os_number || '' })
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
        .update(updates)
        .eq('id', id)
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
        .update({ stage })
        .eq('id', id)
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
      const { error } = await supabase.from('orders').delete().eq('id', id);

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
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();

      if (quoteError) throw quoteError;

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
        .insert({
          os_number: osNumber || '',
          quote_id: quote.id,
          client_id: quote.client_id,
          client_name: quote.client_name,
          origin: quote.origin,
          destination: quote.destination,
          value: quote.value,
          created_by: user.id,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Update quote stage to 'ganho'
      await supabase.from('quotes').update({ stage: 'ganho' }).eq('id', quoteId);

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}
