import type { StoredPricingBreakdown } from '@/lib/freightCalculator';

/** Mantém desconto comercial no breakdown quando o valor da cotação é menor que o preço de tabela. */
export function mergeBreakdownWithNegotiatedDiscount(
  breakdown: StoredPricingBreakdown,
  negotiatedValueReais: number,
  formulaTotalReais: number
): StoredPricingBreakdown {
  const discount = Math.max(0, Math.round((formulaTotalReais - negotiatedValueReais) * 100) / 100);
  return {
    ...breakdown,
    totals: {
      ...breakdown.totals,
      discount,
    },
  };
}
