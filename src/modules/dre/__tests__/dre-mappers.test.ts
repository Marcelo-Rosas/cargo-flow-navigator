import { describe, it, expect } from 'vitest';
import { mapOrderToDreRow } from '../dre.mappers';
import type { OrderDreInput } from '../dre.types';

function makeOrderInput(overrides?: Partial<OrderDreInput>): OrderDreInput {
  return {
    id: 'order-1',
    os_number: 'OS-001',
    quote_id: 'quote-1',
    trip_id: 'trip-1',
    value: 10000,
    created_at: '2026-01-15',
    pricing_breakdown: {
      totals: { totalCliente: 10000, das: 1400, icms: 0 },
      profitability: {
        receitaLiquida: 8600,
        custoMotorista: 3000,
        custosDescarga: 200,
        custosDiretos: 3700,
        overhead: 1290,
        resultadoLiquido: 3610,
        margemPercent: 36.1,
      },
      components: { toll: 500, aluguelMaquinas: 0 },
    },
    carreteiro_real: 3200,
    pedagio_real: 550,
    descarga_real: 250,
    ...overrides,
  };
}

describe('mapOrderToDreRow', () => {
  it('retorna null se pricing_breakdown for null', () => {
    const result = mapOrderToDreRow(makeOrderInput({ pricing_breakdown: null }), 'OS-001', 'order');
    expect(result).toBeNull();
  });

  it('retorna null se value <= 0', () => {
    const result = mapOrderToDreRow(makeOrderInput({ value: 0 }), 'OS-001', 'order');
    expect(result).toBeNull();
  });

  it('happy path: mapeia ordem com breakdown completo', () => {
    const result = mapOrderToDreRow(makeOrderInput(), 'OS-001', 'order')!;
    expect(result).not.toBeNull();
    expect(result.entityLabel).toBe('OS-001');
    expect(result.entityType).toBe('order');
    expect(result.receitaPresumida).toBe(10000);
    expect(result.dasPresumido).toBe(1400);
    expect(result.icmsPresumido).toBe(0);
    expect(result.receitaLiquidaPresumida).toBe(8600);
    expect(result.custoMotoristaPresumido).toBe(3000);
    expect(result.pedagioPresumido).toBe(500);
    expect(result.descargaPresumida).toBe(200);
    expect(result.overheadPresumido).toBe(1290);
  });

  it('usa carreteiro_real, pedagio_real, descarga_real para custos reais', () => {
    const result = mapOrderToDreRow(makeOrderInput(), 'OS-001', 'order')!;
    expect(result.custoMotoristaReal).toBe(3200);
    expect(result.pedagioReal).toBe(550);
    expect(result.descargaReal).toBe(250);
  });

  it('quando carreteiro_real = null, usa presumido como fallback', () => {
    const result = mapOrderToDreRow(
      makeOrderInput({ carreteiro_real: null, pedagio_real: null, descarga_real: null }),
      'label',
      'order'
    )!;
    expect(result.custoMotoristaReal).toBe(result.custoMotoristaPresumido);
    expect(result.pedagioReal).toBe(result.pedagioPresumido);
    expect(result.descargaReal).toBe(result.descargaPresumida);
  });

  it('calcula custosDiretosReais e resultadoReal', () => {
    const result = mapOrderToDreRow(makeOrderInput(), 'OS-001', 'order')!;
    // custosDiretosReais = 3200 + 550 + 0 + 250 + 0 = 4000
    expect(result.custosDiretosReais).toBe(4000);
    // resultado = receitaLiquida(8600) - custos(4000) - overhead(1290) = 3310
    expect(result.resultadoReal).toBe(3310);
  });

  it('calcula deltaResultado e deltaPercent', () => {
    const result = mapOrderToDreRow(makeOrderInput(), 'OS-001', 'order')!;
    expect(result.deltaResultado).toBe(result.resultadoReal - result.resultadoPresumido);
    // delta negativo = custos reais maiores
    expect(result.deltaResultado).toBeLessThan(0);
  });

  it('entityId para order = order.id', () => {
    const result = mapOrderToDreRow(makeOrderInput(), 'OS-001', 'order')!;
    expect(result.entityId).toBe('order-1');
  });

  it('entityId para trip = trip_id', () => {
    const result = mapOrderToDreRow(makeOrderInput(), 'Trip-1', 'trip')!;
    expect(result.entityId).toBe('trip-1');
  });

  it('entityId para quote = quote_id', () => {
    const result = mapOrderToDreRow(makeOrderInput(), 'Q-1', 'quote')!;
    expect(result.entityId).toBe('quote-1');
  });

  it('entityId trip fallback para order.id quando trip_id null', () => {
    const result = mapOrderToDreRow(makeOrderInput({ trip_id: null }), 'label', 'trip')!;
    expect(result.entityId).toBe('order-1');
  });

  it('usa order.value como fallback quando totalCliente ausente', () => {
    const result = mapOrderToDreRow(
      makeOrderInput({
        value: 7000,
        pricing_breakdown: {
          totals: { das: 0, icms: 0 },
          profitability: { custoMotorista: 1000, custosDiretos: 1000, overhead: 0 },
          components: {},
        },
      }),
      'label',
      'order'
    )!;
    expect(result.receitaPresumida).toBe(7000);
  });

  it('receita e overhead reais = presumidos (fixos)', () => {
    const result = mapOrderToDreRow(makeOrderInput(), 'OS-001', 'order')!;
    expect(result.receitaReal).toBe(result.receitaPresumida);
    expect(result.dasReal).toBe(result.dasPresumido);
    expect(result.icmsReal).toBe(result.icmsPresumido);
    expect(result.receitaLiquidaReal).toBe(result.receitaLiquidaPresumida);
    expect(result.overheadReal).toBe(result.overheadPresumido);
  });

  it('calcula custosDiretos do breakdown quando profitability.custosDiretos existe', () => {
    const result = mapOrderToDreRow(makeOrderInput(), 'OS-001', 'order')!;
    // custosDiretos = profitability.custosDiretos = 3700
    expect(result.custosDiretosPresumidos).toBe(3700);
  });

  it('calcula custosDiretos como soma quando profitability.custosDiretos = 0', () => {
    const order = makeOrderInput({
      pricing_breakdown: {
        totals: { totalCliente: 10000, das: 0, icms: 0 },
        profitability: {
          receitaLiquida: 10000,
          custoMotorista: 2000,
          custosDescarga: 300,
          custosDiretos: 0, // falsy → recalcula
          overhead: 500,
          resultadoLiquido: 7200,
        },
        components: { toll: 400 },
      },
    });
    const result = mapOrderToDreRow(order, 'label', 'order')!;
    // Soma: 2000 + 400 + 0 + 300 + 0 = 2700
    expect(result.custosDiretosPresumidos).toBe(2700);
  });

  it('receitaLiquida vem do breakdown quando presente', () => {
    const result = mapOrderToDreRow(makeOrderInput(), 'label', 'order')!;
    expect(result.receitaLiquidaPresumida).toBe(8600);
  });

  it('receitaLiquida = 0 quando ausente (numFallback retorna 0)', () => {
    const order = makeOrderInput({
      pricing_breakdown: {
        totals: { totalCliente: 8000, das: 500, icms: 200 },
        profitability: {
          custoMotorista: 2000, custosDiretos: 2000, overhead: 500,
        },
        components: {},
      },
    });
    const result = mapOrderToDreRow(order, 'label', 'order')!;
    // numFallback retorna 0 pois receitaLiquida ausente; ?? não triggered pois 0 não é nullish
    expect(result.receitaLiquidaPresumida).toBe(0);
  });

  it('resultadoLiquido e margemPercent vêm do breakdown quando presentes', () => {
    const result = mapOrderToDreRow(makeOrderInput(), 'label', 'order')!;
    expect(result.resultadoPresumido).toBe(3610);
    expect(result.margemPresumidaPercent).toBe(36.1);
  });

  it('legacy breakdown sem profitability data: usa carreteiro_real como presumido', () => {
    const result = mapOrderToDreRow(
      makeOrderInput({
        carreteiro_real: 2500,
        pedagio_real: 400,
        descarga_real: 100,
        pricing_breakdown: {
          totals: { totalCliente: 8000, das: 500, icms: 0 },
          profitability: { receitaLiquida: 7500, overhead: 300 },
          components: {},
        },
      }),
      'label',
      'order'
    )!;
    // Sem profitability data (custosDiretos/custoMotorista) → usa carreteiro_real como presumido
    expect(result.custoMotoristaPresumido).toBe(2500);
    expect(result.pedagioPresumido).toBe(400);
    expect(result.descargaPresumida).toBe(100);
  });

  it('hasProfitabilityData detecta custos_diretos snake_case', () => {
    const result = mapOrderToDreRow(
      makeOrderInput({
        pricing_breakdown: {
          totals: { totalCliente: 5000, das: 0, icms: 0 },
          profitability: { custos_diretos: 2000, overhead: 0 } as any,
          components: {},
        },
      }),
      'label',
      'order'
    )!;
    expect(result).not.toBeNull();
  });

  it('hasProfitabilityData detecta custos_carreteiro snake_case', () => {
    const result = mapOrderToDreRow(
      makeOrderInput({
        pricing_breakdown: {
          totals: { totalCliente: 5000, das: 0, icms: 0 },
          profitability: { custos_carreteiro: 1500, overhead: 0 } as any,
          components: {},
        },
      }),
      'label',
      'order'
    )!;
    expect(result).not.toBeNull();
  });

  it('hasProfitabilityData detecta custo_motorista snake_case', () => {
    const result = mapOrderToDreRow(
      makeOrderInput({
        pricing_breakdown: {
          totals: { totalCliente: 5000, das: 0, icms: 0 },
          profitability: { custo_motorista: 1500, overhead: 0 } as any,
          components: {},
        },
      }),
      'label',
      'order'
    )!;
    expect(result).not.toBeNull();
  });

  it('hasProfitabilityData detecta custosCarreteiro camelCase', () => {
    const result = mapOrderToDreRow(
      makeOrderInput({
        pricing_breakdown: {
          totals: { totalCliente: 5000, das: 0, icms: 0 },
          profitability: { custosCarreteiro: 1500, overhead: 0 },
          components: {},
        },
      }),
      'label',
      'order'
    )!;
    expect(result).not.toBeNull();
    // hasPb = true → custoMotoristaPresumido from breakdown
    expect(result.custoMotoristaPresumido).toBe(1500);
  });

  it('profitability null → hasPb false', () => {
    const result = mapOrderToDreRow(
      makeOrderInput({
        carreteiro_real: 1000,
        pedagio_real: 200,
        descarga_real: 50,
        pricing_breakdown: {
          totals: { totalCliente: 5000, das: 0, icms: 0 },
          components: {},
        } as any,
      }),
      'label',
      'order'
    )!;
    // hasPb=false → usa carreteiro_real
    expect(result.custoMotoristaPresumido).toBe(1000);
    expect(result.pedagioPresumido).toBe(200);
    expect(result.descargaPresumida).toBe(50);
  });

  it('custoMotorista = 0 faz fallback para custosCarreteiro via ||', () => {
    const result = mapOrderToDreRow(
      makeOrderInput({
        pricing_breakdown: {
          totals: { totalCliente: 5000, das: 0, icms: 0 },
          profitability: {
            custoMotorista: 0, custosCarreteiro: 1200,
            custosDiretos: 1200, overhead: 0,
            resultadoLiquido: 3800,
          },
          components: {},
        },
      }),
      'label',
      'order'
    )!;
    expect(result.custoMotoristaPresumido).toBe(1200);
  });

  it('custosDiretosPresumidos: sem profitability data calcula sem maoDeObra', () => {
    const result = mapOrderToDreRow(
      makeOrderInput({
        carreteiro_real: 2000,
        pedagio_real: 300,
        descarga_real: 100,
        pricing_breakdown: {
          totals: { totalCliente: 8000, das: 0, icms: 0 },
          profitability: { overhead: 500 },
          components: {},
        },
      }),
      'label',
      'order'
    )!;
    // hasPb=false: custosDiretos = carreteiro(2000) + pedagio(300) + aluguel(0) + descarga(100)
    expect(result.custosDiretosPresumidos).toBe(2400);
  });

  it('value negativo retorna null', () => {
    const result = mapOrderToDreRow(makeOrderInput({ value: -100 }), 'label', 'order');
    expect(result).toBeNull();
  });
});
