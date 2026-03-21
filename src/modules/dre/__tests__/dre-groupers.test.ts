import { describe, it, expect } from 'vitest';
import { groupByOrder, groupByTrip, groupByQuote, groupDreRows } from '../dre.groupers';
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
      totals: { totalCliente: 10000, das: 1000, icms: 0 },
      profitability: {
        receitaLiquida: 9000,
        custoMotorista: 3000,
        custosDescarga: 200,
        custosDiretos: 3700,
        overhead: 1000,
        resultadoLiquido: 4300,
      },
      components: { toll: 500 },
    },
    carreteiro_real: 3200,
    pedagio_real: 550,
    descarga_real: 250,
    ...overrides,
  };
}

describe('groupByOrder', () => {
  it('gera uma row por ordem', () => {
    const orders = [
      makeOrderInput({ id: 'o1', os_number: 'OS-001' }),
      makeOrderInput({ id: 'o2', os_number: 'OS-002' }),
    ];
    const rows = groupByOrder(orders);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.entityType).toBe('order');
  });

  it('usa os_number como label', () => {
    const rows = groupByOrder([makeOrderInput({ os_number: 'OS-123' })]);
    expect(rows[0]!.entityLabel).toBe('OS-123');
  });

  it('usa id truncado quando os_number vazio', () => {
    const rows = groupByOrder([makeOrderInput({ id: 'abcdefgh-1234', os_number: '' })]);
    expect(rows[0]!.entityLabel).toBe('abcdefgh');
  });

  it('retorna vazio para lista vazia', () => {
    expect(groupByOrder([])).toHaveLength(0);
  });
});

describe('groupByTrip', () => {
  it('agrupa ordens pela mesma trip_id', () => {
    const orders = [
      makeOrderInput({ id: 'o1', trip_id: 'trip-A', value: 5000 }),
      makeOrderInput({ id: 'o2', trip_id: 'trip-A', value: 5000 }),
    ];
    const rows = groupByTrip(orders);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.entityType).toBe('trip');
  });

  it('separa ordens de trips diferentes', () => {
    const orders = [
      makeOrderInput({ id: 'o1', trip_id: 'trip-A' }),
      makeOrderInput({ id: 'o2', trip_id: 'trip-B' }),
    ];
    const rows = groupByTrip(orders);
    expect(rows).toHaveLength(2);
  });

  it('ordem sem trip_id → avulsa', () => {
    const orders = [makeOrderInput({ id: 'o1', trip_id: null, os_number: 'OS-777' })];
    const rows = groupByTrip(orders);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.entityLabel).toContain('Avulsa');
    expect(rows[0]!.entityLabel).toContain('OS-777');
  });

  it('usa tripNumbers lookup quando disponível', () => {
    const orders = [makeOrderInput({ id: 'o1', trip_id: 'trip-A' })];
    const tripNumbers = new Map([['trip-A', 'VG-001']]);
    const rows = groupByTrip(orders, { tripNumbers });
    expect(rows[0]!.entityLabel).toBe('VG-001');
  });

  it('agrega valores de múltiplas ordens', () => {
    const orders = [
      makeOrderInput({ id: 'o1', trip_id: 'trip-A', value: 5000, carreteiro_real: 1000 }),
      makeOrderInput({ id: 'o2', trip_id: 'trip-A', value: 5000, carreteiro_real: 1500 }),
    ];
    const rows = groupByTrip(orders);
    expect(rows).toHaveLength(1);
    // Receita agregada = 10000 + 10000 = 20000 (totalCliente de cada)
    expect(rows[0]!.receitaPresumida).toBe(20000);
  });
});

describe('groupByQuote', () => {
  it('agrupa ordens pela mesma quote_id', () => {
    const orders = [
      makeOrderInput({ id: 'o1', quote_id: 'q-1' }),
      makeOrderInput({ id: 'o2', quote_id: 'q-1' }),
    ];
    const rows = groupByQuote(orders);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.entityType).toBe('quote');
  });

  it('ordem sem quote_id → sem_cotacao', () => {
    const orders = [makeOrderInput({ id: 'o1', quote_id: null, os_number: 'OS-999' })];
    const rows = groupByQuote(orders);
    expect(rows[0]!.entityLabel).toContain('OS');
    expect(rows[0]!.entityLabel).toContain('OS-999');
  });

  it('usa quoteCodes lookup quando disponível', () => {
    const orders = [makeOrderInput({ id: 'o1', quote_id: 'q-1' })];
    const quoteCodes = new Map([['q-1', 'COT-2026-001']]);
    const rows = groupByQuote(orders, { quoteCodes });
    expect(rows[0]!.entityLabel).toBe('COT-2026-001');
  });

  it('retorna vazio para lista vazia', () => {
    expect(groupByQuote([])).toHaveLength(0);
  });
});

