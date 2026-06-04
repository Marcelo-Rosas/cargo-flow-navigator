import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UseFreightBenchmarksOptions {
  origin: string;
  destination: string;
  cargoType?: string;
  enabled?: boolean;
}

export function useFreightBenchmarks({
  origin,
  destination,
  cargoType,
  enabled = true,
}: UseFreightBenchmarksOptions) {
  return useQuery({
    queryKey: ['freight-benchmarks', origin, destination, cargoType],
    queryFn: async () => {
      // 1. Fetch History Benchmark (2025)
      // Calculamos a média do total_cliente para cotações ganhas (stage = 'ganho')
      let historyBenchmark2025: number | undefined = undefined;

      const originStr = origin ? origin.trim().toLowerCase() : '';
      const destStr = destination ? destination.trim().toLowerCase() : '';

      if (originStr && destStr) {
        // Obter UFs
        const ufRegex = /([A-Z]{2})\s*$/i;
        const matchOrig = origin.match(ufRegex);
        const matchDest = destination.match(ufRegex);

        const ufOrigem = matchOrig ? matchOrig[1].toUpperCase() : null;
        const ufDestino = matchDest ? matchDest[1].toUpperCase() : null;

        if (ufOrigem && ufDestino) {
          const { data, error } = await supabase
            .from('quotes')
            .select('pricing_breakdown')
            .eq('stage', 'ganho')
            .ilike('origin', `%${ufOrigem}%`)
            .ilike('destination', `%${ufDestino}%`)
            .order('created_at', { ascending: false })
            .limit(50);

          if (!error && data && data.length > 0) {
            let totalSum = 0;
            let validCount = 0;

            for (const row of data) {
              const breakdown = row.pricing_breakdown as any;
              if (breakdown?.totals?.totalCliente) {
                totalSum += Number(breakdown.totals.totalCliente);
                validCount++;
              }
            }

            if (validCount > 0) {
              historyBenchmark2025 = totalSum / validCount;
            }
          }
        }
      }

      // 2. Fetch CKAN Benchmark
      // Como a tabela/API do CKAN será integrada posteriormente, vamos manter como undefined
      // ou se existir uma tabela antt_ckan_freight_data poderemos buscá-la aqui.
      let ckanBenchmark: number | undefined = undefined;

      // TODO: Implementar busca na tabela do CKAN quando disponível

      return {
        historyBenchmark2025,
        ckanBenchmark,
      };
    },
    enabled: enabled && !!origin && !!destination,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
