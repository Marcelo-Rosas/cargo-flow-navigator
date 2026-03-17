import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MarketIndex {
  id: string;
  periodo_referencia: string;
  gerado_em: string;
  fonte_url: string;
  inctf_mensal: number | null;
  inctf_12meses: number | null;
  inctf_ano: number | null;
  inctl_mensal: number | null;
  inctl_12meses: number | null;
  inctl_ano: number | null;
  diesel_s10_preco: number | null;
  diesel_s10_mensal: number | null;
  diesel_s10_12meses: number | null;
  diesel_comum_preco: number | null;
  diesel_comum_mensal: number | null;
  diesel_comum_12meses: number | null;
  desp_adm_mensal: number | null;
  desp_adm_12meses: number | null;
  lotacao_cavalo_12m: number | null;
  lotacao_semirreboque_12m: number | null;
  lotacao_pneu_12m: number | null;
  lotacao_salario_12m: number | null;
  reajuste_sugerido_pct: number | null;
  alerta_nivel: 'estavel' | 'atencao' | 'urgente';
  resumo_whatsapp: string | null;
  created_at: string;
}

const STALE = 5 * 60 * 1000;

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
      return (data as unknown as MarketIndex[]) ?? [];
    },
    staleTime: STALE,
  });
}

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
      return (data as unknown as MarketIndex) ?? null;
    },
    staleTime: STALE,
  });
}

export function useMarketAlert() {
  const { data, isLoading } = useLatestMarketIndex();
  if (!data)
    return {
      isLoading,
      alerta: null,
      reajuste: null,
      periodo: null,
      diesel: null,
      inctf12m: null,
      inctl12m: null,
      salario12m: null,
      pneu12m: null,
      resumo: null,
    };
  return {
    isLoading,
    periodo: data.periodo_referencia,
    alerta: data.alerta_nivel,
    reajuste: data.reajuste_sugerido_pct,
    diesel: data.diesel_s10_preco,
    inctf12m: data.inctf_12meses != null ? +(data.inctf_12meses * 100).toFixed(2) : null,
    inctl12m: data.inctl_12meses != null ? +(data.inctl_12meses * 100).toFixed(2) : null,
    salario12m:
      data.lotacao_salario_12m != null ? +(data.lotacao_salario_12m * 100).toFixed(2) : null,
    pneu12m: data.lotacao_pneu_12m != null ? +(data.lotacao_pneu_12m * 100).toFixed(2) : null,
    resumo: data.resumo_whatsapp,
  };
}
