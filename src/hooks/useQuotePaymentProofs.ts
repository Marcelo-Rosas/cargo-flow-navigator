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
  delta_reason: string | null;
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

export function useUpdatePaymentProofDeltaReason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, deltaReason }: { id: string; deltaReason: string | null }) => {
      const { error } = await supabase
        .from('quote_payment_proofs' as never)
        .update({ delta_reason: deltaReason, updated_at: new Date().toISOString() } as never)
        .eq('id', asDb(id));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote_payment_proofs'] });
      queryClient.invalidateQueries({ queryKey: ['quote_reconciliation'] });
    },
  });
}

export interface ReconciliationReportRow {
  quote_id: string;
  quote_code: string;
  client_name: string | null;
  expected_amount: number;
  paid_amount: number;
  delta_amount: number;
  is_reconciled: boolean;
  delta_reason: string | null;
  proof_type: string;
  created_at: string;
}

export function useReconciliationReport(filter?: { year?: number | null; month?: number | null }) {
  const year = filter?.year ?? null;
  const month = filter?.month ?? null;
  return useQuery({
    queryKey: ['reconciliation_report', year, month],
    queryFn: async () => {
      let query = supabase
        .from('quote_payment_proofs' as never)
        .select(
          `
          id,
          quote_id,
          proof_type,
          amount,
          expected_amount,
          delta_reason,
          created_at,
          quote:quotes!inner (id, quote_code, client_name, value, created_at)
        `
        )
        .not('amount', 'is', null)
        .order('created_at', { ascending: false });

      if (year) {
        const start = `${year}-${month ? String(month).padStart(2, '0') : '01'}-01`;
        const endMonth = month ? month : 12;
        const endYear = month ? year : year;
        const end =
          endMonth === 12
            ? `${endYear + 1}-01-01`
            : `${endYear}-${String(endMonth + 1).padStart(2, '0')}-01`;
        query = query.gte('created_at', start).lt('created_at', end);
      }

      const { data, error } = await query;
      if (error) throw error;

      type RawRow = {
        id: string;
        quote_id: string;
        proof_type: string;
        amount: number;
        expected_amount: number | null;
        delta_reason: string | null;
        created_at: string;
        quote: {
          id: string;
          quote_code: string;
          client_name: string | null;
          value: number | null;
          created_at: string;
        };
      };

      return ((data ?? []) as unknown as RawRow[]).map((row) => ({
        quote_id: row.quote_id,
        quote_code: row.quote?.quote_code ?? '',
        client_name: row.quote?.client_name ?? null,
        expected_amount: Number(row.expected_amount ?? 0),
        paid_amount: Number(row.amount ?? 0),
        delta_amount: Number(row.amount ?? 0) - Number(row.expected_amount ?? 0),
        is_reconciled: Math.abs(Number(row.amount ?? 0) - Number(row.expected_amount ?? 0)) <= 1,
        delta_reason: row.delta_reason,
        proof_type: row.proof_type,
        created_at: row.created_at,
      })) as ReconciliationReportRow[];
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
