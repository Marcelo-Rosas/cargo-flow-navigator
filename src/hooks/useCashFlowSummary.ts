import { useQuery } from '@tanstack/react-query';
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
  entradas: number;
  saidas: number;
  saldo: number;
  fatDocCount: number;
  pagDocCount: number;
}

export function useCashFlowSummary(params?: { monthFrom?: string; monthTo?: string }) {
  return useQuery({
    queryKey: ['cash-flow-summary', params?.monthFrom, params?.monthTo],
    queryFn: async (): Promise<CashFlowByMonth[]> => {
      const { data, error } = await supabase
        .from('v_cash_flow_summary' as 'documents')
        .select('*')
        .order('period', { ascending: false })
        .limit(24);

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST116') return [];
        throw error;
      }

      const rows = (data ?? []) as CashFlowSummaryRow[];

      const byPeriod = new Map<
        string,
        { entradas: number; saidas: number; fatCount: number; pagCount: number }
      >();

      for (const r of rows) {
        const key = r.period;
        const curr = byPeriod.get(key) ?? {
          entradas: 0,
          saidas: 0,
          fatCount: 0,
          pagCount: 0,
        };

        if (r.type === 'FAT') {
          curr.entradas += Number(r.settled_amount) || 0;
          curr.fatCount += r.doc_count || 0;
        } else if (r.type === 'PAG') {
          curr.saidas += Number(r.settled_amount) || 0;
          curr.pagCount += r.doc_count || 0;
        }
        byPeriod.set(key, curr);
      }

      return Array.from(byPeriod.entries())
        .map(([period, v]) => ({
          period,
          periodLabel: formatPeriodLabel(period),
          entradas: Math.round(v.entradas * 100) / 100,
          saidas: Math.round(v.saidas * 100) / 100,
          saldo: Math.round((v.entradas - v.saidas) * 100) / 100,
          fatDocCount: v.fatCount,
          pagDocCount: v.pagCount,
        }))
        .sort((a, b) => b.period.localeCompare(a.period))
        .slice(0, 12);
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
