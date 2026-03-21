import { describe, it, expect } from 'vitest';
import { computeRealFromOrder, type OrderForDreReal, type TripCostItemForDre } from '../dre.real';

function makeOrder(overrides?: Partial<OrderForDreReal>): OrderForDreReal {
  return {
    id: 'order-1',
    value: 10000,
    pricing_breakdown: {
      rates: { dasPercent: 14, icmsPercent: 6 },
      profitability: { overhead: 800 },
      rates_extra: {},
    },
    carreteiro_real: 3000,
    pedagio_real: 500,
    descarga_real: 200,
    waiting_time_cost: 100,
    ...overrides,
  };
}

describe('computeRealFromOrder', () => {
  it('happy path: calcula todas as linhas corretamente', () => {
    const { values } = computeRealFromOrder({ order: makeOrder() });

    expect(values.get('faturamento_bruto')).toBe(10000);
    expect(values.get('das')).toBe(1400); // 10000 * 14%
    expect(values.get('icms')).toBe(600); // 10000 * 6%
    expect(values.get('impostos')).toBe(2000);
    expect(values.get('receita_liquida')).toBe(8000);
    expect(values.get('custo_motorista')).toBe(3000);
    expect(values.get('pedagio')).toBe(500);
    expect(values.get('carga_descarga')).toBe(200);
    expect(values.get('espera')).toBe(100);
  });

  it('calcula impostos proporcionais com DAS e ICMS', () => {
    const order = makeOrder({
      value: 20000,
      pricing_breakdown: { rates: { dasPercent: 10, icmsPercent: 12 } },
    });
    const { values } = computeRealFromOrder({ order });
    expect(values.get('das')).toBe(2000);
    expect(values.get('icms')).toBe(2400);
  });

  it('DAS = 0 e ICMS = 0 quando rates ausentes', () => {
    const order = makeOrder({ pricing_breakdown: {} });
    const { values } = computeRealFromOrder({ order });
    expect(values.get('das')).toBe(0);
    expect(values.get('icms')).toBe(0);
  });

  it('DAS = 0 e ICMS = 0 quando breakdown null', () => {
    const order = makeOrder({ pricing_breakdown: null });
    const { values } = computeRealFromOrder({ order });
    expect(values.get('das')).toBe(0);
    expect(values.get('icms')).toBe(0);
  });

  it('overhead via overheadPercent quando > 0', () => {
    const order = makeOrder({
      pricing_breakdown: {
        rates: { dasPercent: 0, icmsPercent: 0, overheadPercent: 15 },
        profitability: { overhead: 999 },
      },
    });
    const { values } = computeRealFromOrder({ order });
    // receita_liquida = 10000, overhead = 10000 * 15% = 1500
    expect(values.get('overhead')).toBe(1500);
  });

  it('overhead fallback para overheadPresumido quando overheadPercent = 0', () => {
    const order = makeOrder({
      pricing_breakdown: {
        rates: { dasPercent: 0, icmsPercent: 0, overheadPercent: 0 },
        profitability: { overhead: 750 },
      },
    });
    const { values } = computeRealFromOrder({ order });
    expect(values.get('overhead')).toBe(750);
  });

  it('overhead = 0 quando ambos ausentes', () => {
    const order = makeOrder({ pricing_breakdown: {} });
    const { values } = computeRealFromOrder({ order });
    expect(values.get('overhead')).toBe(0);
  });

  it('campos nulos → entram em absentFields', () => {
    const order = makeOrder({
      carreteiro_real: null,
      pedagio_real: null,
      descarga_real: null,
      waiting_time_cost: null,
    });
    const { absentFields, values } = computeRealFromOrder({ order });
    expect(absentFields.has('custo_motorista')).toBe(true);
    expect(absentFields.has('pedagio')).toBe(true);
    expect(absentFields.has('carga_descarga')).toBe(true);
    expect(absentFields.has('espera')).toBe(true);
    // Valores devem ser 0
    expect(values.get('custo_motorista')).toBe(0);
    expect(values.get('pedagio')).toBe(0);
  });

  it('campo = 0 (não nulo) NÃO entra em absentFields', () => {
    const order = makeOrder({
      carreteiro_real: 0,
      pedagio_real: 0,
      descarga_real: 0,
      waiting_time_cost: 0,
    });
    const { absentFields } = computeRealFromOrder({ order });
    expect(absentFields.size).toBe(0);
  });

  it('trip cost items com scope=OS são incluídos', () => {
    const items: TripCostItemForDre[] = [
      { order_id: 'order-1', scope: 'OS', category: 'condicional', amount: 300 },
      { order_id: 'order-1', scope: 'OS', category: 'outros', amount: 150 },
    ];
    const { values } = computeRealFromOrder({ order: makeOrder(), tripCostItems: items });
    expect(values.get('taxas_condicionais')).toBe(300);
    expect(values.get('outros_custos')).toBe(150); // gris(0) + risk(0) + outros(150)
  });

  it('trip cost items com scope != OS são ignorados', () => {
    const items: TripCostItemForDre[] = [
      { order_id: 'order-1', scope: 'TRIP', category: 'condicional', amount: 999 },
    ];
    const { values } = computeRealFromOrder({ order: makeOrder(), tripCostItems: items });
    expect(values.get('taxas_condicionais')).toBe(0);
  });

  it('trip cost items de outra order são ignorados', () => {
    const items: TripCostItemForDre[] = [
      { order_id: 'order-2', scope: 'OS', category: 'condicional', amount: 999 },
    ];
    const { values } = computeRealFromOrder({ order: makeOrder(), tripCostItems: items });
    expect(values.get('taxas_condicionais')).toBe(0);
  });

  it('categorias carreteiro/pedagio/descarga/espera são ignoradas nos tripCostItems', () => {
    const items: TripCostItemForDre[] = [
      { order_id: 'order-1', scope: 'OS', category: 'carreteiro', amount: 999 },
      { order_id: 'order-1', scope: 'OS', category: 'pedagio', amount: 888 },
      { order_id: 'order-1', scope: 'OS', category: 'descarga', amount: 777 },
      { order_id: 'order-1', scope: 'OS', category: 'espera', amount: 666 },
    ];
    const { values } = computeRealFromOrder({ order: makeOrder(), tripCostItems: items });
    expect(values.get('outros_custos')).toBe(0);
  });

  it('inclui grisAmountReal e riskCostAmount em outros_custos', () => {
    const { values } = computeRealFromOrder({
      order: makeOrder(),
      grisAmountReal: 200,
      riskCostAmount: 100,
    });
    expect(values.get('outros_custos')).toBe(300);
  });

  it('custos_diretos = soma de todas sublinhas', () => {
    const { values } = computeRealFromOrder({
      order: makeOrder(),
      grisAmountReal: 50,
    });
    const expected =
      values.get('custo_motorista')! +
      values.get('pedagio')! +
      values.get('carga_descarga')! +
      values.get('espera')! +
      values.get('taxas_condicionais')! +
      values.get('outros_custos')!;
    expect(values.get('custos_diretos')).toBe(Math.round(expected * 100) / 100);
  });

  it('resultado_liquido = receita - overhead - custos', () => {
    const { values } = computeRealFromOrder({ order: makeOrder() });
    const expected =
      values.get('receita_liquida')! - values.get('overhead')! - values.get('custos_diretos')!;
    expect(values.get('resultado_liquido')).toBe(Math.round(expected * 100) / 100);
  });

  it('margem = 0 quando faturamento = 0', () => {
    const order = makeOrder({ value: 0, pricing_breakdown: null });
    const { values } = computeRealFromOrder({ order });
    expect(values.get('margem_liquida')).toBe(0);
  });

  it('margem calcula percentual sobre faturamento', () => {
    const { values } = computeRealFromOrder({ order: makeOrder() });
    const resultado = values.get('resultado_liquido')!;
    const fat = values.get('faturamento_bruto')!;
    expect(values.get('margem_liquida')).toBe(Math.round((resultado / fat) * 100 * 100) / 100);
  });
});
