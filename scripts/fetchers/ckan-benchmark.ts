/**
 * Fetcher simulado para obter a média de mercado do portal de Dados Abertos (CKAN ANTT).
 *
 * NOTA: O payload real de CSV de frete do governo ultrapassa 100MB e não é ideal
 * para parseamento síncrono em Node sem pipelines de dados (ex: Data Warehouse).
 * Aqui, disponibilizamos as médias agregadas para 2024 para uso no Match de Precificação.
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

/**
 * Retorna as faixas de preço praticadas pelo mercado para o tipo de carga.
 * Em um cenário ideal, isso poderia buscar direto de uma API em cache no Supabase.
 */
export async function fetchMarketBenchmark(
  cargoType: string = 'carga_geral'
): Promise<MarketBenchmark> {
  return MARKET_BENCHMARKS[cargoType] || MARKET_BENCHMARKS['carga_geral'];
}
