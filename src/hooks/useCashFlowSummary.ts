import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CashFlowSummaryRow {
  period: string;
  type: 'FAT' | 'PAG';
  status: string;
  doc_count: number;
  total_amount: number;
  settled_amount: number;
  pending_amount: number;
}

export interface CashFlowByMonth {
  period: string;
  periodLabel: string;
  /** Entradas realizadas (baixadas) */
  entradas: number;
  /** Saídas realizadas (baixadas) */
  saidas: number;
  /** Entradas previstas (pendentes) */
  entradasPrevistas: number;
  /** Saídas previstas (pendentes) */
  saidasPrevistas: number;
  /** Saldo realizado = entradas - saidas */
  saldo: number;
  /** Saldo acumulado (running total) */
  saldoAcumulado: number;
  fatDocCount: number;
  pagDocCount: number;
}

export interface CashFlowFilters {
  monthFrom?: string;
  monthTo?: string;
}

export function useCashFlowSummary(params?: CashFlowFilters) {
  return useQuery({
    queryKey: ['cash-flow-summary', params?.monthFrom, params?.monthTo],
    queryFn: async (): Promise<CashFlowByMonth[]> => {
      let query = supabase
        .from('v_cash_flow_summary' as 'documents')
        .select('*')
        .order('period', { ascending: true });

      // Apply date filters when provided
      if (params?.monthFrom) {
        query = query.gte('period', params.monthFrom + '-01');
      }
      if (params?.monthTo) {
        // End of month: add -01 and use lte
        query = query.lte('period', params.monthTo + '-01');
      }

      // Fallback: limit to 24 months if no filter
      if (!params?.monthFrom && !params?.monthTo) {
        query = query.limit(48);
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116') return [];
        throw error;
      }

      const rows = (data ?? []) as CashFlowSummaryRow[];

      const byPeriod = new Map<
        string,
        {
          entradas: number;
          saidas: number;
          entradasPrevistas: number;
          saidasPrevistas: number;
          fatCount: number;
          pagCount: number;
        }
      >();

      for (const r of rows) {
        const key = r.period;
        const curr = byPeriod.get(key) ?? {
          entradas: 0,
          saidas: 0,
          entradasPrevistas: 0,
          saidasPrevistas: 0,
          fatCount: 0,
          pagCount: 0,
        };

        if (r.type === 'FAT') {
          curr.entradas += Number(r.settled_amount) || 0;
          curr.entradasPrevistas += Number(r.pending_amount) || 0;
          curr.fatCount += r.doc_count || 0;
        } else if (r.type === 'PAG') {
          curr.saidas += Number(r.settled_amount) || 0;
          curr.saidasPrevistas += Number(r.pending_amount) || 0;
          curr.pagCount += r.doc_count || 0;
        }
        byPeriod.set(key, curr);
      }

      // Sort ascending for running total calculation
      const sorted = Array.from(byPeriod.entries()).sort((a, b) => a[0].localeCompare(b[0]));

      let runningTotal = 0;
      const result: CashFlowByMonth[] = sorted.map(([period, v]) => {
        const entradas = round2(v.entradas);
        const saidas = round2(v.saidas);
        const saldo = round2(entradas - saidas);
        runningTotal = round2(runningTotal + saldo);
        return {
          period,
          periodLabel: formatPeriodLabel(period),
          entradas,
          saidas,
          entradasPrevistas: round2(v.entradasPrevistas),
          saidasPrevistas: round2(v.saidasPrevistas),
          saldo,
          saldoAcumulado: runningTotal,
          fatDocCount: v.fatCount,
          pagDocCount: v.pagCount,
        };
      });

      // Return most recent 12, but keep desc order for display
      return result.slice(-12).reverse();
    },
  });
}

export interface SettledInstallment {
  id: string;
  amount: number;
  due_date: string;
  settled_at: string | null;
  payment_method: string | null;
  document_code: string | null;
  document_type: 'FAT' | 'PAG';
}

