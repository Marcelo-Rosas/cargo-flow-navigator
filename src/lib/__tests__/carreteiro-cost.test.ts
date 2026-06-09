import { describe, expect, it } from 'vitest';
import { readMetaAnttPisoCarreteiro, resolvePisoAnttCarreteiroReais } from '@/lib/carreteiro-cost';
import type { StoredPricingBreakdown } from '@/lib/freightCalculator';

describe('carreteiro-cost', () => {
  it('readMetaAnttPisoCarreteiro não confunde piso carreteiro com lotacaoPisoComOver', () => {
    expect(
      readMetaAnttPisoCarreteiro({
        anttPisoCarreteiro: 17831.67,
        lotacaoPisoComOver: 19614.84,
      })
    ).toBe(17831.67);
  });

  it('resolvePisoAnttCarreteiroReais prioriza meta.antt sobre contratado inflado', () => {
    const breakdown = {
      status: 'OK',
      meta: {
        anttPisoCarreteiro: 17831.67,
        lotacaoPisoComOver: 19614.84,
        anttCostBaseUsed: true,
      },
      profitability: {
        custoMotoristaAntt: 19614.84,
        custoMotoristaContratado: 19614.84,
      },
      components: { baseCost: 19614.84 },
    } as unknown as StoredPricingBreakdown;

    expect(resolvePisoAnttCarreteiroReais(breakdown)).toBe(17831.67);
  });
});
