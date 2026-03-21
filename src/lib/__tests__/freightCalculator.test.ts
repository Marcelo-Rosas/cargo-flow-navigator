import { describe, it, expect } from 'vitest';
import {
  calculateFreight,
  buildStoredBreakdown,
  round2,
  normalizeIcmsRate,
  ufFromCep,
  extractUf,
  formatRouteUf,
  FREIGHT_CONSTANTS,
  type FreightCalculationInput,
} from '../freightCalculator';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal valid FTL input */
function makeFtlInput(overrides: Partial<FreightCalculationInput> = {}): FreightCalculationInput {
  return {
    originCity: 'Navegantes, SC',
    destinationCity: 'São Paulo, SP',
    kmDistance: 600,
    weightKg: 10000,
    volumeM3: 20,
    cargoValue: 100000,
    tollValue: 350,
    icmsRatePercent: 12,
    priceTableRow: {
      id: 'row-1',
      price_table_id: 'pt-1',
      km_from: 500,
      km_to: 700,
      cost_per_ton: 150,
      cost_per_kg: null,
      cost_value_percent: 0.3,
      gris_percent: 0.3,
      tso_percent: 0.15,
      toll_percent: null,
      weight_rate_10: null,
      weight_rate_20: null,
      weight_rate_30: null,
      weight_rate_50: null,
      weight_rate_70: null,
      weight_rate_100: null,
      weight_rate_150: null,
      weight_rate_200: null,
      weight_rate_above_200: null,
      created_at: '2026-01-01',
    },
    ...overrides,
  };
}

// ─── round2 ──────────────────────────────────────────────────────────────────

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(1.004)).toBe(1);
    expect(round2(123.456)).toBe(123.46);
    expect(round2(0)).toBe(0);
    expect(round2(-1.235)).toBe(-1.23);
  });
});

// ─── normalizeIcmsRate ───────────────────────────────────────────────────────

describe('normalizeIcmsRate', () => {
  it('returns 0 for 0', () => {
    expect(normalizeIcmsRate(0)).toBe(0);
  });

  it('passes through valid rates (3-25)', () => {
    expect(normalizeIcmsRate(12)).toBe(12);
    expect(normalizeIcmsRate(18)).toBe(18);
    expect(normalizeIcmsRate(7)).toBe(7);
  });

  it('converts decimal fraction to percent (0.12 → 12)', () => {
    expect(normalizeIcmsRate(0.12)).toBe(12);
    expect(normalizeIcmsRate(0.18)).toBe(18);
  });

  it('converts small fraction (1.2 → 12)', () => {
    expect(normalizeIcmsRate(1.2)).toBe(12);
  });

  it('converts over-100 values (120 → 12)', () => {
    expect(normalizeIcmsRate(120)).toBe(12);
  });
});

// ─── ufFromCep ───────────────────────────────────────────────────────────────

describe('ufFromCep', () => {
  it('identifies SC from CEP range', () => {
    expect(ufFromCep('88370000')).toBe('SC');
    expect(ufFromCep('88370-000')).toBe('SC');
  });

  it('identifies SP from CEP range', () => {
    expect(ufFromCep('01310100')).toBe('SP');
  });

  it('returns null for invalid CEP', () => {
    expect(ufFromCep('1234')).toBeNull();
    expect(ufFromCep(null)).toBeNull();
    expect(ufFromCep(undefined)).toBeNull();
    expect(ufFromCep('')).toBeNull();
  });
});

// ─── extractUf / formatRouteUf ───────────────────────────────────────────────

describe('extractUf', () => {
  it('extracts UF from "City, SC"', () => {
    expect(extractUf('Navegantes, SC')).toBe('SC');
  });

  it('extracts UF from "City - SP"', () => {
    expect(extractUf('São Paulo - SP')).toBe('SP');
  });

  it('returns null for empty string', () => {
    expect(extractUf('')).toBeNull();
  });
});

