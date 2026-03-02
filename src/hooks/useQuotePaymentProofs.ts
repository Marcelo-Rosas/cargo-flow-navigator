import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/supabase-invoke';
import { asDb, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';

interface QuotePaymentProof {
  id: string;
  quote_id: string;
  document_id: string;
  proof_type: 'a_vista' | 'adiantamento' | 'saldo' | 'a_prazo';
  amount: number | null;
  expected_amount: number | null;
  status: string;
  created_at: string;
  document?: {
    id: string;
    file_name: string | null;
    file_url: string | null;
    type: string;
    created_at: string;
  } | null;
}

interface QuoteReconciliation {
  quote_id: string;
  expected_amount: number;
  paid_amount: number;
  delta_amount: number;
  is_reconciled: boolean;
  proofs_count: number;
}

export function useQuotePaymentProofsByQuote(quoteId: string | null | undefined) {
  return useQuery({
    queryKey: ['quote_payment_proofs', 'quote', quoteId],
    queryFn: async () => {
      if (!quoteId) return [] as QuotePaymentProof[];
      const { data, error } = await supabase
        .from('quote_payment_proofs' as never)
        .select('*, document:documents (id, file_name, file_url, type, created_at)')
        .eq('quote_id', asDb(quoteId))
        .order('created_at', { ascending: false });
      if (error) throw error;
      return filterSupabaseRows<QuotePaymentProof>(data);
    },
    enabled: !!quoteId,
  });
}

export function useQuoteReconciliation(quoteId: string | null | undefined) {
  return useQuery({
    queryKey: ['quote_reconciliation', quoteId],
    queryFn: async () => {
      if (!quoteId) return null;
      const { data, error } = await supabase
        .from('v_quote_payment_reconciliation' as never)
        .select('*')
        .eq('quote_id', asDb(quoteId))
        .maybeSingle();
      if (error) throw error;
      return filterSupabaseSingle<QuoteReconciliation>(data);
    },
    enabled: !!quoteId,
  });
}

export function useProcessQuotePaymentProof() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      return invokeEdgeFunction('process-quote-payment-proof', { documentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote_payment_proofs'] });
      queryClient.invalidateQueries({ queryKey: ['quote_reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useUpdateQuotePaymentProofAmount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { error } = await supabase
        .from('quote_payment_proofs' as never)
        .update({ amount, updated_at: new Date().toISOString() } as never)
        .eq('id', asDb(id));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote_payment_proofs'] });
      queryClient.invalidateQueries({ queryKey: ['quote_reconciliation'] });
    },
  });
}

export function useUpsertQuotePaymentProofAmount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      quoteId,
      documentId,
      proofType,
      amount,
    }: {
      quoteId: string;
      documentId: string;
      proofType: 'a_vista' | 'adiantamento' | 'saldo' | 'a_prazo';
      amount: number;
    }) => {
      const { error } = await supabase.from('quote_payment_proofs' as never).upsert(
        {
          quote_id: quoteId,
          document_id: documentId,
          proof_type: proofType,
          amount,
          status: 'pending',
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: 'document_id', ignoreDuplicates: false } as never
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote_payment_proofs'] });
      queryClient.invalidateQueries({ queryKey: ['quote_reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
