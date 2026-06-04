/**
 * Benchmarks agregados CKAN/ANTT (dados abertos) — frete líquido de mercado por tipo de carga.
 * Paridade com scripts/fetchers/ckan-benchmark.ts
 */

export interface MarketBenchmark {
  tkm_min: number;
  tkm_max: number;
  km_20t_min: number;
  km_20t_max: number;
}

export const MARKET_BENCHMARKS: Record<string, MarketBenchmark> = {
  carga_geral: {
    tkm_min: 0.35,
    tkm_max: 0.55,
    km_20t_min: 7.0,
    km_20t_max: 11.0,
  },
  equipamentos: {
    tkm_min: 0.5,
    tkm_max: 0.85,
    km_20t_min: 10.0,
    km_20t_max: 17.0,
  },
  refrigerada: {
    tkm_min: 0.75,
    tkm_max: 1.2,
    km_20t_min: 15.0,
    km_20t_max: 24.0,
  },
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Mapeia texto do formulário para chave CKAN. */
export function resolveCkanCargoTypeKey(cargoType?: string | null): keyof typeof MARKET_BENCHMARKS {
  const t = (cargoType ?? '').toLowerCase();
  if (t.includes('refrig')) return 'refrigerada';
  if (
    t.includes('equip') ||
    t.includes('máquina') ||
    t.includes('maquina') ||
    t.includes('intercamb') ||
    t.includes('gerador')
  ) {
    return 'equipamentos';
  }
  return 'carga_geral';
}

/** Frete seco CKAN (R$ total) = média R$/km mercado × distância. */
export function resolveCkanBenchmarkLiquidoReais(params: {
  kmDistance: number;
  cargoType?: string | null;
}): number {
  const km = Math.max(0, Number(params.kmDistance) || 0);
  if (km <= 0) return 0;
  const bench = MARKET_BENCHMARKS[resolveCkanCargoTypeKey(params.cargoType)];
  const midPerKm = (bench.km_20t_min + bench.km_20t_max) / 2;
  return round2(midPerKm * km);
}

export function resolveCkanBenchmarkPerKm(params: {
  kmDistance: number;
  cargoType?: string | null;
}): number {
  const km = Math.max(0, Number(params.kmDistance) || 0);
  if (km <= 0) return 0;
  const total = resolveCkanBenchmarkLiquidoReais(params);
  return round2(total / km);
}
