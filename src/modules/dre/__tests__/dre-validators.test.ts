import { describe, it, expect } from 'vitest';
import { validateDreRows } from '../dre.validators';
import type { DreCanonicalRow } from '../dre-lines.types';

function makeRow(
  code: DreCanonicalRow['line_code'],
  presumed: number,
  real: number
): DreCanonicalRow {
  return {
    period_type: 'detail',
    period_key: '2026-03',
    quote_code: 'Q-001',
    os_number: 'OS-001',
    line_code: code,
    line_label: code,
    sort_order: 0,
    indent_level: 0,
    presumed_value: presumed,
    real_value: real,
    variance_value: real - presumed,
    variance_percent: presumed !== 0 ? ((real - presumed) / Math.abs(presumed)) * 100 : 0,
    badge_direction: 'neutral',
    badge_color: 'neutral',
    has_formula_warning: false,
    missing_real_cost_flag: false,
  };
}

function makeValidRows(): DreCanonicalRow[] {
  // Consistent accounting: custos_diretos = sum of sublines
  // resultado_liquido = receita_liquida - overhead - custos_diretos
  // margem_liquida = resultado_liquido / faturamento_bruto * 100
  const custo_motorista_p = 3000,
    custo_motorista_r = 3200;
  const pedagio_p = 500,
    pedagio_r = 550;
  const carga_descarga_p = 100,
    carga_descarga_r = 120;
  const espera_p = 0,
    espera_r = 0;
  const taxas_condicionais_p = 200,
    taxas_condicionais_r = 200;
  const outros_custos_p = 50,
    outros_custos_r = 50;

  const custos_diretos_p =
    custo_motorista_p + pedagio_p + carga_descarga_p + espera_p + taxas_condicionais_p + outros_custos_p;
  const custos_diretos_r =
    custo_motorista_r + pedagio_r + carga_descarga_r + espera_r + taxas_condicionais_r + outros_custos_r;

  const faturamento_p = 10000,
    faturamento_r = 10000;
  const das_p = 1400,
    das_r = 1400;
  const icms_p = 0,
    icms_r = 0;
  const receita_liquida_p = 8600,
    receita_liquida_r = 8600;
  const overhead_p = 1290,
    overhead_r = 1290;

  const resultado_p = Math.round((receita_liquida_p - overhead_p - custos_diretos_p) * 100) / 100;
  const resultado_r = Math.round((receita_liquida_r - overhead_r - custos_diretos_r) * 100) / 100;

  const margem_p =
    faturamento_p > 0 ? Math.round((resultado_p / faturamento_p) * 100 * 100) / 100 : 0;
  const margem_r =
    faturamento_r > 0 ? Math.round((resultado_r / faturamento_r) * 100 * 100) / 100 : 0;

  return [
    makeRow('faturamento_bruto', faturamento_p, faturamento_r),
    makeRow('impostos', das_p + icms_p, das_r + icms_r),
    makeRow('das', das_p, das_r),
    makeRow('icms', icms_p, icms_r),
    makeRow('receita_liquida', receita_liquida_p, receita_liquida_r),
    makeRow('overhead', overhead_p, overhead_r),
    makeRow('custos_diretos', custos_diretos_p, custos_diretos_r),
    makeRow('custo_motorista', custo_motorista_p, custo_motorista_r),
    makeRow('pedagio', pedagio_p, pedagio_r),
    makeRow('carga_descarga', carga_descarga_p, carga_descarga_r),
    makeRow('espera', espera_p, espera_r),
    makeRow('taxas_condicionais', taxas_condicionais_p, taxas_condicionais_r),
    makeRow('outros_custos', outros_custos_p, outros_custos_r),
    makeRow('resultado_liquido', resultado_p, resultado_r),
    makeRow('margem_liquida', margem_p, margem_r),
  ];
}

describe('validateDreRows', () => {
  it('returns rows unchanged when all formulas match', () => {
    const rows = makeValidRows();
    const result = validateDreRows(rows);
    // No has_formula_warning should be set
    const warned = result.filter((r) => r.has_formula_warning);
    expect(warned).toHaveLength(0);
  });

  it('fixes custos_diretos when sum does not match', () => {
    const rows = makeValidRows();
    // Corrupt custos_diretos
    const cdRow = rows.find((r) => r.line_code === 'custos_diretos')!;
    cdRow.presumed_value = 9999;

    const result = validateDreRows(rows);
    const fixed = result.find((r) => r.line_code === 'custos_diretos')!;
    expect(fixed.has_formula_warning).toBe(true);
    // Should be recalculated from sublines
    expect(fixed.presumed_value).toBe(3850); // 3000+500+100+0+200+50
  });

  it('fixes resultado_liquido when formula does not match', () => {
    const rows = makeValidRows();
    const rlRow = rows.find((r) => r.line_code === 'resultado_liquido')!;
    rlRow.presumed_value = 9999;

    const result = validateDreRows(rows);
    const fixed = result.find((r) => r.line_code === 'resultado_liquido')!;
    expect(fixed.has_formula_warning).toBe(true);
    // resultado = receita_liquida - overhead - custos_diretos = 8600 - 1290 - 3850 = 3460
    expect(fixed.presumed_value).toBe(3460);
  });

  it('fixes margem_liquida when formula does not match', () => {
    const rows = makeValidRows();
    const mlRow = rows.find((r) => r.line_code === 'margem_liquida')!;
    mlRow.presumed_value = 9999;

    const result = validateDreRows(rows);
    const fixed = result.find((r) => r.line_code === 'margem_liquida')!;
    expect(fixed.has_formula_warning).toBe(true);
  });

  it('throws when a required line_code is missing', () => {
    const rows = makeValidRows().filter((r) => r.line_code !== 'custo_motorista');
    expect(() => validateDreRows(rows)).toThrow('Linha DRE ausente: custo_motorista');
  });
});
