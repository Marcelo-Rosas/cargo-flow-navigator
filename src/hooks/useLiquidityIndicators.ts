type LiquidityIndicatorsResult = {
  liquidezCorrente: number | null;
  statusCorrente: number;
  liquidezSeca: number | null;
  statusSeca: number;
  liquidezImediata: number | null;
  statusImediata: number;
};

type UseLiquidityIndicatorsReturn = {
  result: LiquidityIndicatorsResult | null;
  isLoading: boolean;
};

export function useLiquidityIndicators(): UseLiquidityIndicatorsReturn {
  const result: LiquidityIndicatorsResult | null = null;
  return { result, isLoading: false };
}
