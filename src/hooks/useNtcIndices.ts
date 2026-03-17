// [DASHBOARD] — src/hooks/useNtcIndices.ts
// Fonte única: market_indices (dados já processados pelo monitor NTC)

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NtcIndices {
  inctl_pct: number;
  inctf_pct: number;
  inctl_periodo: string;
  inctf_periodo: string;
  diesel_price: number;
  diesel_variation_pct: number;
  diesel_periodo: string;
  reajuste_sugerido: number;
  evolution: Array<{ mes: string; inctl: number; diesel: number }>;
}

interface MarketIndexRow {
  periodo_referencia: string | null;
  inctf_12meses: number | null;
  inctl_12meses: number | null;
  diesel_s10_preco: number | null;
  diesel_s10_mensal: number | null;
  reajuste_sugerido_pct: number | null;
}

async function fetchNtcIndices(): Promise<NtcIndices> {
  // 1. Último registro (métricas principais)
  const { data: latestRaw, error: errLatest } = await supabase
    .from('market_indices' as 'documents')
    .select(
      'periodo_referencia, inctf_12meses, inctl_12meses, diesel_s10_preco, diesel_s10_mensal, reajuste_sugerido_pct'
    )
    .order('gerado_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errLatest) throw errLatest;
  const latest = latestRaw as unknown as MarketIndexRow | null;
  if (!latest) throw new Error('Nenhum registro em market_indices');

  const periodo = String(latest.periodo_referencia ?? '');
  // market_indices armazena % como decimal (0.075 = 7.5%)
  const inctl_pct = latest.inctl_12meses != null ? Number(latest.inctl_12meses) * 100 : 0;
  const inctf_pct = latest.inctf_12meses != null ? Number(latest.inctf_12meses) * 100 : 0;
  const diesel_price = Number(latest.diesel_s10_preco ?? 0);
  const diesel_variation_pct =
    latest.diesel_s10_mensal != null ? Number(latest.diesel_s10_mensal) * 100 : 0;
  const reajuste_sugerido = Number(latest.reajuste_sugerido_pct ?? Math.max(inctl_pct, inctf_pct));

  // 2. Evolução 12M — últimos 7 registros (períodos anteriores)
  const { data: evoRaw } = await supabase
    .from('market_indices' as 'documents')
    .select('periodo_referencia, inctl_12meses, diesel_s10_preco')
    .order('gerado_em', { ascending: false })
    .limit(8);

  const evoRows = (evoRaw ?? []) as unknown as MarketIndexRow[];
  const evolution: NtcIndices['evolution'] = [];
  if (evoRows.length > 1) {
    const sorted = [...evoRows].reverse();
    for (let i = 1; i < sorted.length; i++) {
      const row = sorted[i];
      const period = row.periodo_referencia
        ? new Date(String(row.periodo_referencia).slice(0, 10))
        : new Date();
      const mes = period.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const inctlVal = row.inctl_12meses != null ? Number(row.inctl_12meses) * 100 : 0;
      evolution.push({
        mes,
        inctl: Math.round(inctlVal * 100) / 100,
        diesel: Number(row.diesel_s10_preco ?? 0),
      });
    }
  }

  return {
    inctl_pct: Math.round(inctl_pct * 100) / 100,
    inctf_pct: Math.round(inctf_pct * 100) / 100,
    inctl_periodo: periodo,
    inctf_periodo: periodo,
    diesel_price,
    diesel_variation_pct: Math.round(diesel_variation_pct * 100) / 100,
    diesel_periodo: periodo,
    reajuste_sugerido: Math.round(reajuste_sugerido * 100) / 100,
    evolution,
  };
}

export function useNtcIndices() {
  return useQuery({
    queryKey: ['ntc-indices'],
    queryFn: fetchNtcIndices,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 2,
  });
}
