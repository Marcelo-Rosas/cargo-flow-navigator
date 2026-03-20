/**
 * Hook e funções para paradas do roteiro da cotação (quote_route_stops).
 * Ref: docs/plans/análise-360-paradas-roteiro-multiplos-destinatários.md
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type QuoteRouteStopRow = Database['public']['Tables']['quote_route_stops']['Row'];

type QuoteRouteStopInsert = Database['public']['Tables']['quote_route_stops']['Insert'];

/** Formato do form (route_stops no QuoteFormData) + dados do destinatário */
export interface RouteStopFormItem {
  id?: string;
  sequence: number;
  cep?: string;
  city_uf?: string;
  /** Nome do cliente/destinatário (de additional_recipients) */
  name?: string | null;
  /** client_id para restaurar o Select ao editar */
  client_id?: string | null;
}

export function useQuoteRouteStops(quoteId: string | null) {
  return useQuery({
    queryKey: ['quote-route-stops', quoteId],
    queryFn: async (): Promise<QuoteRouteStopRow[]> => {
      if (!quoteId) return [];
      const { data, error } = await supabase
        .from('quote_route_stops')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sequence', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!quoteId,
  });
}

/**
 * Sincroniza paradas: remove as existentes e insere as novas.
 * Chamar após create/update de cotação.
 */
export async function syncQuoteRouteStops(
  quoteId: string,
  stops: RouteStopFormItem[]
): Promise<void> {
  const validStops = stops.filter((s) => {
    const cep = (s.cep ?? '').replace(/\D/g, '');
    return cep.length === 8;
  });

  if (validStops.length === 0) {
    const { error } = await supabase.from('quote_route_stops').delete().eq('quote_id', quoteId);
    if (error) throw error;
    return;
  }

  const rows: QuoteRouteStopInsert[] = validStops.map((s, i) => ({
    quote_id: quoteId,
    sequence: i,
    stop_type: 'stop' as const,
    cep: (s.cep ?? '').replace(/\D/g, '') || null,
    city_uf: s.city_uf?.trim() || null,
    name: s.name?.trim() || null,
    metadata: s.client_id ? { client_id: s.client_id } : null,
  }));

  const { error: delErr } = await supabase
    .from('quote_route_stops')
    .delete()
    .eq('quote_id', quoteId);
  if (delErr) throw delErr;

  const { error: insertErr } = await supabase.from('quote_route_stops').insert(rows);
  if (insertErr) throw insertErr;
}

export function useInvalidateQuoteRouteStops() {
  const queryClient = useQueryClient();
  return (quoteId: string) => {
    queryClient.invalidateQueries({ queryKey: ['quote-route-stops', quoteId] });
  };
}
