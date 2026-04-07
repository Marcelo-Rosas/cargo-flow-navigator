import type { DreCanonicalRow } from './dre-lines.types';

const EPS = 0.01;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function get(rows: DreCanonicalRow[], code: DreCanonicalRow['line_code']): DreCanonicalRow {
  const row = rows.find((r) => r.line_code === code);
  if (!row) throw new Error(`Linha DRE ausente: ${code}`);
  return row;
}

/**
 * Valida fórmulas contábeis obrigatórias da DRE e propaga warning técnico.
 * - custos_diretos = soma das sublinhas
 * - resultado_liquido = receita_liquida - overhead - custos_diretos
 * - margem_liquida (presumido) = resultado_liquido / faturamento_bruto
 * - margem_liquida (real) = resultado_liquido / receita_liquida_real
 */
export function validateDreRows(rows: DreCanonicalRow[]): DreCanonicalRow[] {
  const custoMotorista = get(rows, 'custo_motorista');
  const pedagio = get(rows, 'pedagio');
  const cargaDescarga = get(rows, 'carga_descarga');
  const espera = get(rows, 'espera');
  const taxasCondicionais = get(rows, 'taxas_condicionais');
  const outrosCustos = get(rows, 'outros_custos');
  const custosDiretos = get(rows, 'custos_diretos');
  const receitaLiquida = get(rows, 'receita_liquida');
  const overhead = get(rows, 'overhead');
  const resultadoLiquido = get(rows, 'resultado_liquido');
  const faturamento = get(rows, 'faturamento_bruto');
  const margem = get(rows, 'margem_liquida');

  const expectedCustosDiretos = round2(
    custoMotorista.presumed_value +
      pedagio.presumed_value +
      cargaDescarga.presumed_value +
      espera.presumed_value +
      taxasCondicionais.presumed_value +
      outrosCustos.presumed_value
  );
  const expectedCustosDiretosReal = round2(
    custoMotorista.real_value +
      pedagio.real_value +
      cargaDescarga.real_value +
      espera.real_value +
      taxasCondicionais.real_value +
      outrosCustos.real_value
  );

  const expectedResultado = round2(
    receitaLiquida.presumed_value - overhead.presumed_value - custosDiretos.presumed_value
  );
  const expectedResultadoReal = round2(
    receitaLiquida.real_value - overhead.real_value - custosDiretos.real_value
  );

  const expectedMargem = faturamento.presumed_value
    ? round2((resultadoLiquido.presumed_value / faturamento.presumed_value) * 100)
    : 0;
  const expectedMargemReal = receitaLiquida.real_value
    ? round2((resultadoLiquido.real_value / receitaLiquida.real_value) * 100)
    : 0;

  const hasMismatch =
    Math.abs(custosDiretos.presumed_value - expectedCustosDiretos) > EPS ||
    Math.abs(custosDiretos.real_value - expectedCustosDiretosReal) > EPS ||
    Math.abs(resultadoLiquido.presumed_value - expectedResultado) > EPS ||
    Math.abs(resultadoLiquido.real_value - expectedResultadoReal) > EPS ||
    Math.abs(margem.presumed_value - expectedMargem) > EPS ||
    Math.abs(margem.real_value - expectedMargemReal) > EPS;

  if (!hasMismatch) return rows;

  // Fix derived lines to match accounting formulas AND flag the warning
  return rows.map((row) => {
    if (row.line_code === 'custos_diretos') {
      const pVal = expectedCustosDiretos;
      const rVal = expectedCustosDiretosReal;
      const vVal = round2(rVal - pVal);
      const vPct = Math.abs(pVal) > EPS ? round2((vVal / Math.abs(pVal)) * 100) : 0;
      return {
        ...row,
        presumed_value: pVal,
        real_value: rVal,
        variance_value: vVal,
        variance_percent: vPct,
        has_formula_warning: true,
      };
    }
    if (row.line_code === 'resultado_liquido') {
      const pVal = expectedResultado;
      const rVal = expectedResultadoReal;
      const vVal = round2(rVal - pVal);
      const vPct = Math.abs(pVal) > EPS ? round2((vVal / Math.abs(pVal)) * 100) : 0;
      return {
        ...row,
        presumed_value: pVal,
        real_value: rVal,
        variance_value: vVal,
        variance_percent: vPct,
        has_formula_warning: true,
      };
    }
    if (row.line_code === 'margem_liquida') {
      const pVal = expectedMargem;
      const rVal = expectedMargemReal;
      const vVal = round2(rVal - pVal);
      const vPct = Math.abs(pVal) > EPS ? round2((vVal / Math.abs(pVal)) * 100) : 0;
      return {
        ...row,
        presumed_value: pVal,
        real_value: rVal,
        variance_value: vVal,
        variance_percent: vPct,
        has_formula_warning: true,
      };
    }
    return row;
  });
}
