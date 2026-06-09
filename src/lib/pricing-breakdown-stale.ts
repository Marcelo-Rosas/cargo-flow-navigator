import type { StoredPricingBreakdown } from '@/lib/freightCalculator';

export interface ExpectedTaxRegime {
  lucroPresumido: boolean;
  simplesNacional: boolean;
}

export function isPricingBreakdownRegimeStale(
  breakdown: StoredPricingBreakdown | null | undefined,
  expected: ExpectedTaxRegime
): boolean {
  if (!breakdown?.profitability) return false;
  const stored = breakdown.profitability.regimeFiscal ?? 'normal';
  if (expected.lucroPresumido) {
    return stored !== 'lucro_presumido';
  }
  if (expected.simplesNacional) {
    return stored !== 'simples_nacional';
  }
  return false;
}

export function expectedRegimeLabel(expected: ExpectedTaxRegime): string {
  if (expected.lucroPresumido) return 'Lucro Presumido';
  if (expected.simplesNacional) return 'Simples Nacional';
  return 'Regime Normal';
}
