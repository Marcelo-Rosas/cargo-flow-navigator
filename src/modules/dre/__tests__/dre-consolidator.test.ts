import { describe, it, expect } from 'vitest';
import { consolidateDreTables } from '../dre.consolidator';
import type { DreTable, DreCanonicalRow, DreLineCode } from '../dre-lines.types';
import { DRE_LINE_MAPPINGS } from '../dre-lines';

function makeRow(
  code: DreLineCode,
  presumed: number,
  real: number,
  periodKey = '2026-01'
): DreCanonicalRow {
  return {
    period_type: 'detail',
    period_key: periodKey,
    quote_code: null,
    os_number: null,
    line_code: code,
    line_label: code,
    sort_order: DRE_LINE_MAPPINGS.find((m) => m.line_code === code)?.sort_order ?? 0,
    indent_level: 0,
    presumed_value: presumed,
    real_value: real,
    variance_value: real - presumed,
    variance_percent: 0,
    badge_direction: 'neutral',
    badge_color: 'neutral',
    has_formula_warning: false,
    missing_real_cost_flag: false,
  };
}

function makeTable(referenceDate: string, values: Partial<Record<DreLineCode, [number, number]>>): DreTable {
  const rows: DreCanonicalRow[] = DRE_LINE_MAPPINGS.map((m) => {
    const [p, r] = values[m.line_code] ?? [0, 0];
    return makeRow(m.line_code, p, r);
  });
  return {
    period_type: 'detail',
    period_key: `OS-test`,
    quote_code: null,
    os_number: null,
    reference_date: referenceDate,
    rows,
  };
}

