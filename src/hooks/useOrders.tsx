import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb, asInsert, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import { cardQueryKey } from '@/lib/card-mapping';
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
  price_table?: { name: string } | null;
  vehicle_type?: { name: string; code: string; axes_count: number | null } | null;
  payment_term?: {
    name: string;
    code: string;
    adjustment_percent: number;
    advance_percent: number | null;
    days: number | null;
  } | null;
  driver?: { id: string; cpf: number | null; name: string } | null;
  carrier_payment_term?: {
    id: string;
    name: string;
    code: string;
    adjustment_percent: number;
    advance_percent: number | null;
    days: number | null;
  } | null;
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
        | 'pricing_breakdown'
        | 'cargo_value'
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
          price_table:price_tables!orders_price_table_id_fkey (name),
          vehicle_type:vehicle_types!orders_vehicle_type_id_fkey (name, code, axes_count),
          payment_term:payment_terms!orders_payment_term_id_fkey (name, code, adjustment_percent, advance_percent, days),
          carrier_payment_term:payment_terms!orders_carrier_payment_term_id_fkey (id, name, code, adjustment_percent, advance_percent, days),
          driver:drivers!orders_driver_id_fkey (id, cpf, name),
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
            pricing_breakdown,
            cargo_value,
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
          price_table:price_tables!orders_price_table_id_fkey (name),
          vehicle_type:vehicle_types!orders_vehicle_type_id_fkey (name, code, axes_count),
          payment_term:payment_terms!orders_payment_term_id_fkey (name, code, adjustment_percent, advance_percent, days),
          carrier_payment_term:payment_terms!orders_carrier_payment_term_id_fkey (id, name, code, adjustment_percent, advance_percent, days),
          driver:drivers!orders_driver_id_fkey (id, cpf, name),
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
            pricing_breakdown,
            cargo_value,
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
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
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
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
      queryClient.invalidateQueries({ queryKey: cardQueryKey(null, id) });
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
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
      queryClient.invalidateQueries({ queryKey: cardQueryKey(null, id) });
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
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
      queryClient.invalidateQueries({ queryKey: cardQueryKey(null, id) });
    },
  });
}

export function useConvertQuoteToOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', asDb(quoteId))
        .single();

      if (quoteError) throw quoteError;

      const quote = filterSupabaseSingle<Quote>(quoteData);
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

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: osNumber } = await supabase.rpc('generate_os_number');

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
            origin_cep: quote.origin_cep,
            destination_cep: quote.destination_cep,
            value: quote.value,
            created_by: user.id,
            carreteiro_antt: anttTotal,
            carreteiro_real: null,
            cargo_type: quote.cargo_type,
            weight: quote.weight,
            volume: quote.volume,
            price_table_id: quote.price_table_id,
            vehicle_type_id: quote.vehicle_type_id,
            payment_term_id: quote.payment_term_id,
            km_distance: quote.km_distance,
            toll_value: quote.toll_value,
            pricing_breakdown: quote.pricing_breakdown,
            freight_type: quote.freight_type,
            freight_modality: quote.freight_modality,
            shipper_id: quote.shipper_id,
            shipper_name: quote.shipper_name,
          })
        )
        .select()
        .single();

      if (orderError) throw orderError;

      await supabase
        .from('quotes')
        .update(asInsert({ stage: 'ganho' }))
        .eq('id', asDb(quoteId));

      return order;
    },
    onSuccess: (order, quoteId) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
      queryClient.invalidateQueries({ queryKey: cardQueryKey(quoteId, null) });
      if (order?.id) {
        queryClient.invalidateQueries({ queryKey: cardQueryKey(quoteId, order.id) });
      }
    },
  });
}
