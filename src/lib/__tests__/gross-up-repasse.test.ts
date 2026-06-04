import { describe, expect, it } from 'vitest';
import { calculateFreight, sumRiskRepasse } from '@/lib/freightCalculator';
import type { FreightCalculationInput } from '@/lib/freightCalculator';
import type { Database } from '@/integrations/supabase/types';

type PriceTableRow = Database['public']['Tables']['price_table_rows']['Row'];

const mockRow = {
  cost_per_ton: 2000,
  km_from: 2501,
  km_to: 3000,
} as PriceTableRow;

describe('sumRiskRepasse', () => {
  it('soma componentes de repasse', () => {
    expect(sumRiskRepasse({ adValorem: 100, rctrc: 200, gris: 0, tso: 0 })).toBe(300);
  });
});

describe('gross-up lotação com repasse fora do divisor', () => {
  it('total cliente não aplica taxa bruta sobre ad valorem/rctrc', () => {
    const input: FreightCalculationInput = {
      originCity: 'Indaiatuba - SP',
      destinationCity: 'João Pessoa - PB',
      kmDistance: 2910,
      weightKg: 4000,
      volumeM3: 10,
      cargoValue: 400_000,
      tollValue: 925,
      priceTableRow: mockRow,
      modality: 'lotacao',
      icmsRatePercent: 12,
      pisoAnttCarreteiro: 22_000,
      pricingParams: {
        dasPercent: 14,
        overheadPercent: 15,
        profitMarginPercent: 15,
        regimeSimplesNacional: true,
        excessoSublimite: false,
        adValoremLotacaoPercent: 0.3,
        costValuePercent: 0.3,
        overLotacaoKmPercent: 0,
        overLotacaoPercent: 0,
      },
    };

    const out = calculateFreight(input);
    expect(out.status).toBe('OK');
    const repasse = sumRiskRepasse(out.components);
    expect(repasse).toBeGreaterThan(0);

    const cd = out.profitability.custosDiretos;
    const taxa = (15 + 14 + 15) / 100;
    const totalSemRepasseNoDivisor = Math.round((cd / (1 - taxa) + repasse) * 100) / 100;
    expect(out.totals.totalCliente).toBeCloseTo(totalSemRepasseNoDivisor, 0);

    const totalSeRepasseEntrasseNoDivisor = Math.round(((cd + repasse) / (1 - taxa)) * 100) / 100;
    expect(out.totals.totalCliente).toBeLessThan(totalSeRepasseEntrasseNoDivisor - 100);
  });
});
