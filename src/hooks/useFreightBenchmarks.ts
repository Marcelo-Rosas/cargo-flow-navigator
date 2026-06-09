import { useQuery } from '@tanstack/react-query';
import { resolveCkanBenchmarkLiquidoReais } from '@/lib/ckan-benchmark';

export interface UseFreightBenchmarksOptions {
  origin: string;
  destination: string;
  cargoType?: string | null;
  kmDistance?: number;
  enabled?: boolean;
}

export interface FreightBenchmarksResult {
  /** Frete seco CKAN (R$) — base para gross-up no match */
  ckanBenchmark: number;
  ckanBenchmarkPerKm: number;
}

export function useFreightBenchmarks({
  origin,
  destination,
  cargoType,
  kmDistance = 0,
  enabled = true,
}: UseFreightBenchmarksOptions) {
  return useQuery({
    queryKey: ['freight-benchmarks-ckan', origin, destination, cargoType, kmDistance],
    queryFn: async (): Promise<FreightBenchmarksResult> => {
      const km = Math.max(0, Number(kmDistance) || 0);
      const ckanBenchmark =
        km > 0 && origin?.trim() && destination?.trim()
          ? resolveCkanBenchmarkLiquidoReais({ kmDistance: km, cargoType })
          : 0;
      return {
        ckanBenchmark,
        ckanBenchmarkPerKm: km > 0 ? Math.round((ckanBenchmark / km) * 100) / 100 : 0,
      };
    },
    enabled: enabled && !!origin?.trim() && !!destination?.trim() && (kmDistance ?? 0) > 0,
    staleTime: 1000 * 60 * 30,
  });
}