describe('formatRouteUf', () => {
  it('formats origin→destination UF', () => {
    expect(formatRouteUf('Navegantes, SC', 'São Paulo, SP')).toBe('SC→SP');
  });

  it('returns null when both inputs have no UF-like suffix', () => {
    expect(formatRouteUf('', '')).toBeNull();
  });
});

// ─── calculateFreight: FTL (Lotação) ─────────────────────────────────────────

describe('calculateFreight — FTL', () => {
  it('returns OK status for valid input', () => {
    const result = calculateFreight(makeFtlInput());
    expect(result.status).toBe('OK');
  });

  it('computes billable weight as max(weight, cubage)', () => {
    const result = calculateFreight(makeFtlInput());
    const expectedCubage = round2(20 * FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3); // 6000
    expect(result.meta.cubageWeightKg).toBe(expectedCubage);
    // weightKg=10000 > cubage=6000 → billable = 10000
    expect(result.meta.billableWeightKg).toBe(10000);
  });

  it('uses cubage weight when volume exceeds physical weight', () => {
    const result = calculateFreight(makeFtlInput({ weightKg: 1000, volumeM3: 50 }));
    // cubage = 50 * 300 = 15000 > 1000
    expect(result.meta.billableWeightKg).toBe(15000);
  });

  it('computes baseCost from cost_per_ton', () => {
    const result = calculateFreight(makeFtlInput());
    // baseCost = (10000 / 1000) * 150 = 1500
    expect(result.components.baseCost).toBe(1500);
  });

  it('applies markup to base freight (FTL default BASE_ONLY)', () => {
    const result = calculateFreight(makeFtlInput());
    // baseFreight = 1500 * (1 + 30/100) = 1950
    expect(result.components.baseFreight).toBe(1950);
  });

  it('uses Ad Valorem for FTL (not GRIS/TSO)', () => {
    const result = calculateFreight(makeFtlInput());
    expect(result.components.gris).toBe(0);
    expect(result.components.tso).toBe(0);
    // adValorem = 100000 * 0.03/100 = 30
    expect(result.components.adValorem).toBe(30);
  });

  it('computes toll from input', () => {
    const result = calculateFreight(makeFtlInput());
    expect(result.components.toll).toBe(350);
  });

  it('totalCliente > custosDiretos', () => {
    const result = calculateFreight(makeFtlInput());
    expect(result.totals.totalCliente).toBeGreaterThan(result.profitability.custosDiretos);
  });

  it('profitability.margemPercent is a percentage', () => {
    const result = calculateFreight(makeFtlInput());
    expect(result.profitability.margemPercent).toBeGreaterThan(0);
    expect(result.profitability.margemPercent).toBeLessThan(100);
  });

  it('receitaBruta equals totalCliente (gross-up)', () => {
    const result = calculateFreight(makeFtlInput());
    expect(result.totals.receitaBruta).toBe(result.totals.totalCliente);
  });

  it('Simples Nacional: ICMS = 0', () => {
    const result = calculateFreight(makeFtlInput());
    expect(result.totals.icms).toBe(0);
    expect(result.rates.icmsPercent).toBe(0);
  });

  it('Excesso Sublimite: ICMS > 0', () => {
    const result = calculateFreight(
      makeFtlInput({
        pricingParams: {
          regimeSimplesNacional: true,
          excessoSublimite: true,
        },
      })
    );
    expect(result.totals.icms).toBeGreaterThan(0);
    expect(result.profitability.regimeFiscal).toBe('excesso_sublimite');
  });

  it('accounting identity: totalCliente = DAS + ICMS + receitaLiquida', () => {
    const result = calculateFreight(makeFtlInput());
    const sum = round2(result.totals.das + result.totals.icms + result.profitability.receitaLiquida);
    expect(sum).toBe(result.totals.totalCliente);
  });

  it('accounting identity: resultadoLiquido = receitaLiquida - overhead - custosDiretos', () => {
    const result = calculateFreight(makeFtlInput());
    const expected = round2(
      result.profitability.receitaLiquida -
        result.profitability.overhead -
        result.profitability.custosDiretos
    );
    expect(result.profitability.resultadoLiquido).toBe(expected);
  });
});

