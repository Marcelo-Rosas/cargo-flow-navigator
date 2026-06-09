import { describe, expect, it } from 'vitest';
import {
  buildQuoteFinancialStripFromBreakdown,
  buildQuoteFinancialStripFromCalculation,
  buildQuoteFinancialStripLegacy,
} from '@/lib/quote-financial-strip';
import type { FreightCalculationOutput, StoredPricingBreakdown } from '@/lib/freightCalculator';

function minimalOkCalculation(
  overrides: Partial<FreightCalculationOutput> = {}
): FreightCalculationOutput {
  return {
    status: 'OK',
    meta: {
      routeUfLabel: 'SP→PB',
      kmBandLabel: '2900',
      kmStatus: 'OK',
      marginStatus: 'AT_TARGET',
      marginPercent: 15,
      cubageFactor: 300,
      cubageWeightKg: 0,
      billableWeightKg: 4000,
      anttCostBaseUsed: true,
      anttFloorApplied: true,
      lotacaoPisoComOver: 22000,
      fretePesoOriginal: 5900,
    },
    components: {
      baseCost: 22000,
      baseFreight: 22000,
      toll: 1500,
      aluguelMaquinas: 0,
      gris: 200,
      tso: 0,
      rctrc: 100,
      adValorem: 50,
      tde: 0,
      tear: 0,
      dispatchFee: 0,
      conditionalFeesTotal: 0,
      waitingTimeCost: 0,
      dasProvision: 0,
    },
    rates: {
      dasPercent: 14,
      icmsPercent: 12,
      pisPercent: 0,
      cofinsPercent: 0,
      irpjPercent: 0,
      csllPercent: 0,
      grisPercent: 0,
      tsoPercent: 0,
      costValuePercent: 0,
      markupPercent: 0,
      overheadPercent: 15,
      targetMarginPercent: 15,
      profitMarginPercent: 15,
      adValoremPercent: 0,
      markupScope: 'BASE_ONLY',
    },
    totals: {
      receitaBruta: 0,
      das: 5000,
      icms: 8000,
      pis: 0,
      cofins: 0,
      irpj: 0,
      csll: 0,
      totalImpostos: 13000,
      totalCliente: 60000,
    },
    profitability: {
      custoMotorista: 22000,
      custosCarreteiro: 22000,
      custoMotoristaContratado: 22000,
      custosDescarga: 0,
      custoServicos: 2000,
      custosDiretos: 25500,
      receitaLiquida: 47000,
      margemBruta: 12000,
      overhead: 7000,
      resultadoLiquido: 3825,
      margemPercent: 15,
      profitMarginTarget: 15,
      regimeFiscal: 'simples_nacional',
    },
    conditionalFeesBreakdown: {},
    ...overrides,
  };
}

describe('quote-financial-strip', () => {
  it('builds PAG/FAT/lucro from calculation', () => {
    const strip = buildQuoteFinancialStripFromCalculation(minimalOkCalculation(), {
      modality: 'lotacao',
    });
    expect(strip).not.toBeNull();
    expect(strip!.pag.motorista).toBe(22000);
    expect(strip!.pag.anttApplied).toBe(true);
    expect(strip!.pag.tabelaReferencia).toBeUndefined();
    expect(strip!.fat.totalCliente).toBe(60000);
    expect(strip!.lucro.alvo).toBe(3825);
    expect(strip!.lucro.percentCustosDiretos).toBeCloseTo(15, 0);
  });

  it('returns null when calculation not OK', () => {
    expect(
      buildQuoteFinancialStripFromCalculation(minimalOkCalculation({ status: 'MISSING_DATA' }))
    ).toBeNull();
  });

  it('builds legacy FAT/PAG spread', () => {
    const strip = buildQuoteFinancialStripLegacy(10000, 7000);
    expect(strip.fat.totalCliente).toBe(10000);
    expect(strip.pag.motorista).toBe(7000);
    expect(strip.lucro.alvo).toBe(3000);
  });

  it('PAG lotação usa piso carreteiro, não frete contratado com over', () => {
    const strip = buildQuoteFinancialStripFromCalculation(
      minimalOkCalculation({
        meta: {
          ...minimalOkCalculation().meta!,
          anttPisoCarreteiro: 17831.67,
          lotacaoPisoComOver: 19614.84,
          antt: { total: 17831.67 },
        },
        profitability: {
          ...minimalOkCalculation().profitability!,
          custoMotoristaContratado: 19614.84,
          custoMotoristaAntt: 17831.67,
        },
      }),
      { modality: 'lotacao' }
    );
    expect(strip!.pag.motorista).toBeCloseTo(17831.67, 2);
  });

  it('PAG no breakdown não escala com faturamentoRatio (desconto comercial)', () => {
    const breakdown: StoredPricingBreakdown = {
      status: 'OK',
      meta: {
        anttCostBaseUsed: true,
        anttFloorApplied: true,
        antt: { total: 17831.67 },
        anttPisoCarreteiro: 17831.67,
        lotacaoPisoComOver: 19614.84,
      },
      components: {
        baseCost: 19614.84,
        baseFreight: 19614.84,
        toll: 871.92,
        gris: 0,
        tso: 0,
        rctrc: 124.5,
        adValorem: 124.5,
        tde: 0,
        tear: 0,
        dispatchFee: 0,
        aluguelMaquinas: 0,
        waitingTimeCost: 0,
        conditionalFeesTotal: 0,
        dasProvision: 0,
      },
      totals: {
        totalCliente: 42929.75,
        totalImpostos: 3005.08,
        discount: 17929.75,
        das: 0,
        icms: 3005.08,
        pis: 0,
        cofins: 0,
        irpj: 0,
        csll: 0,
        receitaBruta: 42929.75,
      },
      profitability: {
        custoMotoristaContratado: 19614.84,
        custoMotoristaAntt: 17831.67,
        custosCarreteiro: 19614.84,
        custoServicos: 1120.92,
        custosDiretos: 20486.76,
        receitaLiquida: 39924.67,
        margemBruta: 15232.38,
        overhead: 5988.7,
        resultadoLiquido: 6146.03,
        profitMarginTarget: 30,
      },
      rates: { profitMarginPercent: 30 },
    };
    const ratio = 25000 / 42929.75;
    const strip = buildQuoteFinancialStripFromBreakdown(breakdown, {
      totalCliente: 25000,
      discount: 17929.75,
      faturamentoRatio: ratio,
      modality: 'lotacao',
    });
    expect(strip!.pag.motorista).toBeCloseTo(17831.67, 2);
    expect(strip!.pag.pedagio).toBeCloseTo(871.92, 2);
    expect(strip!.fat.totalCliente).toBe(25000);
  });
});
