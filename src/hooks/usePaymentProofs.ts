import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { asDb, filterSupabaseRows } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type PaymentProof = Database['public']['Tables']['payment_proofs']['Row'];

export function usePaymentProofsByOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ['payment_proofs', 'order', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('payment_proofs')
        .select(
          `
          *,
          document:documents (id, file_name, file_url, type, created_at)
        `
        )
        .eq('order_id', asDb(orderId))
        .order('created_at', { ascending: false });

      if (error) throw error;
      return filterSupabaseRows<
        PaymentProof & {
          document?: {
            id: string;
            file_name: string | null;
            file_url: string | null;
            type: string;
            created_at: string;
          } | null;
        }
      >(data);
    },
    enabled: !!orderId,
  });
}

export function usePaymentProofsByTrip(tripId: string | null | undefined) {
  return useQuery({
    queryKey: ['payment_proofs', 'trip', tripId],
    queryFn: async () => {
      if (!tripId) return [];
      const { data, error } = await supabase
        .from('payment_proofs')
        .select(
          `
          *,
          document:documents (id, file_name, file_url, type, created_at),
          order:orders (id, os_number, carreteiro_real)
        `
        )
        .eq('trip_id', asDb(tripId))
        .order('created_at', { ascending: false });

      if (error) throw error;
      return filterSupabaseRows<
        PaymentProof & {
          document?: {
            id: string;
            file_name: string | null;
            file_url: string | null;
            type: string;
            created_at: string;
          } | null;
          order?: { id: string; os_number: string; carreteiro_real: number | null } | null;
        }
      >(data);
    },
    enabled: !!tripId,
  });
}

export interface ProcessPaymentProofResponse {
  success: boolean;
  paymentProofId?: string;
  extracted?: unknown;
  error?: string;
}

export function useProcessPaymentProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string): Promise<ProcessPaymentProofResponse> => {
      const { data: sessionData } = await supabase.auth.getSession();
      let token = sessionData?.session?.access_token;
      if (!token) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        token = refreshData?.session?.access_token ?? undefined;
      }
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      const { data, error } = await supabase.functions.invoke<ProcessPaymentProofResponse>(
        'process-payment-proof',
        { body: { documentId }, headers: { Authorization: `Bearer ${token}` } }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data ?? { success: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_proofs'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
    },
  });
}

export function useUpdatePaymentProofAmount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }): Promise<void> => {
      const { error } = await supabase
        .from('payment_proofs')
        .update({ amount, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_proofs'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
    },
  });
}
