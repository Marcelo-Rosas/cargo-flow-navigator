/**
 * Compara DRE Presumida x Real e produz rows canônicas.
 */

import type { DreCanonicalRow, PeriodType } from './dre-lines.types';
import { DRE_LINE_MAPPINGS } from './dre-lines';
import { computeBadge } from './dre.badges';
import type { PresumedValues } from './dre.presumed';
import type { RealValues } from './dre.real';

const EPS = 0.01;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function comparePresumedVsReal(
  presumed: PresumedValues,
  real: RealValues,
  hasFormulaWarning: boolean,
  context: {
    period_type: PeriodType;
    period_key: string;
    quote_code: string | null;
    os_number: string | null;
    force_neutral_badge?: boolean;
  }
): DreCanonicalRow[] {
  const rows: DreCanonicalRow[] = [];

  for (const mapping of DRE_LINE_MAPPINGS) {
    const code = mapping.line_code;
    const presumedVal = presumed.values.get(code) ?? 0;
    const realVal = real.values.get(code) ?? 0;
    const varianceValue = round2(realVal - presumedVal);

    let variancePercent = 0;
    if (Math.abs(presumedVal) > EPS) {
      variancePercent = round2((varianceValue / Math.abs(presumedVal)) * 100);
    }

    const isZeroPresumed = Math.abs(presumedVal) <= EPS;
    const computed = computeBadge(code, presumedVal, realVal);
    const neutralByRule = context.force_neutral_badge || isZeroPresumed;
    const badgeDirection = neutralByRule ? 'neutral' : computed.direction;
    const badgeColor = neutralByRule ? 'neutral' : computed.color;

    const hasFormulaWarningForLine =
      hasFormulaWarning && (code === 'resultado_liquido' || code === 'margem_liquida');
    const missingRealCostFlag = real.absentFields.has(code);

    rows.push({
      period_type: context.period_type,
      period_key: context.period_key,
      quote_code: context.quote_code,
      os_number: context.os_number,
      line_code: code,
      line_label: mapping.line_label,
      sort_order: mapping.sort_order,
      indent_level: mapping.indent_level,
      presumed_value: round2(presumedVal),
      real_value: round2(realVal),
      variance_value: varianceValue,
      variance_percent: variancePercent,
      badge_direction: badgeDirection,
      badge_color: badgeColor,
      has_formula_warning: hasFormulaWarningForLine,
      missing_real_cost_flag: missingRealCostFlag,
    });
  }

  return rows;
}
