/**
 * DRE Presumida — recomposição a partir das linhas atômicas do pricing_breakdown.
 * NÃO usa resultadoLiquido como fonte primária; recalcula e valida contra ele.
 */

import type { DreLineCode } from './dre-lines.types';

type Breakout = Record<string, unknown>;

const EPS = 0.01;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function num(obj: unknown, ...keys: string[]): number {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return 0;
    cur = (cur as Record<string, unknown>)[k];
  }
  const v = typeof cur === 'number' ? cur : Number(cur);
  return Number.isFinite(v) ? v : 0;
}

function numOrUndef(obj: unknown, ...keys: string[]): number | undefined {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  const v = typeof cur === 'number' ? cur : Number(cur);
  return Number.isFinite(v) ? v : undefined;
}

function numFallback(obj: unknown, camel: string[], snake: string[]): number {
  return numOrUndef(obj, ...camel) ?? numOrUndef(obj, ...snake) ?? 0;
}

export interface PresumedValues {
  values: Map<DreLineCode, number>;
  hasFormulaWarning: boolean;
  /** Mensagem de inconsistência (quando resultado recomputado != profitability.resultadoLiquido) */
  formulaWarningMessage?: string;
}

/**
 * Extrai e recomputa a DRE presumida a partir do pricing_breakdown.
 * Valida contra profitability.resultadoLiquido e seta hasFormulaWarning em caso de divergência.
 */
export function computePresumedFromBreakdown(
  breakdown: Breakout | null,
  quoteValue: number
): PresumedValues {
  const values = new Map<DreLineCode, number>();

  const faturamento =
    numFallback(breakdown, ['totals', 'totalCliente'], ['totals', 'total_cliente']) || quoteValue;
  const das = numFallback(breakdown, ['totals', 'das'], ['totals', 'das']) ?? 0;
  const icms = numFallback(breakdown, ['totals', 'icms'], ['totals', 'icms']) ?? 0;

  values.set('faturamento_bruto', round2(faturamento));
  values.set('impostos', round2(das + icms));
  values.set('das', round2(das));
  values.set('icms', round2(icms));

  // Receita líquida sempre derivada da fórmula contábil.
  const receitaLiquida = round2(faturamento - das - icms);
  values.set('receita_liquida', round2(receitaLiquida));

  const overhead =
    numFallback(breakdown, ['profitability', 'overhead'], ['profitability', 'overhead']) ?? 0;
  values.set('overhead', round2(overhead));

  // Linhas atômicas de custo
  const custoMotorista =
    (numFallback(
      breakdown,
      ['profitability', 'custoMotorista'],
      ['profitability', 'custo_motorista']
    ) ||
      numFallback(
        breakdown,
        ['profitability', 'custosCarreteiro'],
        ['profitability', 'custos_carreteiro']
      )) ??
    0;
  const toll = numFallback(breakdown, ['components', 'toll'], ['components', 'toll']) ?? 0;
  const custosDescarga =
    numFallback(
      breakdown,
      ['profitability', 'custosDescarga'],
      ['profitability', 'custos_descarga']
    ) ?? 0;
  const waitingTimeCost =
    numFallback(
      breakdown,
      ['components', 'waitingTimeCost'],
      ['components', 'waiting_time_cost']
    ) ?? 0;
  const conditionalFeesTotal =
    numFallback(
      breakdown,
      ['components', 'conditionalFeesTotal'],
      ['components', 'conditional_fees_total']
    ) ?? 0;
  const aluguelMaquinas =
    numFallback(breakdown, ['components', 'aluguelMaquinas'], ['components', 'aluguel_maquinas']) ??
    0;
  const riskTotal = num(breakdown?.riskCosts, 'total') ?? 0;
  const custoServicos =
    numFallback(
      breakdown,
      ['profitability', 'custoServicos'],
      ['profitability', 'custo_servicos']
    ) ?? 0;
  // Custos sem linha dedicada (ex.: aluguel de máquinas) são agregados em "outros custos".
  const outrosCustos = round2(riskTotal + custoServicos + aluguelMaquinas);

  values.set('custo_motorista', round2(custoMotorista));
  values.set('pedagio', round2(toll));
  values.set('carga_descarga', round2(custosDescarga));
  values.set('espera', round2(waitingTimeCost));
  values.set('taxas_condicionais', round2(conditionalFeesTotal));
  values.set('outros_custos', outrosCustos);

  const custosDiretos = round2(
    custoMotorista + toll + custosDescarga + waitingTimeCost + conditionalFeesTotal + outrosCustos
  );
  values.set('custos_diretos', custosDiretos);

  const resultadoRecomputado = round2(receitaLiquida - overhead - custosDiretos);
  values.set('resultado_liquido', resultadoRecomputado);

  const margemPercent = faturamento > 0 ? round2((resultadoRecomputado / faturamento) * 100) : 0;
  values.set('margem_liquida', margemPercent);

  const resultadoJSON =
    numFallback(
      breakdown,
      ['profitability', 'resultadoLiquido'],
      ['profitability', 'resultado_liquido']
    ) ?? 0;
  const hasFormulaWarning = Math.abs(resultadoRecomputado - resultadoJSON) > EPS;
  const formulaWarningMessage = hasFormulaWarning
    ? `Divergência: resultado recomputado R$ ${resultadoRecomputado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} vs JSON R$ ${resultadoJSON.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : undefined;

  return { values, hasFormulaWarning, formulaWarningMessage };
}
