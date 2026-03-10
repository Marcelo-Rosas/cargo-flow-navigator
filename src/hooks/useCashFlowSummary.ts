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

export interface PendingInstallment {
  id: string;
  amount: number;
  due_date: string;
  document_code: string | null;
  document_type: 'FAT' | 'PAG';
}

export function usePendingInstallments(limit = 50) {
  return useQuery({
    queryKey: ['pending-installments', limit],
    queryFn: async (): Promise<PendingInstallment[]> => {
      const { data, error } = await supabase
        .from('financial_installments')
        .select('id, amount, due_date, status, financial_documents(code, type)')
        .eq('status', 'pendente')
        .order('due_date', { ascending: true })
        .limit(limit);

      if (error) throw error;

      return (
        (data ?? []) as {
          id: string;
          amount: number;
          due_date: string;
          financial_documents: { code: string | null; type: 'FAT' | 'PAG' } | null;
        }[]
      ).map((row) => ({
        id: row.id,
        amount: Number(row.amount ?? 0),
        due_date: row.due_date,
        document_code: row.financial_documents?.code ?? null,
        document_type: row.financial_documents?.type ?? 'PAG',
      }));
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