export function useSettledInstallments(params?: CashFlowFilters) {
  return useQuery({
    queryKey: ['settled-installments', params?.monthFrom, params?.monthTo],
    queryFn: async (): Promise<SettledInstallment[]> => {
      let query = supabase
        .from('financial_installments')
        .select(
          'id, amount, due_date, settled_at, payment_method, status, financial_documents(code, type)'
        )
        .eq('status', 'baixado')
        .order('settled_at', { ascending: false });

      if (params?.monthFrom) {
        query = query.gte('due_date', params.monthFrom + '-01');
      }
      if (params?.monthTo) {
        const [y, m] = params.monthTo.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        query = query.lte('due_date', `${params.monthTo}-${lastDay}`);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;

      return (
        (data ?? []) as {
          id: string;
          amount: number;
          due_date: string;
          settled_at: string | null;
          payment_method: string | null;
          financial_documents: { code: string | null; type: 'FAT' | 'PAG' } | null;
        }[]
      ).map((row) => ({
        id: row.id,
        amount: Number(row.amount ?? 0),
        due_date: row.due_date,
        settled_at: row.settled_at,
        payment_method: row.payment_method,
        document_code: row.financial_documents?.code ?? null,
        document_type: row.financial_documents?.type ?? 'PAG',
      }));
    },
  });
}

export interface PendingInstallment {
  id: string;
  amount: number;
  due_date: string;
  document_code: string | null;
  document_type: 'FAT' | 'PAG';
  source_id: string | null;
  payment_method: string | null;
  recon_paid: number | null;
  recon_delta: number | null;
  recon_reconciled: boolean | null;
  recon_proof_label: string | null;
}

export function usePendingInstallments(limit = 50) {
  return useQuery({
    queryKey: ['pending-installments', limit],
    queryFn: async (): Promise<PendingInstallment[]> => {
      const { data, error } = await supabase
        .from('financial_installments')
        .select(
          'id, amount, due_date, status, payment_method, financial_documents(code, type, source_id)'
        )
        .eq('status', 'pendente')
        .order('due_date', { ascending: true })
        .limit(limit);

      if (error) throw error;

      type RawRow = {
        id: string;
        amount: number;
        due_date: string;
        financial_documents: {
          code: string | null;
          type: 'FAT' | 'PAG';
          source_id: string | null;
        } | null;
      };

      const rows = ((data ?? []) as RawRow[]).map((row) => ({
        id: row.id,
        amount: Number(row.amount ?? 0),
        due_date: row.due_date,
        document_code: row.financial_documents?.code ?? null,
        document_type: (row.financial_documents?.type ?? 'PAG') as 'FAT' | 'PAG',
        source_id: row.financial_documents?.source_id ?? null,
        payment_method: row.payment_method ?? null,
      }));

      // Fetch reconciliation for FAT rows
      const fatSourceIds = [
        ...new Set(
          rows.filter((r) => r.document_type === 'FAT' && r.source_id).map((r) => r.source_id!)
        ),
      ];

      const reconMap = new Map<
        string,
        { paid: number; delta: number; reconciled: boolean; proofLabel: string | null }
      >();

      if (fatSourceIds.length > 0) {
        const { data: reconData, error: reconError } = await supabase
          .from('v_quote_payment_reconciliation')
          .select('quote_id, paid_amount, delta_amount, is_reconciled')
          .in('quote_id', fatSourceIds);

        if (reconError) throw reconError;

        const reconRows = (reconData ?? []) as {
          quote_id: string;
          paid_amount: number;
          delta_amount: number;
          is_reconciled: boolean;
        }[];

        // Also fetch proof types per quote for label
        const { data: proofData, error: proofError } = await supabase
          .from('quote_payment_proofs')
          .select('quote_id, proof_type, amount')
          .in('quote_id', fatSourceIds)
          .not('amount', 'is', null);

        if (proofError) throw proofError;

        const proofsByQuote = new Map<string, string[]>();
        for (const p of (proofData ?? []) as {
          quote_id: string;
          proof_type: string;
          amount: number;
        }[]) {
          const arr = proofsByQuote.get(p.quote_id) ?? [];
          if (!arr.includes(p.proof_type)) arr.push(p.proof_type);
          proofsByQuote.set(p.quote_id, arr);
        }

        const PROOF_LABELS: Record<string, string> = {
          a_vista: 'À vista',
          adiantamento: 'Adiantamento',
          saldo: 'Saldo',
          a_prazo: 'A prazo',
        };

        for (const r of reconRows) {
          const types = proofsByQuote.get(r.quote_id) ?? [];
          reconMap.set(r.quote_id, {
            paid: Number(r.paid_amount),
            delta: Number(r.delta_amount),
            reconciled: r.is_reconciled,
            proofLabel: types.map((t) => PROOF_LABELS[t] ?? t).join(', ') || null,
          });
        }
      }

      return rows.map((row) => {
        const recon = row.source_id ? reconMap.get(row.source_id) : undefined;
        return {
          ...row,
          recon_paid: recon?.paid ?? null,
          recon_delta: recon?.delta ?? null,
          recon_reconciled: recon?.reconciled ?? null,
          recon_proof_label: recon?.proofLabel ?? null,
        };
      });
    },
  });
}

export function useSettleInstallments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return null;
      const { error } = await supabase
        .from('financial_installments')
        .update({ status: 'baixado', settled_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-flow-summary'] });
      queryClient.invalidateQueries({ queryKey: ['pending-installments'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
    },
  });
}

export function useDeleteInstallments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return null;
      const { error } = await supabase.from('financial_installments').delete().in('id', ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-flow-summary'] });
      queryClient.invalidateQueries({ queryKey: ['pending-installments'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
    },
  });
}

type ResyncItem = Pick<PendingInstallment, 'id' | 'source_id' | 'document_type'>;

export function useResyncInstallmentAmounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: ResyncItem[]) => {
      if (items.length === 0) return [];

      const fatItems = items.filter((i) => i.document_type === 'FAT' && i.source_id);
      const pagItems = items.filter((i) => i.document_type === 'PAG' && i.source_id);

      // installment id → novo amount
      const amountMap = new Map<string, number>();

      if (fatItems.length > 0) {
        const { data: quotes, error } = await supabase
          .from('quotes')
          .select('id, value')
          .in(
            'id',
            fatItems.map((i) => i.source_id!)
          );
        if (error) throw error;
        const quoteMap = new Map((quotes ?? []).map((q) => [q.id, Number(q.value)]));
        for (const item of fatItems) {
          const val = quoteMap.get(item.source_id!);
          if (val != null) amountMap.set(item.id, val);
        }
      }

      if (pagItems.length > 0) {
        const { data: orders, error } = await supabase
          .from('orders')
          .select('id, value, carreteiro_real')
          .in(
            'id',
            pagItems.map((i) => i.source_id!)
          );
        if (error) throw error;
        const orderMap = new Map(
          (orders ?? []).map((o) => [o.id, Number(o.carreteiro_real ?? o.value)])
        );
        for (const item of pagItems) {
          const val = orderMap.get(item.source_id!);
          if (val != null) amountMap.set(item.id, val);
        }
      }

      const results = await Promise.allSettled(
        Array.from(amountMap.entries()).map(([id, amount]) =>
          supabase.from('financial_installments').update({ amount }).eq('id', id)
        )
      );

      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0)
        throw new Error(`${failed.length} parcela(s) não puderam ser atualizadas`);

      return Array.from(amountMap.keys());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-flow-summary'] });
      queryClient.invalidateQueries({ queryKey: ['pending-installments'] });
      queryClient.invalidateQueries({ queryKey: ['financial-kanban'] });
    },
  });
}

function formatPeriodLabel(period: string): string {
  try {
    const d = new Date(period + 'T01:00:00');
    return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  } catch {
    return period;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
