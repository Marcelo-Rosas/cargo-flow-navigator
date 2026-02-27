import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb, asInsert, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Trip = Database['public']['Tables']['trips']['Row'];
type TripInsert = Database['public']['Tables']['trips']['Insert'];
type TripUpdate = Database['public']['Tables']['trips']['Update'];

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
