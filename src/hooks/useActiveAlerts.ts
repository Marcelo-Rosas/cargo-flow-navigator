import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { asDb } from '@/lib/supabase-utils';

export interface ActiveAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  time: string;
  action?: { label: string };
}

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function useActiveAlerts() {
  return useQuery({
    queryKey: ['active-alerts'],
    queryFn: async (): Promise<ActiveAlert[]> => {
      const alerts: ActiveAlert[] = [];

      // 1. Ocorrências não resolvidas (critica + alta)
      const { data: occurrences } = await supabase
        .from('occurrences')
        .select('id, severity, description, created_at, order_id, orders(os_number)')
        .is('resolved_at', null)
        .in('severity', [asDb('critica'), asDb('alta')])
        .order('created_at', { ascending: false })
        .limit(5);

      type OccurrenceWithOrder = (typeof occurrences extends (infer T)[] | null ? T : never) & {
        orders: { os_number: string } | null;
      };

      for (const occ of (occurrences as OccurrenceWithOrder[] | null) ?? []) {
        const os = occ.orders?.os_number ?? null;
        const desc = occ.description?.substring(0, 80) ?? '';
        alerts.push({
          id: `occ-${occ.id}`,
          type: occ.severity === 'critica' ? 'critical' : 'warning',
          title: occ.severity === 'critica' ? 'Ocorrência Crítica' : 'Ocorrência Alta',
          description: os ? `${os}: ${desc}` : desc,
          time: relativeTime(occ.created_at),
          action: { label: 'Ver OS' },
        });
      }

      // 2. Ordens ativas com documentação pendente
      const { data: docsOrders } = await supabase
        .from('orders')
        .select('id, os_number, has_nfe, has_cte, has_pod')
        .neq('stage', asDb('entregue'))
        .neq('stage', asDb('cancelado'))
        .or('has_nfe.eq.false,has_cte.eq.false,has_pod.eq.false')
        .order('created_at', { ascending: false })
        .limit(3);

      for (const order of docsOrders ?? []) {
        const missing: string[] = [];
        if (!order.has_nfe) missing.push('NF-e');
        if (!order.has_cte) missing.push('CT-e');
        if (!order.has_pod) missing.push('Canhoto');
        if (missing.length === 0) continue;
        alerts.push({
          id: `doc-${order.id}`,
          type: 'info',
          title: 'Documentação Pendente',
          description: `${order.os_number}: falta ${missing.join(', ')}`,
          time: 'Pendente',
          action: { label: 'Verificar' },
        });
      }

      return alerts;
    },
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });
}