// ─── calculateFreight: error cases ───────────────────────────────────────────

describe('calculateFreight — error cases', () => {
  it('returns MISSING_DATA when priceTableRow is null', () => {
    const result = calculateFreight(makeFtlInput({ priceTableRow: null }));
    expect(result.status).toBe('MISSING_DATA');
  });

  it('returns OUT_OF_RANGE when priceTableId set but row is null', () => {
    const result = calculateFreight(
      makeFtlInput({ priceTableRow: null, priceTableId: 'pt-1' })
    );
    expect(result.status).toBe('OUT_OF_RANGE');
  });

  it('returns OUT_OF_RANGE when kmDistance outside km band', () => {
    const result = calculateFreight(makeFtlInput({ kmDistance: 900 }));
    expect(result.status).toBe('OUT_OF_RANGE');
  });
});

// ─── calculateFreight: markup scopes ─────────────────────────────────────────

describe('calculateFreight — markup scopes', () => {
  it('BASE_PLUS_INSURANCE includes tso+rctrc in markup base', () => {
    const input = makeFtlInput({
      pricingParams: { markupScope: 'BASE_PLUS_INSURANCE' },
    });
    const result = calculateFreight(input);
    // With ad valorem (FTL), tso=0 and rctrc is based on costValuePercent
    // baseFreight should differ from BASE_ONLY
    const baseOnly = calculateFreight(makeFtlInput());
    // In FTL, tso=0, rctrc = 100000*0.3/100 = 300, so markup base is larger
    expect(result.components.baseFreight).toBeGreaterThan(baseOnly.components.baseFreight);
  });

  it('ALL_PERCENT_COMPONENTS includes gris+tso+rctrc', () => {
    const input = makeFtlInput({
      pricingParams: { markupScope: 'ALL_PERCENT_COMPONENTS' },
    });
    const result = calculateFreight(input);
    const baseOnly = calculateFreight(makeFtlInput());
    // In FTL gris=0, tso=0, but rctrc=300, so markup base includes rctrc
    expect(result.components.baseFreight).toBeGreaterThan(baseOnly.components.baseFreight);
  });
});

// ─── calculateFreight: LTL (Fracionado) ──────────────────────────────────────

describe('calculateFreight — LTL', () => {
  function makeLtlInput(overrides: Partial<FreightCalculationInput> = {}): FreightCalculationInput {
    return makeFtlInput({
      modality: 'fracionado',
      weightKg: 150,
      volumeM3: 0.3,
      cargoValue: 5000,
      priceTableRow: {
        ...makeFtlInput().priceTableRow!,
        weight_rate_150: 5.0,
        weight_rate_200: 4.5,
        weight_rate_above_200: 3.0,
      },
      ltlParams: {
        minFreight: 200,
        minFreightCargoLimit: 10000,
        minTso: 15,
        grisPercent: 0.3,
        grisMin: 10,
        grisMinCargoLimit: 20000,
        dispatchFee: 102.9,
      },
      ...overrides,
    });
  }

  it('applies minimum 1000kg weight for fracionado', () => {
    const result = calculateFreight(makeLtlInput({ weightKg: 150 }));
    expect(result.meta.ltlMinWeightApplied).toBe(true);
    expect(result.meta.billableWeightKg).toBe(1000);
  });

  it('uses weight_rate column for baseCost', () => {
    // weightKg=150, minimum applied → 1000 kg, but weight column based on 1000 → above_200
    const result = calculateFreight(makeLtlInput());
    // 1000 * weight_rate_above_200 (3.0) = 3000
    expect(result.components.baseCost).toBe(3000);
  });

  it('does NOT apply markup for fracionado', () => {
    const result = calculateFreight(makeLtlInput());
    expect(result.components.baseFreight).toBe(result.components.baseCost);
  });

  it('uses GRIS/TSO (not Ad Valorem) for fracionado', () => {
    const result = calculateFreight(makeLtlInput());
    expect(result.components.adValorem).toBe(0);
    expect(result.components.gris).toBeGreaterThanOrEqual(0);
    expect(result.components.tso).toBeGreaterThanOrEqual(0);
  });

  it('applies dispatch fee', () => {
    const result = calculateFreight(makeLtlInput());
    expect(result.components.dispatchFee).toBe(102.9);
  });

  it('enforces minimum TSO from ltlParams', () => {
    // cargoValue=5000 → tso = 5000 * 0.15/100 = 7.5, min is 15
    const result = calculateFreight(makeLtlInput());
    expect(result.components.tso).toBe(15);
  });
});

