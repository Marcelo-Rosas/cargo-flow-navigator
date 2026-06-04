import { describe, expect, it } from 'vitest';
import { shouldPreferLocalLotacaoFreightPreview } from '@/lib/prefer-lotacao-freight-preview';
import type { FreightCalculationOutput } from '@/lib/freightCalculator';

const stub = (baseCost: number, anttCostBaseUsed?: boolean): FreightCalculationOutput =>
  ({
    status: 'OK',
    components: { baseCost, baseFreight: baseCost },
    meta: { anttCostBaseUsed },
  }) as FreightCalculationOutput;

describe('shouldPreferLocalLotacaoFreightPreview', () => {
  it('prefere local quando Edge não usa piso como base (COT-2026-06-0002)', () => {
    expect(
      shouldPreferLocalLotacaoFreightPreview({
        local: stub(17304.92, true),
        edge: stub(26841.4),
        edgeRaw: {
          success: true,
          meta: { antt_piso_carreteiro: 17304.92, antt_cost_base_used: false },
        } as never,
        localPiso: 17304.92,
      })
    ).toBe(true);
  });

  it('não prefere local quando Edge já usa antt_cost_base_used', () => {
    expect(
      shouldPreferLocalLotacaoFreightPreview({
        local: stub(17304.92, true),
        edge: stub(17304.92),
        edgeRaw: {
          success: true,
          meta: { antt_piso_carreteiro: 17304.92, antt_cost_base_used: true },
        } as never,
        localPiso: 17304.92,
      })
    ).toBe(false);
  });
});
