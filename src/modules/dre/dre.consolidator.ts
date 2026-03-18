/**
 * Consolida DreTable[] por período (mês, trimestre, ano).
 * Soma as mesmas linhas da DRE mantendo a estrutura contábil.
 */

import type { DreTable, DreCanonicalRow, DreLineCode } from './dre-lines.types';
import { DRE_LINE_MAPPINGS } from './dre-lines';
import { computeBadge } from './dre.badges';
import type { PeriodType } from './dre-lines.types';
import { validateDreRows } from './dre.validators';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getPeriodKey(dateStr: string, periodType: PeriodType): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  switch (periodType) {
    case 'month':
      return `${y}-${String(m).padStart(2, '0')}`;
    case 'quarter': {
      const q = Math.ceil(m / 3);
      return `${y}-Q${q}`;
    }
    case 'year':
      return String(y);
    default:
      return dateStr;
  }
}

/**
 * Agrupa DreTables por periodKey e soma os valores de cada linha.
 */
export function consolidateDreTables(tables: DreTable[], periodType: PeriodType): DreTable[] {
  const byKey = new Map<
    string,
    {
      tables: DreTable[];
      presumedSums: Map<DreLineCode, number>;
      realSums: Map<DreLineCode, number>;
    }
  >();

  for (const t of tables) {
    const key = getPeriodKey(t.reference_date, periodType);
    let bucket = byKey.get(key);
    if (!bucket) {
      bucket = {
        tables: [],
        presumedSums: new Map(),
        realSums: new Map(),
      };
      byKey.set(key, bucket);
    }
    bucket.tables.push(t);

    for (const row of t.rows) {
      const pSum = (bucket.presumedSums.get(row.line_code) ?? 0) + row.presumed_value;
      const rSum = (bucket.realSums.get(row.line_code) ?? 0) + row.real_value;
      bucket.presumedSums.set(row.line_code, round2(pSum));
      bucket.realSums.set(row.line_code, round2(rSum));
    }
  }

  const result: DreTable[] = [];
  for (const [periodKey, bucket] of byKey.entries()) {
    // Recalculate derived lines from consolidated atomic sums
    // (summing derived lines directly produces incorrect results)
    const p = bucket.presumedSums;
    const r = bucket.realSums;

    // custos_diretos = sum of atomic cost sublines
    const pCustosDiretos = round2(
      (p.get('custo_motorista') ?? 0) +
        (p.get('pedagio') ?? 0) +
        (p.get('carga_descarga') ?? 0) +
        (p.get('espera') ?? 0) +
        (p.get('taxas_condicionais') ?? 0) +
        (p.get('outros_custos') ?? 0)
    );
    const rCustosDiretos = round2(
      (r.get('custo_motorista') ?? 0) +
        (r.get('pedagio') ?? 0) +
        (r.get('carga_descarga') ?? 0) +
        (r.get('espera') ?? 0) +
        (r.get('taxas_condicionais') ?? 0) +
        (r.get('outros_custos') ?? 0)
    );
    p.set('custos_diretos', pCustosDiretos);
    r.set('custos_diretos', rCustosDiretos);

    // resultado_liquido = receita_liquida - overhead - custos_diretos
    const pResultado = round2(
      (p.get('receita_liquida') ?? 0) - (p.get('overhead') ?? 0) - pCustosDiretos
    );
    const rResultado = round2(
      (r.get('receita_liquida') ?? 0) - (r.get('overhead') ?? 0) - rCustosDiretos
    );
    p.set('resultado_liquido', pResultado);
    r.set('resultado_liquido', rResultado);

    // margem_liquida = resultado / faturamento × 100 (percentage, NOT summable)
    const pFat = p.get('faturamento_bruto') ?? 0;
    const rFat = r.get('faturamento_bruto') ?? 0;
    p.set('margem_liquida', pFat > 0 ? round2((pResultado / pFat) * 100) : 0);
    r.set('margem_liquida', rFat > 0 ? round2((rResultado / rFat) * 100) : 0);

    const rows: DreCanonicalRow[] = [];
    for (const mapping of DRE_LINE_MAPPINGS) {
      const code = mapping.line_code;
      const presumedVal = p.get(code) ?? 0;
      const realVal = r.get(code) ?? 0;
      const varianceValue = round2(realVal - presumedVal);
      let variancePercent = 0;
      if (Math.abs(presumedVal) > 0.01) {
        variancePercent = round2((varianceValue / Math.abs(presumedVal)) * 100);
      }
      const computed = computeBadge(code, presumedVal, realVal);
      const neutralByZero = Math.abs(presumedVal) <= 0.01;

      rows.push({
        period_type: periodType,
        period_key: periodKey,
        quote_code: null,
        os_number: null,
        line_code: code,
        line_label: mapping.line_label,
        sort_order: mapping.sort_order,
        indent_level: mapping.indent_level,
        presumed_value: presumedVal,
        real_value: realVal,
        variance_value: varianceValue,
        variance_percent: variancePercent,
        badge_direction: neutralByZero ? 'neutral' : computed.direction,
        badge_color: neutralByZero ? 'neutral' : computed.color,
        has_formula_warning: false,
        missing_real_cost_flag: false,
      });
    }

    const firstTable = bucket.tables[0]!;
    result.push({
      period_type: periodType,
      period_key: periodKey,
      quote_code: null,
      os_number: null,
      reference_date: firstTable.reference_date,
      rows: validateDreRows(rows),
    });
  }

  result.sort((a, b) => a.period_key.localeCompare(b.period_key, undefined, { numeric: true }));
  return result;
}
