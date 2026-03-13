/**
 * Hook e funções para paradas do roteiro da cotação (quote_route_stops).
 * Ref: docs/plans/análise-360-paradas-roteiro-multiplos-destinatários.md
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface QuoteRouteStopRow {
  id: string;
  quote_id: string;
  sequence: number;
  stop_type: 'origin' | 'stop' | 'destination';
  cnpj: string | null;
  name: string | null;
  cep: string | null;
  city_uf: string | null;
  label: string | null;
  planned_km_from_prev: number | null;
  metadata: Record<string, unknown> | null;
}

/** Formato do form (route_stops no QuoteFormData) */
export interface RouteStopFormItem {
  id?: string;
  sequence: number;
  cep?: string;
  city_uf?: string;
}

export function useQuoteRouteStops(quoteId: string | null) {
  return useQuery({
    queryKey: ['quote-route-stops', quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      const { data, error } = await supabase
        .from('quote_route_stops')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sequence', { ascending: true });

      if (error) throw error;
      return (data ?? []) as QuoteRouteStopRow[];
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
    await supabase.from('quote_route_stops').delete().eq('quote_id', quoteId);
    return;
  }

  const rows = validStops.map((s, i) => ({
    quote_id: quoteId,
    sequence: i,
    stop_type: 'stop' as const,
    cep: (s.cep ?? '').replace(/\D/g, '') || null,
    city_uf: s.city_uf?.trim() || null,
  }));

  const { error: delErr } = await supabase
    .from('quote_route_stops')
    .delete()
    .eq('quote_id', quoteId);
  if (delErr) throw delErr;

  if (rows.length > 0) {
    const { error: insertErr } = await supabase.from('quote_route_stops').insert(rows);
    if (insertErr) throw insertErr;
  }
}

export function useInvalidateQuoteRouteStops() {
  const queryClient = useQueryClient();
  return (quoteId: string) => {
    queryClient.invalidateQueries({ queryKey: ['quote-route-stops', quoteId] });
  };
}
