import { useQuery } from '@tanstack/react-query';
import { asDb, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';

export interface OrderPaymentReconciliation {
  order_id: string;
  os_number: string;
  trip_id: string | null;
  expected_amount: number;
  has_expected_value: boolean;
  paid_amount: number;
  delta_amount: number;
  is_reconciled: boolean;
  proofs_count: number;
  last_paid_at: string | null;
}

export interface TripPaymentReconciliation {
  trip_id: string;
  trip_number: string;
  status_operational: string;
  financial_status: string;
  orders_count: number;
  expected_amount: number;
  paid_amount: number;
  delta_amount: number;
  all_orders_reconciled: boolean;
  total_reconciled: boolean;
  trip_reconciled: boolean;
  last_paid_at: string | null;
}

export function useOrderReconciliation(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ['reconciliation', 'order', orderId],
    queryFn: async (): Promise<OrderPaymentReconciliation | null> => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from('v_order_payment_reconciliation' as never)
        .select('*')
        .eq('order_id', asDb(orderId))
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<OrderPaymentReconciliation>(data);
    },
    enabled: !!orderId,
  });
}

export function useOrdersReconciliation(orderIds: string[]) {
  return useQuery({
    queryKey: ['reconciliation', 'orders', orderIds],
    queryFn: async (): Promise<OrderPaymentReconciliation[]> => {
      if (orderIds.length === 0) return [];
      const { data, error } = await supabase
        .from('v_order_payment_reconciliation' as never)
        .select('*')
        .in('order_id', orderIds.map(asDb));

      if (error) throw error;
      return filterSupabaseRows<OrderPaymentReconciliation>(data);
    },
    enabled: orderIds.length > 0,
  });
}

export function useTripReconciliation(tripId: string | null | undefined) {
  return useQuery({
    queryKey: ['reconciliation', 'trip', tripId],
    queryFn: async (): Promise<TripPaymentReconciliation | null> => {
      if (!tripId) return null;
      const { data, error } = await supabase
        .from('v_trip_payment_reconciliation' as never)
        .select('*')
        .eq('trip_id', asDb(tripId))
        .maybeSingle();

      if (error) throw error;
      return filterSupabaseSingle<TripPaymentReconciliation>(data);
    },
    enabled: !!tripId,
  });
}

export function useTripsReconciliation() {
  return useQuery({
    queryKey: ['reconciliation', 'trips'],
    queryFn: async (): Promise<TripPaymentReconciliation[]> => {
      const { data, error } = await supabase
        .from('v_trip_payment_reconciliation' as never)
        .select('*')
        .order('trip_number', { ascending: false });

      if (error) throw error;
      return filterSupabaseRows<TripPaymentReconciliation>(data);
    },
  });
}