// ─── calculateFreight: extras ────────────────────────────────────────────────

describe('calculateFreight — extras', () => {
  it('includes conditional fees in custoServicos', () => {
    const result = calculateFreight(
      makeFtlInput({
        extras: {
          conditionalFees: { ids: ['fee-1'], total: 200, breakdown: { 'fee-1': 200 } },
        },
      })
    );
    expect(result.components.conditionalFeesTotal).toBe(200);
  });

  it('includes waiting time cost', () => {
    const result = calculateFreight(
      makeFtlInput({
        extras: {
          waitingTimeCost: 150,
          waitingTimeHours: 4,
          waitingTimeEnabled: true,
        },
      })
    );
    expect(result.components.waitingTimeCost).toBe(150);
  });

  it('includes aluguel de maquinas', () => {
    const result = calculateFreight(makeFtlInput({ aluguelMaquinasValue: 500 }));
    expect(result.components.aluguelMaquinas).toBe(500);
  });
});

// ─── calculateFreight: ICMS proporcional por UF ──────────────────────────────

describe('calculateFreight — ICMS proporcional por UF', () => {
  it('computes weighted average ICMS from kmByUf', () => {
    const result = calculateFreight(
      makeFtlInput({
        kmByUf: { SC: 200, SP: 400 },
        icmsByUf: { SC: 12, SP: 18 },
        pricingParams: {
          regimeSimplesNacional: true,
          excessoSublimite: true,
        },
      })
    );
    // Weighted: (200/600)*12 + (400/600)*18 = 4 + 12 = 16
    expect(result.totals.icms).toBeGreaterThan(0);
    expect(result.profitability.regimeFiscal).toBe('excesso_sublimite');
  });
});

// ─── calculateFreight: LTL GRIS min / BELOW_TARGET ─────────────────────────

describe('calculateFreight — LTL GRIS minimum', () => {
  it('applies grisMin when cargo below grisMinCargoLimit', () => {
    const result = calculateFreight(
      makeFtlInput({
        modality: 'fracionado',
        weightKg: 2000,
        cargoValue: 500, // low cargo → gris calc will be tiny
        ltlParams: {
          minWeightKg: 1000,
          grisPercent: 0.3,
          grisMin: 50, // minimum gris
          grisMinCargoLimit: 10000, // cargo 500 < 10000 → applies grisMin
          minTso: 20,
        },
        priceTableRow: {
          ...makeFtlInput().priceTableRow!,
          weight_rate_20: 5,
          weight_rate_30: 4.5,
        },
      })
    );
    expect(result.components.gris).toBeGreaterThanOrEqual(50);
  });

  it('applies minTso when tso is below minimum', () => {
    const result = calculateFreight(
      makeFtlInput({
        modality: 'fracionado',
        weightKg: 2000,
        cargoValue: 100, // very low cargo → tso tiny
        ltlParams: {
          minWeightKg: 1000,
          grisPercent: 0.3,
          grisMin: 0,
          grisMinCargoLimit: 0,
          minTso: 30,
        },
        priceTableRow: {
          ...makeFtlInput().priceTableRow!,
          weight_rate_20: 5,
          weight_rate_30: 4.5,
        },
      })
    );
    expect(result.components.tso).toBeGreaterThanOrEqual(30);
  });
});

