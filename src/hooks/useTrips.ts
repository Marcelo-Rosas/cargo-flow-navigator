import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb, asInsert, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Trip = Database['public']['Tables']['trips']['Row'];
type TripInsert = Database['public']['Tables']['trips']['Insert'];
type TripUpdate = Database['public']['Tables']['trips']['Update'];
type TripOrderRow = Database['public']['Tables']['trip_orders']['Row'];

export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(
          `
          *,
          driver:drivers (id, name, phone),
          vehicle_type:vehicle_types (id, name, code, axes_count)
        `
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      return filterSupabaseRows<
        Trip & {
          driver?: { id: string; name: string | null; phone: string | null } | null;
          vehicle_type?: {
            id: string;
            name: string;
            code: string;
            axes_count: number | null;
          } | null;
        }
      >(data);
    },
  });
}

export function useTrip(id: string | null | undefined) {
  return useQuery({
    queryKey: ['trips', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('trips')
        .select(
          `
          *,
          driver:drivers (id, name, phone),
          vehicle_type:vehicle_types (id, name, code, axes_count)
        `
        )
        .eq('id', asDb(id))
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<
        Trip & {
          driver?: { id: string; name: string | null; phone: string | null } | null;
          vehicle_type?: {
            id: string;
            name: string;
            code: string;
            axes_count: number | null;
          } | null;
        }
      >(data);
    },
    enabled: !!id,
  });
}

export function useTripsForOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ['trips', 'order', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data: order } = await supabase
        .from('orders')
        .select('trip_id')
        .eq('id', asDb(orderId))
        .maybeSingle();

      const tripId = order?.trip_id;
      if (!tripId) return null;

      const { data, error } = await supabase
        .from('trips')
        .select(
          `
          *,
          driver:drivers (id, name, phone),
          vehicle_type:vehicle_types (id, name, code, axes_count)
        `
        )
        .eq('id', tripId)
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<
        Trip & {
          driver?: { id: string; name: string | null; phone: string | null } | null;
          vehicle_type?: {
            id: string;
            name: string;
            code: string;
            axes_count: number | null;
          } | null;
        }
      >(data);
    },
    enabled: !!orderId,
  });
}

export function useTripSuggestion(vehiclePlate: string | null, driverId: string | null) {
  return useQuery({
    queryKey: ['trips', 'suggestion', vehiclePlate, driverId],
    queryFn: async () => {
      if (!vehiclePlate || !driverId) return null;
      const { data, error } = await supabase
        .from('trips')
        .select('id, trip_number, status_operational')
        .eq('vehicle_plate', vehiclePlate)
        .eq('driver_id', driverId)
        .in('status_operational', ['aberta', 'em_transito'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!vehiclePlate && !!driverId,
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<TripInsert, 'trip_number'> & { trip_number?: string }) => {
      let tripNumber = input.trip_number;
      if (!tripNumber) {
        const { data: num, error: rpcError } = await supabase.rpc('generate_trip_number');
        if (rpcError) throw rpcError;
        tripNumber = num as string;
      }
      const { data, error } = await supabase
        .from('trips')
        .insert(asInsert({ ...input, trip_number: tripNumber }) as TripInsert)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}

export function useTripOrdersWithOrders(tripId: string | null | undefined) {
  return useQuery({
    queryKey: ['trip_orders', tripId],
    queryFn: async () => {
      if (!tripId) return [];
      const { data, error } = await supabase
        .from('trip_orders')
        .select(
          `
          id, trip_id, order_id, apportion_key, apportion_factor, manual_percent,
          order:orders (id, os_number, value)
        `
        )
        .eq('trip_id', asDb(tripId));

      if (error) throw error;
      return filterSupabaseRows<
        Database['public']['Tables']['trip_orders']['Row'] & {
          order?: { id: string; os_number: string; value: number | null } | null;
        }
      >(data);
    },
    enabled: !!tripId,
  });
}

export function useTripCostItems(tripId: string | null | undefined) {
  return useQuery({
    queryKey: ['trip_cost_items', tripId],
    queryFn: async () => {
      if (!tripId) return [];
      const { data, error } = await supabase
        .from('trip_cost_items')
        .select('*')
        .eq('trip_id', asDb(tripId))
        .order('scope', { ascending: true })
        .order('category');

      if (error) throw error;
      return filterSupabaseRows<Database['public']['Tables']['trip_cost_items']['Row']>(data);
    },
    enabled: !!tripId,
  });
}

export function useLinkOrderToTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.rpc('link_order_to_trip', {
        p_order_id: orderId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
    },
  });
}

export function useLinkOrderToTargetTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, tripId }: { orderId: string; tripId: string }) => {
      const { data, error } = await supabase.rpc('link_order_to_target_trip', {
        p_order_id: orderId,
        p_trip_id: tripId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_data, variables) => {
      const tripId = variables.tripId;
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['trip_cost_items'] });
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: ['trip_orders', tripId] });
        queryClient.invalidateQueries({ queryKey: ['trip_financial_summary', tripId] });
        queryClient.invalidateQueries({ queryKey: ['v_trip_financial_details', tripId] });
      }
    },
  });
}

