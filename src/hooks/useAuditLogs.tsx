import { useQuery } from '@tanstack/react-query';
import { asDb, filterSupabaseRows } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

export function useAuditLogs(tableName?: string, recordId?: string) {
  return useQuery({
    queryKey: ['audit-logs', tableName, recordId],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (tableName) {
        query = query.eq('table_name', asDb(tableName));
      }

      if (recordId) {
        query = query.eq('record_id', asDb(recordId));
      }

      const { data, error } = await query;

      if (error) throw error;
      return filterSupabaseRows<AuditLog>(data);
    },
  });
}

export function useRecordHistory(tableName: string, recordId: string) {
  return useQuery({
    queryKey: ['record-history', tableName, recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', asDb(tableName))
        .eq('record_id', asDb(recordId))
        .order('created_at', { ascending: false });

      if (error) throw error;
      return filterSupabaseRows<AuditLog>(data);
    },
    enabled: !!tableName && !!recordId,
  });
}