describe('calculateFreight — margin status', () => {
  it('reports BELOW_TARGET when margin is low', () => {
    const result = calculateFreight(
      makeFtlInput({
        weightKg: 10000,
        cargoValue: 1000000,
        pricingParams: {
          targetMarginPercent: 99, // impossibly high target
        },
      })
    );
    expect(result.meta.marginStatus).toBe('BELOW_TARGET');
  });
});

// ─── buildStoredBreakdown ───────────────────────────────────────────────────

describe('buildStoredBreakdown', () => {
  it('builds breakdown from calculateFreight output', () => {
    const input = makeFtlInput();
    const output = calculateFreight(input);
    const breakdown = buildStoredBreakdown(output, input);

    expect(breakdown.version).toBe('5.0-risk-aware');
    expect(breakdown.status).toBe('OK');
    expect(breakdown.calculatedAt).toBeTruthy();
    expect(breakdown.meta.routeUfLabel).toBeTruthy();
    expect(breakdown.meta.kmBandLabel).toBeTruthy();
    expect(breakdown.weights.billableWeight).toBeGreaterThan(0);
    expect(breakdown.components.baseCost).toBeGreaterThan(0);
    expect(breakdown.totals.totalCliente).toBeGreaterThan(0);
    expect(breakdown.rates.dasPercent).toBeDefined();
    expect(breakdown.rates.icmsPercent).toBeDefined();
    expect(breakdown.riskPassThrough).toBeDefined();
    expect(breakdown.riskPassThrough!.total).toBeGreaterThanOrEqual(0);
  });

  it('includes extras metadata when provided', () => {
    const input = makeFtlInput({
      extras: {
        conditionalFees: { ids: ['fee-1'], total: 100 },
        waitingTimeEnabled: true,
        waitingTimeHours: 2,
        unloadingCostItems: [{ description: 'Descarga', amount: 200 }] as any,
        equipmentRentalItems: [{ description: 'Guindaste', amount: 500 }] as any,
      },
    });
    const output = calculateFreight(input);
    const breakdown = buildStoredBreakdown(output, input);

    expect(breakdown.meta.selectedConditionalFeeIds).toEqual(['fee-1']);
    expect(breakdown.meta.waitingTimeEnabled).toBe(true);
    expect(breakdown.meta.waitingTimeHours).toBe(2);
    expect(breakdown.meta.unloadingCost).toBeDefined();
    expect(breakdown.meta.equipmentRental).toBeDefined();
  });

  it('sets icmsMode based on kmByUf', () => {
    // Mode A: no kmByUf
    const inputA = makeFtlInput();
    const outputA = calculateFreight(inputA);
    const breakdownA = buildStoredBreakdown(outputA, inputA);
    expect(breakdownA.meta.icmsMode).toBe('A');

    // Mode B: with kmByUf
    const inputB = makeFtlInput({ kmByUf: { SC: 200, SP: 400 }, icmsByUf: { SC: 12, SP: 18 } });
    const outputB = calculateFreight(inputB);
    const breakdownB = buildStoredBreakdown(outputB, inputB);
    expect(breakdownB.meta.icmsMode).toBe('B');
  });

  it('includes profitability data', () => {
    const input = makeFtlInput();
    const output = calculateFreight(input);
    const breakdown = buildStoredBreakdown(output, input);

    expect(breakdown.profitability).toBeDefined();
    expect(breakdown.profitability.resultadoLiquido).toBeDefined();
    expect(breakdown.profitability.receitaLiquida).toBeDefined();
  });
});