describe('consolidateDreTables', () => {
  it('consolida por mês: duas tabelas do mesmo mês viram uma', () => {
    const t1 = makeTable('2026-01-10', {
      faturamento_bruto: [5000, 5000],
      das: [700, 700],
      icms: [0, 0],
      receita_liquida: [4300, 4300],
      overhead: [400, 400],
      custo_motorista: [1500, 1600],
      pedagio: [200, 250],
      carga_descarga: [100, 100],
      espera: [0, 0],
      taxas_condicionais: [50, 50],
      outros_custos: [0, 0],
    });
    const t2 = makeTable('2026-01-20', {
      faturamento_bruto: [5000, 5000],
      das: [700, 700],
      icms: [0, 0],
      receita_liquida: [4300, 4300],
      overhead: [400, 400],
      custo_motorista: [1500, 1400],
      pedagio: [300, 300],
      carga_descarga: [100, 120],
      espera: [0, 0],
      taxas_condicionais: [50, 50],
      outros_custos: [0, 0],
    });

    const result = consolidateDreTables([t1, t2], 'month');
    expect(result).toHaveLength(1);
    expect(result[0]!.period_key).toBe('2026-01');

    const fat = result[0]!.rows.find((r) => r.line_code === 'faturamento_bruto')!;
    expect(fat.presumed_value).toBe(10000);
    expect(fat.real_value).toBe(10000);
  });

  it('separa tabelas de meses diferentes', () => {
    const t1 = makeTable('2026-01-10', { faturamento_bruto: [5000, 5000] });
    const t2 = makeTable('2026-02-10', { faturamento_bruto: [3000, 3000] });

    const result = consolidateDreTables([t1, t2], 'month');
    expect(result).toHaveLength(2);
    expect(result[0]!.period_key).toBe('2026-01');
    expect(result[1]!.period_key).toBe('2026-02');
  });

  it('consolida por trimestre', () => {
    const t1 = makeTable('2026-01-10', { faturamento_bruto: [3000, 3000] });
    const t2 = makeTable('2026-03-10', { faturamento_bruto: [2000, 2000] });

    const result = consolidateDreTables([t1, t2], 'quarter');
    expect(result).toHaveLength(1);
    expect(result[0]!.period_key).toBe('2026-Q1');
  });

  it('consolida por ano', () => {
    const t1 = makeTable('2026-03-10', { faturamento_bruto: [3000, 3000] });
    const t2 = makeTable('2026-09-10', { faturamento_bruto: [5000, 5000] });

    const result = consolidateDreTables([t1, t2], 'year');
    expect(result).toHaveLength(1);
    expect(result[0]!.period_key).toBe('2026');
  });

  it('periodType default (não month/quarter/year) usa dateStr como key', () => {
    const t1 = makeTable('2026-01-15', { faturamento_bruto: [5000, 5000] });

    const result = consolidateDreTables([t1], 'detail');
    expect(result).toHaveLength(1);
    expect(result[0]!.period_key).toBe('2026-01-15');
  });

  it('recalcula custos_diretos como soma das sublinhas', () => {
    const t1 = makeTable('2026-01-10', {
      faturamento_bruto: [10000, 10000],
      das: [0, 0],
      icms: [0, 0],
      receita_liquida: [10000, 10000],
      overhead: [0, 0],
      custo_motorista: [1000, 1200],
      pedagio: [200, 300],
      carga_descarga: [100, 100],
      espera: [50, 50],
      taxas_condicionais: [30, 30],
      outros_custos: [20, 20],
    });

    const result = consolidateDreTables([t1], 'month');
    const cd = result[0]!.rows.find((r) => r.line_code === 'custos_diretos')!;
    expect(cd.presumed_value).toBe(1400); // 1000+200+100+50+30+20
    expect(cd.real_value).toBe(1700); // 1200+300+100+50+30+20
  });

  it('recalcula resultado_liquido e margem_liquida', () => {
    const t1 = makeTable('2026-01-10', {
      faturamento_bruto: [10000, 10000],
      das: [0, 0],
      icms: [0, 0],
      receita_liquida: [10000, 10000],
      overhead: [1000, 1000],
      custo_motorista: [3000, 3500],
      pedagio: [0, 0],
      carga_descarga: [0, 0],
      espera: [0, 0],
      taxas_condicionais: [0, 0],
      outros_custos: [0, 0],
    });

    const result = consolidateDreTables([t1], 'month');
    const rl = result[0]!.rows.find((r) => r.line_code === 'resultado_liquido')!;
    // resultado = receita(10000) - overhead(1000) - custos(3000) = 6000
    expect(rl.presumed_value).toBe(6000);
    // resultado_real = 10000 - 1000 - 3500 = 5500
    expect(rl.real_value).toBe(5500);

    const ml = result[0]!.rows.find((r) => r.line_code === 'margem_liquida')!;
    expect(ml.presumed_value).toBe(60); // 6000/10000*100
    expect(ml.real_value).toBe(55); // 5500/10000*100
  });

  it('retorna array vazio para input vazio', () => {
    const result = consolidateDreTables([], 'month');
    expect(result).toHaveLength(0);
  });

  it('ordena resultado por period_key', () => {
    const t1 = makeTable('2026-03-10', { faturamento_bruto: [1000, 1000] });
    const t2 = makeTable('2026-01-10', { faturamento_bruto: [2000, 2000] });

    const result = consolidateDreTables([t1, t2], 'month');
    expect(result[0]!.period_key).toBe('2026-01');
    expect(result[1]!.period_key).toBe('2026-03');
  });

  it('margem = 0 quando faturamento consolidado = 0', () => {
    const t1 = makeTable('2026-01-10', {
      faturamento_bruto: [0, 0],
      receita_liquida: [0, 0],
      overhead: [0, 0],
    });
    const result = consolidateDreTables([t1], 'month');
    const ml = result[0]!.rows.find((r) => r.line_code === 'margem_liquida')!;
    expect(ml.presumed_value).toBe(0);
    expect(ml.real_value).toBe(0);
  });

  it('variance_percent calculado quando presumed > EPS', () => {
    const t1 = makeTable('2026-01-10', {
      faturamento_bruto: [10000, 10000],
      custo_motorista: [3000, 3500],
      pedagio: [0, 0],
      carga_descarga: [0, 0],
      espera: [0, 0],
      taxas_condicionais: [0, 0],
      outros_custos: [0, 0],
    });
    const result = consolidateDreTables([t1], 'month');
    const motorista = result[0]!.rows.find((r) => r.line_code === 'custo_motorista')!;
    // 500 / 3000 * 100 = 16.67
    expect(motorista.variance_percent).toBeCloseTo(16.67, 1);
  });

  it('variance_percent = 0 quando presumed ≈ 0', () => {
    const t1 = makeTable('2026-01-10', {
      faturamento_bruto: [10000, 10000],
      espera: [0, 50], // presumed = 0
    });
    const result = consolidateDreTables([t1], 'month');
    const espera = result[0]!.rows.find((r) => r.line_code === 'espera')!;
    expect(espera.variance_percent).toBe(0);
  });

  it('badge neutro quando presumed ≈ 0 (neutralByZero)', () => {
    const t1 = makeTable('2026-01-10', {
      faturamento_bruto: [10000, 10000],
      espera: [0, 100],
    });
    const result = consolidateDreTables([t1], 'month');
    const espera = result[0]!.rows.find((r) => r.line_code === 'espera')!;
    expect(espera.badge_direction).toBe('neutral');
    expect(espera.badge_color).toBe('neutral');
  });

  it('tabela com linhas parciais: ?? 0 exercitado para chaves ausentes', () => {
    // Cria tabela com apenas faturamento e receita, sem sublinhas de custo
    const partialTable: DreTable = {
      period_type: 'detail',
      period_key: 'partial',
      quote_code: null,
      os_number: null,
      reference_date: '2026-01-10',
      rows: [
        makeRow('faturamento_bruto', 10000, 10000),
        makeRow('receita_liquida', 10000, 10000),
        makeRow('overhead', 500, 500),
        // Sem custo_motorista, pedagio, etc. → get() retorna undefined → ?? 0
      ],
    };
    const result = consolidateDreTables([partialTable], 'month');
    expect(result).toHaveLength(1);
    const cd = result[0]!.rows.find((r) => r.line_code === 'custos_diretos')!;
    expect(cd.presumed_value).toBe(0);
    const rl = result[0]!.rows.find((r) => r.line_code === 'resultado_liquido')!;
    // resultado = receita(10000) - overhead(500) - custos(0) = 9500
    expect(rl.presumed_value).toBe(9500);
  });

  it('calcula badge para linhas consolidadas', () => {
    const t1 = makeTable('2026-01-10', {
      faturamento_bruto: [10000, 10000],
      custo_motorista: [3000, 4000], // custo subiu
    });
    const result = consolidateDreTables([t1], 'month');
    const motorista = result[0]!.rows.find((r) => r.line_code === 'custo_motorista')!;
    // custo negativo: real > presumido → vermelho
    expect(motorista.badge_color).toBe('red');
  });
});
