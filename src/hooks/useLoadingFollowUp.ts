import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LoadingFollowUpRow {
  id: string;
  quote_code: string | null;
  client_name: string;
  shipper_name: string | null;
  origin: string;
  destination: string;
  estimated_loading_date: string;
  stage: string;
  value: number;
}

export function useLoadingFollowUp() {
  return useQuery({
    queryKey: ['loading-follow-up'],
    queryFn: async (): Promise<LoadingFollowUpRow[]> => {
      const { data, error } = await supabase
        .from('quotes')
        .select(
          'id, quote_code, client_name, shipper_name, origin, destination, estimated_loading_date, stage, value'
        )
        .not('estimated_loading_date', 'is', null)
        .not('stage', 'in', '("perdido","ganho")')
        .order('estimated_loading_date', { ascending: true })
        .limit(100);

      if (error) throw error;

      return (data ?? []).map((r) => ({
        id: r.id,
        quote_code: r.quote_code,
        client_name: r.client_name,
        shipper_name: r.shipper_name,
        origin: r.origin,
        destination: r.destination,
        estimated_loading_date: (r as Record<string, unknown>).estimated_loading_date as string,
        stage: r.stage,
        value: Number(r.value) || 0,
      }));
    },
  });
}