export function useAddOrderToTrip() {
  const base = useLinkOrderToTargetTrip();
  return base;
}

export function useRemoveOrderFromTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tripOrderId,
      tripId,
      orderId,
    }: {
      tripOrderId: string;
      tripId: string;
      orderId: string;
    }) => {
      const { error: deleteError } = await supabase
        .from('trip_orders')
        .delete()
        .eq('id', asDb(tripOrderId));
      if (deleteError) throw deleteError;

      const { error: orderError } = await supabase
        .from('orders')
        .update({ trip_id: null })
        .eq('id', asDb(orderId));
      if (orderError) throw orderError;

      // Recalcula itens de custo a partir do breakdown
      const { error: syncError } = await supabase.rpc('sync_cost_items_from_breakdown', {
        p_trip_id: tripId,
      });
      if (syncError) throw syncError;
    },
    onSuccess: (_data, variables) => {
      const tripId = variables.tripId;
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: ['trip_orders', tripId] });
        queryClient.invalidateQueries({ queryKey: ['trip_financial_summary', tripId] });
        queryClient.invalidateQueries({ queryKey: ['v_trip_financial_details', tripId] });
        queryClient.invalidateQueries({ queryKey: ['trip_cost_items', tripId] });
      }
    },
  });
}

export function useUpdateOrderDriverForTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, driverId }: { orderId: string; driverId: string | null }) => {
      const { error } = await supabase
        .from('orders')
        .update({ driver_id: driverId })
        .eq('id', asDb(orderId));
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      const tripId = variables?.orderId ? null : null;
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      // Invalidation específica por trip será feita no modal quando soubermos o tripId
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: ['v_trip_financial_details', tripId] });
      }
    },
  });
}

export function useSearchOrdersForTrip(tripId: string | null | undefined, searchTerm: string) {
  return useQuery({
    queryKey: ['orders', 'search-trip', tripId, searchTerm],
    enabled: !!tripId && searchTerm.trim().length >= 3,
    queryFn: async () => {
      if (!tripId || searchTerm.trim().length < 3) return [];
      const term = `${searchTerm.trim()}%`;
      const { data, error } = await supabase
        .from('orders')
        .select('id, os_number, client_name, value, driver_id, trip_id')
        .ilike('os_number', term)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      const rows = filterSupabaseRows<Database['public']['Tables']['orders']['Row']>(data);
      // Filtra fora OS já vinculadas à trip alvo
      return rows.filter((o) => o.trip_id === null || o.trip_id !== tripId);
    },
  });
}

export function useSyncCostItemsFromBreakdown() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tripId: string) => {
      const { error } = await supabase.rpc('sync_cost_items_from_breakdown', {
        p_trip_id: tripId,
      });
      if (error) throw error;
    },
    onSuccess: (_, tripId) => {
      queryClient.invalidateQueries({ queryKey: ['trip_cost_items', tripId] });
    },
  });
}

export function useUpdateTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TripUpdate }) => {
      const { data, error } = await supabase
        .from('trips')
        .update(asInsert(updates) as TripUpdate)
        .eq('id', asDb(id))
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
