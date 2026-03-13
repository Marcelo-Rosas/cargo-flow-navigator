/**
 * Teste unitário da DRE Operacional Comparativa (sem runner externo).
 *
 * Execução:
 *   npx tsx tests/dre-operacional.test.ts
 */

import { buildDreTables, consolidateDreTables } from '../src/modules/dre';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${(err as Error).message}`);
    failed++;
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
      }
    },
    toBeCloseTo(expected: number, precision = 2) {
      const f = Math.pow(10, precision);
      const a = Math.round((actual as unknown as number) * f) / f;
      const e = Math.round(expected * f) / f;
      if (a !== e) {
        throw new Error(`Expected ${e}, received ${a}`);
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, received ${String(actual)}`);
    },
  };
}

function rowByCode(rows: Array<{ line_code: string }>, code: string): (typeof rows)[number] {
  const row = rows.find((r) => r.line_code === code);
  if (!row) throw new Error(`Missing line ${code}`);
  return row;
}

console.log('\nDRE operacional — detalhado e consolidado');

const QUOTE_WITH_OS_ID = 'q-1';
const QUOTE_ONLY_ID = 'q-2';

const tables = buildDreTables({
  quotes: [
    {
      id: QUOTE_WITH_OS_ID,
      quote_code: 'COT-2026-03-0001',
      created_at: '2026-03-05T10:00:00.000Z',
      value: 1000,
      pricing_breakdown: {
        totals: { totalCliente: 1000, das: 50, icms: 80 },
        profitability: {
          overhead: 100,
          custosCarreteiro: 300,
          custosDescarga: 30,
          resultadoLiquido: 400, // propositalmente divergente
        },
        components: {
          toll: 20,
          waitingTimeCost: 10,
          conditionalFeesTotal: 5,
          aluguelMaquinas: 15,
        },
        rates: { dasPercent: 5, icmsPercent: 8, overheadPercent: 10 },
      } as Record<string, unknown>,
    },
    {
      id: QUOTE_ONLY_ID,
      quote_code: 'COT-2026-03-0002',
      created_at: '2026-03-10T10:00:00.000Z',
      value: 500,
      pricing_breakdown: {
        totals: { totalCliente: 500, das: 25, icms: 40 },
        profitability: {
          overhead: 50,
          custosCarreteiro: 150,
          custosDescarga: 10,
          resultadoLiquido: 200,
        },
        components: { toll: 5, waitingTimeCost: 0, conditionalFeesTotal: 0 },
      } as Record<string, unknown>,
    },
  ],
  orders: [
    {
      id: 'o-1',
      os_number: 'OS-2026-03-0001',
      quote_id: QUOTE_WITH_OS_ID,
      value: 1200,
      created_at: '2026-03-07T10:00:00.000Z',
      pricing_breakdown: null,
      quote_code: 'COT-2026-03-0001',
      quote_created_at: '2026-03-05T10:00:00.000Z',
      quote_value: 1000,
      quote_pricing_breakdown: {
        totals: { totalCliente: 1000, das: 50, icms: 80 },
        profitability: {
          overhead: 100,
          custosCarreteiro: 300,
          custosDescarga: 30,
          resultadoLiquido: 400,
        },
        components: { toll: 20, waitingTimeCost: 10, conditionalFeesTotal: 5, aluguelMaquinas: 15 },
        rates: { dasPercent: 5, icmsPercent: 8, overheadPercent: 10 },
      } as Record<string, unknown>,
      carreteiro_real: 380,
      pedagio_real: 40,
      descarga_real: 45,
      waiting_time_cost: 8,
    },
  ],
  tripCostItemsByOrderId: new Map([
    [
      'o-1',
      [
        { order_id: 'o-1', scope: 'OS', category: 'conditional_fee', amount: 20 },
        { order_id: 'o-1', scope: 'OS', category: 'misc', amount: 10 },
      ],
    ],
  ]),
  grisByOrderId: new Map([['o-1', 12]]),
  riskByOrderId: new Map([['o-1', 6]]),
});

