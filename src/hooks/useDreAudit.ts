/**
 * Hook para auditoria de qualidade dos pares COT/OS.
 * Busca inconsistências da view v_dre_audit_mismatches.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DreAuditRow {
  mismatch_type: string;
  quote_id: string | null;
  quote_code: string | null;
  order_id: string | null;
  os_number: string | null;
  description: string;
  severity: 'high' | 'medium' | 'low';
  reference_date: string;
}

export interface UseDreAuditParams {
  dateFrom: string | null; // dd/mm/yyyy
  dateTo: string | null; // dd/mm/yyyy
  enabled?: boolean;
}

function parseDdMmYyyy(s: string | null): Date | null {
  if (!s || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s.trim())) return null;
  const [day, month, year] = s.trim().split('/').map(Number);
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

export function useDreAudit({ dateFrom, dateTo, enabled = true }: UseDreAuditParams) {
  return useQuery({
    queryKey: ['dre-audit', dateFrom, dateTo],
    queryFn: async (): Promise<DreAuditRow[]> => {
      let query = supabase
        .from('v_dre_audit_mismatches')
        .select(
          'mismatch_type,quote_id,quote_code,order_id,os_number,description,severity,reference_date'
        )
        .order('severity', { ascending: false })
        .order('reference_date', { ascending: false });

      const from = parseDdMmYyyy(dateFrom);
      const to = parseDdMmYyyy(dateTo);

      if (from) {
        const fromIso = new Date(from.getTime() - from.getTimezoneOffset() * 60000).toISOString();
        query = query.gte('reference_date', fromIso);
      }
      if (to) {
        const toDate = new Date(to.getTime() - to.getTimezoneOffset() * 60000);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('reference_date', toDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DreAuditRow[];
    },
    enabled,
  });
}

export function useDreAuditSummary({ dateFrom, dateTo, enabled = true }: UseDreAuditParams) {
  return useQuery({
    queryKey: ['dre-audit-summary', dateFrom, dateTo],
    queryFn: async (): Promise<Record<string, number>> => {
      const from = parseDdMmYyyy(dateFrom);
      const to = parseDdMmYyyy(dateTo);

      let query = supabase.from('v_dre_audit_mismatches').select('mismatch_type');

      if (from) {
        const fromIso = new Date(from.getTime() - from.getTimezoneOffset() * 60000).toISOString();
        query = query.gte('reference_date', fromIso);
      }
      if (to) {
        const toDate = new Date(to.getTime() - to.getTimezoneOffset() * 60000);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('reference_date', toDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const summary: Record<string, number> = {};
      for (const row of (data ?? []) as Array<{ mismatch_type: string }>) {
        summary[row.mismatch_type] = (summary[row.mismatch_type] ?? 0) + 1;
      }
      return summary;
    },
    enabled,
  });
}
