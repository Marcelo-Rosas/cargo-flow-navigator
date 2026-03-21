import { describe, it, expect } from 'vitest';
import { comparePresumedVsReal } from '../dre.comparator';
import type { PresumedValues } from '../dre.presumed';
import type { RealValues } from '../dre.real';
import type { DreLineCode } from '../dre-lines.types';

function makePresumed(overrides?: Partial<Record<DreLineCode, number>>): PresumedValues {
  const values = new Map<DreLineCode, number>([
    ['faturamento_bruto', 10000],
    ['impostos', 2000],
    ['das', 1400],
    ['icms', 600],
    ['receita_liquida', 8000],
    ['overhead', 800],
    ['custos_diretos', 3800],
    ['custo_motorista', 3000],
    ['pedagio', 500],
    ['carga_descarga', 200],
    ['espera', 0],
    ['taxas_condicionais', 100],
    ['outros_custos', 0],
    ['resultado_liquido', 3400],
    ['margem_liquida', 34],
  ]);
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      values.set(k as DreLineCode, v);
    }
  }
  return { values, hasFormulaWarning: false };
}

function makeReal(overrides?: Partial<Record<DreLineCode, number>>): RealValues {
  const values = new Map<DreLineCode, number>([
    ['faturamento_bruto', 10000],
    ['impostos', 2000],
    ['das', 1400],
    ['icms', 600],
    ['receita_liquida', 8000],
    ['overhead', 800],
    ['custos_diretos', 4000],
    ['custo_motorista', 3200],
    ['pedagio', 500],
    ['carga_descarga', 200],
    ['espera', 0],
    ['taxas_condicionais', 100],
    ['outros_custos', 0],
    ['resultado_liquido', 3200],
    ['margem_liquida', 32],
  ]);
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      values.set(k as DreLineCode, v);
    }
  }
  return { values, absentFields: new Set() };
}

const baseContext = {
  period_type: 'detail' as const,
  period_key: 'OS-001',
  quote_code: 'Q-001',
  os_number: 'OS-001',
};

describe('comparePresumedVsReal', () => {
  it('gera rows para todas as 15 linhas DRE', () => {
    const rows = comparePresumedVsReal(makePresumed(), makeReal(), false, baseContext);
    expect(rows).toHaveLength(15);
  });

  it('calcula variance = real - presumido', () => {
    const rows = comparePresumedVsReal(makePresumed(), makeReal(), false, baseContext);
    const motorista = rows.find((r) => r.line_code === 'custo_motorista')!;
    expect(motorista.variance_value).toBe(200); // 3200 - 3000
  });

  it('calcula variance_percent relativo ao |presumido|', () => {
    const rows = comparePresumedVsReal(makePresumed(), makeReal(), false, baseContext);
    const motorista = rows.find((r) => r.line_code === 'custo_motorista')!;
    // 200 / 3000 * 100 = 6.67
    expect(motorista.variance_percent).toBeCloseTo(6.67, 1);
  });

  it('variance_percent = 0 quando presumido = 0', () => {
    const rows = comparePresumedVsReal(makePresumed(), makeReal(), false, baseContext);
    const espera = rows.find((r) => r.line_code === 'espera')!;
    expect(espera.variance_percent).toBe(0);
  });

  it('badge neutro quando presumido ≈ 0 (isZeroPresumed)', () => {
    const rows = comparePresumedVsReal(makePresumed(), makeReal(), false, baseContext);
    const espera = rows.find((r) => r.line_code === 'espera')!;
    expect(espera.badge_direction).toBe('neutral');
    expect(espera.badge_color).toBe('neutral');
  });

  it('force_neutral_badge força todos os badges para neutro', () => {
    const rows = comparePresumedVsReal(makePresumed(), makeReal(), false, {
      ...baseContext,
      force_neutral_badge: true,
    });
    for (const row of rows) {
      expect(row.badge_direction).toBe('neutral');
      expect(row.badge_color).toBe('neutral');
    }
  });

  it('has_formula_warning apenas em resultado_liquido e margem_liquida', () => {
    const rows = comparePresumedVsReal(makePresumed(), makeReal(), true, baseContext);
    const resultado = rows.find((r) => r.line_code === 'resultado_liquido')!;
    const margem = rows.find((r) => r.line_code === 'margem_liquida')!;
    const faturamento = rows.find((r) => r.line_code === 'faturamento_bruto')!;

    expect(resultado.has_formula_warning).toBe(true);
    expect(margem.has_formula_warning).toBe(true);
    expect(faturamento.has_formula_warning).toBe(false);
  });

  it('missing_real_cost_flag propagado do real.absentFields', () => {
    const real = makeReal();
    real.absentFields.add('custo_motorista');
    real.absentFields.add('pedagio');

    const rows = comparePresumedVsReal(makePresumed(), real, false, baseContext);
    expect(rows.find((r) => r.line_code === 'custo_motorista')!.missing_real_cost_flag).toBe(true);
    expect(rows.find((r) => r.line_code === 'pedagio')!.missing_real_cost_flag).toBe(true);
    expect(rows.find((r) => r.line_code === 'carga_descarga')!.missing_real_cost_flag).toBe(false);
  });

  it('preenche context fields em todas as rows', () => {
    const rows = comparePresumedVsReal(makePresumed(), makeReal(), false, baseContext);
    for (const row of rows) {
      expect(row.period_type).toBe('detail');
      expect(row.period_key).toBe('OS-001');
      expect(row.quote_code).toBe('Q-001');
      expect(row.os_number).toBe('OS-001');
    }
  });

  it('badge calculado corretamente para custo (negativo) real > presumido', () => {
    const rows = comparePresumedVsReal(makePresumed(), makeReal(), false, baseContext);
    const motorista = rows.find((r) => r.line_code === 'custo_motorista')!;
    // custo subiu = vermelho
    expect(motorista.badge_color).toBe('red');
    expect(motorista.badge_direction).toBe('up');
  });
});
