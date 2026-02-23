import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/* ------------------------------------------------------------------ */
/*  Types                                                            */
/* ------------------------------------------------------------------ */

export interface NtcCostIndex {
  id: string;
  index_type: string;
  period: string;
  index_value: number;
  distance_km: number | null;
  pickup_km: number | null;
  created_at: string;
  updated_at: string;
}

export interface NtcFuelReference {
  id: string;
  reference_month: string;
  diesel_price_liter: number;
  diesel_price_sp: number | null;
  diesel_price_rj: number | null;
  diesel_price_mg: number | null;
  diesel_price_pr: number | null;
  monthly_variation_pct: number | null;
  annual_variation_pct: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface NtcInsightsSummary {
  /** Variação percentual do INCTL (distance_km=800) nos últimos 12 meses */
  inctlVar12m: number | null;
  /** Variação percentual do INCTF nos últimos 12 meses */
  inctfVar12m: number | null;
  /** Período mais recente do INCTL (ex: '2026-01') */
  latestInctlPeriod: string | null;
  /** Período mais recente do INCTF (ex: '2026-01') */
  latestInctfPeriod: string | null;
  /** Preço médio nacional do diesel (R$/litro) */
  dieselPrice: number | null;
  /** Variação anual do diesel (%) */
  dieselVariation: number | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                          */
/* ------------------------------------------------------------------ */

/** Calcula variação percentual entre o valor mais antigo e o mais recente */
function pctChange(oldest: number, newest: number): number | null {
  if (!oldest || oldest === 0) return null;
  return ((newest - oldest) / oldest) * 100;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                             */
/* ------------------------------------------------------------------ */

const STALE_TIME = 5 * 60 * 1000; // 5 min

export function useNtcInsights() {
  /* --- INCTL (Lotação) - 12 meses x 5 faixas de distância = 60 rows --- */
  const inctlQuery = useQuery({
    queryKey: ['ntc-inctl-series'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ntc_cost_indices')
        .select('*')
        .eq('index_type', 'INCTL')
        .order('period', { ascending: false })
        .limit(60);

      if (error) throw error;
      return (data as NtcCostIndex[]) ?? [];
    },
    staleTime: STALE_TIME,
  });

  /* --- INCTF (Fracionado) - 12 meses x 1 série = 12 rows --- */
  const inctfQuery = useQuery({
    queryKey: ['ntc-inctf-series'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ntc_cost_indices')
        .select('*')
        .eq('index_type', 'INCTF')
        .order('period', { ascending: false })
        .limit(12);

      if (error) throw error;
      return (data as NtcCostIndex[]) ?? [];
    },
    staleTime: STALE_TIME,
  });

  /* --- Referência de combustível (row mais recente) --- */
  const fuelQuery = useQuery({
    queryKey: ['ntc-fuel-reference'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ntc_fuel_reference')
        .select('*')
        .order('reference_month', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data as NtcFuelReference | null) ?? null;
    },
    staleTime: STALE_TIME,
  });

  /* --- Computed summary --- */
  const summary = useMemo<NtcInsightsSummary>(() => {
    const inctlData = inctlQuery.data ?? [];
    const inctfData = inctfQuery.data ?? [];
    const fuel = fuelQuery.data ?? null;

    // INCTL: filtra distance_km = 800 e ordena por period asc para pegar primeiro e último
    const inctl800 = inctlData
      .filter((r) => r.distance_km === 800)
      .sort((a, b) => a.period.localeCompare(b.period));

    const inctlOldest = inctl800.length > 0 ? inctl800[0] : null;
    const inctlNewest = inctl800.length > 0 ? inctl800[inctl800.length - 1] : null;

    // INCTF: ja vem ordenado desc, reverter para asc
    const inctfSorted = [...inctfData].sort((a, b) => a.period.localeCompare(b.period));
    const inctfOldest = inctfSorted.length > 0 ? inctfSorted[0] : null;
    const inctfNewest = inctfSorted.length > 0 ? inctfSorted[inctfSorted.length - 1] : null;

    return {
      inctlVar12m:
        inctlOldest && inctlNewest
          ? pctChange(inctlOldest.index_value, inctlNewest.index_value)
          : null,
      inctfVar12m:
        inctfOldest && inctfNewest
          ? pctChange(inctfOldest.index_value, inctfNewest.index_value)
          : null,
      latestInctlPeriod: inctlNewest?.period ?? null,
      latestInctfPeriod: inctfNewest?.period ?? null,
      dieselPrice: fuel?.diesel_price_liter ?? null,
      dieselVariation: fuel?.annual_variation_pct ?? null,
    };
  }, [inctlQuery.data, inctfQuery.data, fuelQuery.data]);

  return {
    inctlSeries: inctlQuery.data ?? [],
    inctfSeries: inctfQuery.data ?? [],
    fuelReference: fuelQuery.data ?? null,
    summary,
    isLoading: inctlQuery.isLoading || inctfQuery.isLoading || fuelQuery.isLoading,
    isError: inctlQuery.isError || inctfQuery.isError || fuelQuery.isError,
  };
}
