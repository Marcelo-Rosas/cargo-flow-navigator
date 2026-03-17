import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MarketIndex {
  id: string;
  periodo_referencia: string;
  gerado_em: string;
  inctf_mensal: number | null;
  inctf_acumulado: number | null;
  inctl_mensal: number | null;
  inctl_acumulado: number | null;
  inctl_por_faixa: Record<string, number> | null;
  diesel_s10: number | null;
  diesel_s500: number | null;
  diesel_variacao_mensal: number | null;
  diesel_variacao_anual: number | null;
  reajuste_sugerido: number | null;
  alerta_reajuste: 'estavel' | 'atencao' | 'urgente' | null;
  justificativa_reajuste: string | null;
  fonte: string | null;
  agente_versao: string | null;
  relatorio_url: string | null;
  created_at: string;
  updated_at: string;
}

const STALE_TIME = 5 * 60 * 1000;

/** Últimos N snapshots do market_indices (ordem decrescente por gerado_em) */
export function useMarketIndices(limit = 12) {
  return useQuery({
    queryKey: ['market-indices', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_indices' as 'documents')
        .select('*')
        .order('gerado_em', { ascending: false })
        .limit(limit);
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data ?? []) as MarketIndex[];
    },
    staleTime: STALE_TIME,
  });
}

/** Snapshot mais recente do market_indices */
export function useLatestMarketIndex() {
  return useQuery({
    queryKey: ['market-index-latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_indices' as 'documents')
        .select('*')
        .order('gerado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        if (error.code === '42P01') return null;
        throw error;
      }
      return (data as MarketIndex) ?? null;
    },
    staleTime: STALE_TIME,
  });
}
