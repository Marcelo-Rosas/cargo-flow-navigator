export {
  MARKET_BENCHMARKS,
  resolveCkanBenchmarkLiquidoReais,
  resolveCkanCargoTypeKey,
  type MarketBenchmark,
} from '../../src/lib/ckan-benchmark';

/** @deprecated Use resolveCkanBenchmarkLiquidoReais */
export async function fetchMarketBenchmark(cargoType: string = 'carga_geral') {
  const { MARKET_BENCHMARKS, resolveCkanCargoTypeKey } =
    await import('../../src/lib/ckan-benchmark');
  return MARKET_BENCHMARKS[resolveCkanCargoTypeKey(cargoType)];
}
