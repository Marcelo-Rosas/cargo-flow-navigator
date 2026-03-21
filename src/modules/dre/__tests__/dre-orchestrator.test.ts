import { describe, it, expect } from 'vitest';
import { buildDreTables, type OrderForDre, type QuoteForDre } from '../dre.orchestrator';

function makeOrder(overrides?: Partial<OrderForDre>): OrderForDre {
  return {
    id: 'order-1',
    os_number: 'OS-001',
    quote_id: 'quote-1',
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
      },
      components: { toll: 500 },
    },
    carreteiro_real: 3200,
    pedagio_real: 550,
    descarga_real: 250,
    waiting_time_cost: 100,
    ...overrides,
  };
}

function makeQuote(overrides?: Partial<QuoteForDre>): QuoteForDre {
  return {
    id: 'quote-1',
    quote_code: 'COT-001',
    created_at: '2026-01-10',
    value: 10000,
    pricing_breakdown: {
      totals: { totalCliente: 10000, das: 1400, icms: 0 },
      profitability: {
        receitaLiquida: 8600,
        custoMotorista: 3000,
        custosDescarga: 200,
        custosDiretos: 3700,
        overhead: 1290,
        resultadoLiquido: 3610,
      },
      components: { toll: 500 },
    },
    ...overrides,
  };
}

describe('buildDreTables', () => {
  it('happy path: 1 order + 1 quote → 1 tabela', () => {
    const tables = buildDreTables({
      orders: [makeOrder()],
      quotes: [makeQuote()],
    });
    expect(tables).toHaveLength(1);
    expect(tables[0]!.os_number).toBe('OS-001');
    expect(tables[0]!.quote_code).toBe('COT-001');
    expect(tables[0]!.status).toBe('ok');
    expect(tables[0]!.rows.length).toBeGreaterThan(0);
  });

  it('order com value <= 0 é ignorada', () => {
    const tables = buildDreTables({
      orders: [makeOrder({ value: 0 })],
      quotes: [makeQuote()],
    });
    // Order ignorada + quote sem OS → gera tabela "sem_os_vinculada"
    expect(tables).toHaveLength(1);
    expect(tables[0]!.status).toBe('sem_os_vinculada');
  });

  it('order com value negativo é ignorada', () => {
    const tables = buildDreTables({
      orders: [makeOrder({ value: -100 })],
      quotes: [makeQuote()],
    });
    expect(tables.filter((t) => t.status === 'ok')).toHaveLength(0);
  });

  it('quote sem OS vinculada → status sem_os_vinculada com badge neutro', () => {
    const tables = buildDreTables({
      orders: [],
      quotes: [makeQuote({ id: 'quote-orphan', quote_code: 'COT-ORPHAN' })],
    });
    expect(tables).toHaveLength(1);
    expect(tables[0]!.status).toBe('sem_os_vinculada');
    expect(tables[0]!.period_key).toContain('COT-ORPHAN');
    // Badge deve ser neutro para todas as linhas
    for (const row of tables[0]!.rows) {
      expect(row.badge_direction).toBe('neutral');
      expect(row.badge_color).toBe('neutral');
    }
  });

  it('usa pricing_breakdown da quote quando disponível', () => {
    const quoteBreakdown = {
      totals: { totalCliente: 12000, das: 1500, icms: 0 },
      profitability: {
        receitaLiquida: 10500,
        custoMotorista: 4000,
        custosDiretos: 4500,
        overhead: 1500,
        resultadoLiquido: 4500,
      },
      components: { toll: 500 },
    };
    const tables = buildDreTables({
      orders: [makeOrder({ quote_id: 'q-1' })],
      quotes: [makeQuote({ id: 'q-1', pricing_breakdown: quoteBreakdown, value: 12000 })],
    });
    const fat = tables[0]!.rows.find((r) => r.line_code === 'faturamento_bruto')!;
    expect(fat.presumed_value).toBe(12000);
  });

  it('fallback para order.pricing_breakdown quando quote não encontrada', () => {
    const tables = buildDreTables({
      orders: [makeOrder({ quote_id: 'non-existent' })],
      quotes: [],
    });
    expect(tables).toHaveLength(1);
    const fat = tables[0]!.rows.find((r) => r.line_code === 'faturamento_bruto')!;
    expect(fat.presumed_value).toBe(10000);
  });

  it('period_key inclui quote_code e os_number', () => {
    const tables = buildDreTables({
      orders: [makeOrder()],
      quotes: [makeQuote()],
    });
    expect(tables[0]!.period_key).toContain('COT-001');
    expect(tables[0]!.period_key).toContain('OS-001');
  });

  it('ordena tabelas por reference_date', () => {
    const tables = buildDreTables({
      orders: [
        makeOrder({ id: 'o1', os_number: 'OS-002', created_at: '2026-03-01', quote_id: null }),
        makeOrder({ id: 'o2', os_number: 'OS-001', created_at: '2026-01-01', quote_id: null }),
      ],
      quotes: [],
    });
    expect(tables[0]!.os_number).toBe('OS-001');
    expect(tables[1]!.os_number).toBe('OS-002');
  });

  it('inclui tripCostItems, gris e risk quando fornecidos', () => {
    const tripCostItems = new Map([
      [
        'order-1',
        [
          { order_id: 'order-1', scope: 'OS', category: 'condicional', amount: 200 },
        ],
      ],
    ]);
    const grisByOrderId = new Map([['order-1', 150]]);
    const riskByOrderId = new Map([['order-1', 50]]);

    const tables = buildDreTables({
      orders: [makeOrder()],
      quotes: [makeQuote()],
      tripCostItemsByOrderId: tripCostItems,
      grisByOrderId,
      riskByOrderId,
    });

    const taxas = tables[0]!.rows.find((r) => r.line_code === 'taxas_condicionais')!;
    expect(taxas.real_value).toBe(200);
    const outros = tables[0]!.rows.find((r) => r.line_code === 'outros_custos')!;
    expect(outros.real_value).toBe(200); // gris(150) + risk(50) + outrosTripCosts(0)
  });

  it('cada tabela tem 15 linhas DRE', () => {
    const tables = buildDreTables({
      orders: [makeOrder()],
      quotes: [makeQuote()],
    });
    expect(tables[0]!.rows).toHaveLength(15);
  });

  it('múltiplas orders com mesma quote → quote não duplicada em sem_os', () => {
    const tables = buildDreTables({
      orders: [
        makeOrder({ id: 'o1', quote_id: 'q-1' }),
        makeOrder({ id: 'o2', os_number: 'OS-002', quote_id: 'q-1' }),
      ],
      quotes: [makeQuote({ id: 'q-1' })],
    });
    // 2 tabelas OK, 0 sem_os (a quote tem OS vinculada)
    expect(tables.filter((t) => t.status === 'ok')).toHaveLength(2);
    expect(tables.filter((t) => t.status === 'sem_os_vinculada')).toHaveLength(0);
  });
});
