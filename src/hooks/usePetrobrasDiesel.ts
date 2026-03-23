import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PetrobrasDieselData {
  uf: string;
  preco_medio: number;
  periodo_coleta: string | null;
  fetched_at: string;
  variacao_pct: number | null;
  parcela_petrobras: number | null;
  parcela_impostos_federais: number | null;
  parcela_icms: number | null;
  parcela_biodiesel: number | null;
  parcela_distribuicao: number | null;
}

async function fetchFromTable(uf: string): Promise<PetrobrasDieselData | null> {
  // Busca os 2 períodos de coleta mais recentes (distinct por periodo_coleta)
  const { data, error } = await supabase
    .from('petrobras_diesel_prices' as 'documents')
    .select(
      'uf, preco_medio, periodo_coleta, fetched_at, parcela_petrobras, parcela_impostos_federais, parcela_icms, parcela_biodiesel, parcela_distribuicao'
    )
    .eq('uf', uf.toUpperCase())
    .order('fetched_at', { ascending: false })
    .limit(10); // pega mais registros para garantir 2 períodos distintos

  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return null;

  const latest = rows[0];

  // Buscar registro de período ANTERIOR (período diferente do mais recente)
  const prev = rows.find((r) => r.periodo_coleta !== latest.periodo_coleta) ?? null;

  const variacao_pct =
    prev && Number(prev.preco_medio) > 0
      ? Math.round(
          ((Number(latest.preco_medio) - Number(prev.preco_medio)) / Number(prev.preco_medio)) *
            10000
        ) / 100
      : null;

  return {
    uf: latest.uf,
    preco_medio: Number(latest.preco_medio),
    periodo_coleta: latest.periodo_coleta,
    fetched_at: latest.fetched_at,
    variacao_pct,
    parcela_petrobras: latest.parcela_petrobras ? Number(latest.parcela_petrobras) : null,
    parcela_impostos_federais: latest.parcela_impostos_federais
      ? Number(latest.parcela_impostos_federais)
      : null,
    parcela_icms: latest.parcela_icms ? Number(latest.parcela_icms) : null,
    parcela_biodiesel: latest.parcela_biodiesel ? Number(latest.parcela_biodiesel) : null,
    parcela_distribuicao: latest.parcela_distribuicao ? Number(latest.parcela_distribuicao) : null,
  };
}

async function callEdgeFunction(uf: string): Promise<PetrobrasDieselData> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

  const response = await fetch(
    `${supabaseUrl}/functions/v1/petrobras-diesel?uf=${uf.toUpperCase()}`,
    {
      headers: {
        Authorization: `Bearer ${token ?? anonKey}`,
        apikey: anonKey,
      },
    }
  );

  if (!response.ok) throw new Error(`petrobras-diesel returned ${response.status}`);
  return response.json();
}

export function usePetrobrasDiesel(uf = 'BR') {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['petrobras-diesel', uf.toUpperCase()], // normaliza para evitar cache duplicado
    queryFn: async () => {
      const cached = await fetchFromTable(uf);
      if (cached) return cached;
      // Banco vazio para esta UF — chama Edge Function para popular
      return callEdgeFunction(uf);
    },
    staleTime: 0, // FIX: sempre considera dado stale ao mudar UF
    gcTime: 1000 * 60 * 120,
    retry: 2,
  });

  /** Manual refresh — força nova coleta via Edge Function */
  const refresh = async () => {
    await callEdgeFunction(uf);
    queryClient.invalidateQueries({ queryKey: ['petrobras-diesel', uf.toUpperCase()] });
  };

  return { ...query, refresh };
}