describe('groupByTrip — aggregation edge cases', () => {
  it('agregação de 2+ ordens soma totals do breakdown', () => {
    const o1 = makeOrderInput({
      id: 'o1', trip_id: 'trip-A', value: 5000,
      carreteiro_real: 1000, pedagio_real: 200, descarga_real: 100,
      pricing_breakdown: {
        totals: { totalCliente: 5000, das: 500, icms: 0 },
        profitability: {
          receitaLiquida: 4500, custoMotorista: 1500, custosDescarga: 100,
          custosDiretos: 1800, overhead: 500, resultadoLiquido: 2200,
        },
        components: { toll: 200, aluguelMaquinas: 0 },
      },
    });
    const o2 = makeOrderInput({
      id: 'o2', trip_id: 'trip-A', value: 3000,
      carreteiro_real: 800, pedagio_real: 150, descarga_real: 50,
      pricing_breakdown: {
        totals: { totalCliente: 3000, das: 300, icms: 0 },
        profitability: {
          receitaLiquida: 2700, custoMotorista: 900, custosDescarga: 50,
          custosDiretos: 1100, overhead: 300, resultadoLiquido: 1300,
        },
        components: { toll: 150, aluguelMaquinas: 0 },
      },
    });
    const rows = groupByTrip([o1, o2]);
    expect(rows).toHaveLength(1);
    // Receita agregada
    expect(rows[0]!.receitaPresumida).toBe(8000); // 5000+3000
    // Custos reais agregados
    expect(rows[0]!.custoMotoristaReal).toBe(1800); // 1000+800
  });

  it('agregação com pricing_breakdown null mantém a estrutura', () => {
    const o1 = makeOrderInput({
      id: 'o1', trip_id: 'trip-A', value: 5000,
      pricing_breakdown: {
        totals: { totalCliente: 5000, das: 0, icms: 0 },
        profitability: { custoMotorista: 1000, custosDiretos: 1000, overhead: 0 },
        components: {},
      },
    });
    const o2 = makeOrderInput({
      id: 'o2', trip_id: 'trip-A', value: 3000,
      pricing_breakdown: null,
      carreteiro_real: null, pedagio_real: null, descarga_real: null,
    });
    // o2 tem pb=null, logo totalCliente fallback = o2.value=3000
    const rows = groupByTrip([o1, o2]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.receitaPresumida).toBe(8000);
  });

  it('trip label fallback para trip_number da primeira ordem', () => {
    const orders = [makeOrderInput({
      id: 'o1', trip_id: 'trip-X',
      trip_number: 'VG-999' as any,
    })];
    const rows = groupByTrip(orders);
    expect(rows[0]!.entityLabel).toBe('VG-999');
  });

  it('trip label fallback para id truncado quando sem trip_number', () => {
    const orders = [makeOrderInput({
      id: 'o1', trip_id: 'abcdefgh-long-id',
      trip_number: undefined as any,
    })];
    // Sem tripNumbers map e sem trip_number → slice(0,8)
    const rows = groupByTrip(orders);
    expect(rows[0]!.entityLabel).toBe('abcdefgh');
  });
});

describe('groupByTrip — label edge cases', () => {
  it('avulsa com os_number vazio', () => {
    const orders = [makeOrderInput({ id: 'o1', trip_id: null, os_number: '' })];
    const rows = groupByTrip(orders);
    expect(rows[0]!.entityLabel).toContain('Avulsa');
  });

  it('trip com tripNumbers mas id não encontrado → fallback trip_number', () => {
    const orders = [makeOrderInput({
      id: 'o1', trip_id: 'trip-NOT-IN-MAP',
      trip_number: 'VG-FALLBACK' as any,
    })];
    const tripNumbers = new Map([['trip-OTHER', 'VG-001']]);
    const rows = groupByTrip(orders, { tripNumbers });
    expect(rows[0]!.entityLabel).toBe('VG-FALLBACK');
  });
});

describe('groupByQuote — edge cases', () => {
  it('quote label fallback para quote_code da ordem', () => {
    const orders = [makeOrderInput({
      id: 'o1', quote_id: 'q-xyz',
      quote_code: 'COT-2026-ABC' as any,
    })];
    const rows = groupByQuote(orders);
    expect(rows[0]!.entityLabel).toBe('COT-2026-ABC');
  });

  it('quote label fallback para id truncado sem quote_code', () => {
    const orders = [makeOrderInput({
      id: 'o1', quote_id: 'abcdefgh-long-id',
      quote_code: undefined as any,
    })];
    const rows = groupByQuote(orders);
    expect(rows[0]!.entityLabel).toBe('abcdefgh');
  });
});

describe('groupDreRows dispatcher', () => {
  const orders = [makeOrderInput()];

  it('groupBy=order → groupByOrder', () => {
    const rows = groupDreRows(orders, 'order');
    expect(rows[0]!.entityType).toBe('order');
  });

  it('groupBy=trip → groupByTrip', () => {
    const rows = groupDreRows(orders, 'trip');
    expect(rows[0]!.entityType).toBe('trip');
  });

  it('groupBy=quote → groupByQuote', () => {
    const rows = groupDreRows(orders, 'quote');
    expect(rows[0]!.entityType).toBe('quote');
  });

  it('groupBy desconhecido → fallback groupByOrder', () => {
    const rows = groupDreRows(orders, 'unknown' as any);
    expect(rows[0]!.entityType).toBe('order');
  });
});