test('gera detalhe com COT/OS e COT sem OS', () => {
  expect(tables.length).toBe(2);
  const withOs = tables.find((t) => t.os_number === 'OS-2026-03-0001');
  const withoutOs = tables.find((t) => t.quote_code === 'COT-2026-03-0002');
  expect(!!withOs).toBeTruthy();
  expect(!!withoutOs).toBeTruthy();
  expect(withoutOs?.status).toBe('sem_os_vinculada');
});

test('mantém ordem obrigatória das 15 linhas', () => {
  const withOs = tables.find((t) => t.os_number === 'OS-2026-03-0001');
  const order = withOs!.rows.map((r) => r.line_code);
  expect(order.join(',')).toBe(
    [
      'faturamento_bruto',
      'impostos',
      'das',
      'icms',
      'receita_liquida',
      'overhead',
      'custos_diretos',
      'custo_motorista',
      'pedagio',
      'carga_descarga',
      'espera',
      'taxas_condicionais',
      'outros_custos',
      'resultado_liquido',
      'margem_liquida',
    ].join(',')
  );
});

test('resultado e margem seguem fórmula contábil', () => {
  const withOs = tables.find((t) => t.os_number === 'OS-2026-03-0001')!;
  const faturamento = rowByCode(withOs.rows, 'faturamento_bruto');
  const receita = rowByCode(withOs.rows, 'receita_liquida');
  const overhead = rowByCode(withOs.rows, 'overhead');
  const custosDiretos = rowByCode(withOs.rows, 'custos_diretos');
  const resultado = rowByCode(withOs.rows, 'resultado_liquido');
  const margem = rowByCode(withOs.rows, 'margem_liquida');

  expect(resultado.presumed_value).toBeCloseTo(
    receita.presumed_value - overhead.presumed_value - custosDiretos.presumed_value
  );
  expect(resultado.real_value).toBeCloseTo(
    receita.real_value - overhead.real_value - custosDiretos.real_value
  );
  expect(margem.presumed_value).toBeCloseTo(
    (resultado.presumed_value / faturamento.presumed_value) * 100
  );
  expect(margem.real_value).toBeCloseTo((resultado.real_value / faturamento.real_value) * 100);
});

test('custos diretos batem com soma das sublinhas', () => {
  const withOs = tables.find((t) => t.os_number === 'OS-2026-03-0001')!;
  const custosDiretos = rowByCode(withOs.rows, 'custos_diretos');
  const sumPresumed =
    rowByCode(withOs.rows, 'custo_motorista').presumed_value +
    rowByCode(withOs.rows, 'pedagio').presumed_value +
    rowByCode(withOs.rows, 'carga_descarga').presumed_value +
    rowByCode(withOs.rows, 'espera').presumed_value +
    rowByCode(withOs.rows, 'taxas_condicionais').presumed_value +
    rowByCode(withOs.rows, 'outros_custos').presumed_value;
  const sumReal =
    rowByCode(withOs.rows, 'custo_motorista').real_value +
    rowByCode(withOs.rows, 'pedagio').real_value +
    rowByCode(withOs.rows, 'carga_descarga').real_value +
    rowByCode(withOs.rows, 'espera').real_value +
    rowByCode(withOs.rows, 'taxas_condicionais').real_value +
    rowByCode(withOs.rows, 'outros_custos').real_value;
  expect(custosDiretos.presumed_value).toBeCloseTo(sumPresumed);
  expect(custosDiretos.real_value).toBeCloseTo(sumReal);
});

test('badge respeita semântica de linha negativa (pedágio maior = vermelho ↑)', () => {
  const withOs = tables.find((t) => t.os_number === 'OS-2026-03-0001')!;
  const pedagio = rowByCode(withOs.rows, 'pedagio');
  expect(pedagio.real_value > pedagio.presumed_value).toBeTruthy();
  expect(pedagio.badge_color).toBe('red');
  expect(pedagio.badge_direction).toBe('up');
});

test('consolidado mensal preserva a mesma estrutura de linhas', () => {
  const monthly = consolidateDreTables(tables, 'month');
  expect(monthly.length).toBe(1);
  expect(monthly[0]!.rows.length).toBe(15);
  expect(monthly[0]!.rows[0]!.line_code).toBe('faturamento_bruto');
  expect(monthly[0]!.rows[14]!.line_code).toBe('margem_liquida');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
