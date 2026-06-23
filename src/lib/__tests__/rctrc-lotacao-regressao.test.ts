import { describe, expect, it } from 'vitest';
import { calculateFreight, sumRiskRepasse } from '@/lib/freightCalculator';
import type { FreightCalculationInput } from '@/lib/freightCalculator';
import type { Database } from '@/integrations/supabase/types';

type PriceTableRow = Database['public']['Tables']['price_table_rows']['Row'];

/**
 * Regressão do incidente B (docs/NTC_DIVERGENCIAS_LOTACAO.md):
 * "cost_value_percent (RCTR-C) zerado pela regra global ... zerando RCTR-C de
 * todas as cotações lotação desde 2026-04-16." Resolução acordada (2026-05-01 /
 * 2026-05-11): RCTR-C NÃO zera em lotação — vem do cost_value_percent (tabela,
 * ou Central > 0 como override).
 *
 * O edge (supabase/functions/calculate-freight/index.ts:509/1166) já implementa
 * isso: frete_valor = cargo_value * cost_value_percent, gravado no campo `rctrc`.
 * O client freightCalculator.ts:1105 ainda mantém `const rctrc = !isLtl ? 0 : ...`,
 * zerando RCTR-C em lotação — exatamente o comportamento do incidente B.
 *
 * Este teste trava o comportamento acordado no motor client. Falha enquanto o
 * gate `!isLtl ? 0` existir.
 */
const mockRow = {
  cost_per_ton: 2000,
  km_from: 2501,
  km_to: 3000,
} as PriceTableRow;

const lotacaoInput: FreightCalculationInput = {
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
    // Central = 0,3 → override global; valor 0 cairia na tabela (incidente B.2)
    costValuePercent: 0.3,
    overLotacaoKmPercent: 0,
    overLotacaoPercent: 0,
  },
};

describe('RCTR-C em lotação — regressão incidente B (NTC_DIVERGENCIAS_LOTACAO)', () => {
  /**
   * PARIDADE DE FÓRMULA (não de execução). O esperado é derivado do MESMO input
   * via a fórmula do edge — supabase/functions/calculate-freight/index.ts:509:
   *   const frete_valor = input.cargo_value * (costValuePercent / 100);
   *   // index.ts:1166 → gravado no campo `rctrc`
   * Não roda o edge (Deno + Supabase); o edge lê cost_value_percent do DB, o
   * client recebe via pricingParams. Paridade de EXECUÇÃO exige contract/e2e real.
   */
  it('NÃO zera RCTR-C em lotação; pareia com a fórmula do edge (index.ts:509)', () => {
    const out = calculateFreight(lotacaoInput);
    expect(out.status).toBe('OK');

    // Derivado do input — sem número mágico.
    const expectedRctrc =
      Math.round(
        lotacaoInput.cargoValue * (lotacaoInput.pricingParams!.costValuePercent! / 100) * 100
      ) / 100;
    expect(out.components.rctrc).toBeCloseTo(expectedRctrc, 2);
    expect(out.components.rctrc).toBeGreaterThan(0);
  });

  it('repasse de lotação = Ad Valorem + RCTR-C (dois componentes distintos, Itens A+B)', () => {
    const out = calculateFreight(lotacaoInput);
    expect(out.status).toBe('OK');

    expect(out.components.adValorem).toBeGreaterThan(0);
    expect(out.components.rctrc).toBeGreaterThan(0);

    const repasse = sumRiskRepasse(out.components);
    expect(repasse).toBeCloseTo(
      (out.components.gris ?? 0) +
        (out.components.tso ?? 0) +
        (out.components.rctrc ?? 0) +
        (out.components.adValorem ?? 0),
      2
    );
    // Repasse precisa conter as DUAS parcelas, não só o Ad Valorem.
    expect(repasse).toBeGreaterThan(out.components.adValorem ?? 0);
  });

  it('GRIS e TSO seguem zerados em lotação (Item C) — fix não os reativa', () => {
    const out = calculateFreight(lotacaoInput);
    expect(out.status).toBe('OK');
    expect(out.components.gris).toBe(0);
    expect(out.components.tso).toBe(0);
  });

  it('fracionado mantém RCTR-C (sem regressão na modalidade que já funcionava)', () => {
    const out = calculateFreight({
      ...lotacaoInput,
      modality: 'fracionado',
      pisoAnttCarreteiro: undefined,
    });
    expect(out.status).toBe('OK');
    expect(out.components.rctrc).toBeGreaterThan(0);
  });
});
