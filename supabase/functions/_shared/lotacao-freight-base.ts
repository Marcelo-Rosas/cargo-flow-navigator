/**
 * Lotação (FTL): base de custo carreteiro para gross-up = Piso ANTT bruto, quando calculado.
 * Paridade obrigatória com src/lib/lotacao-freight-base.ts
 */

export const LOTACAO_KM_OVER_RULE_KEYS = [
  { maxKm: 800, key: 'over_lotacao_ate_800km' },
  { maxKm: 1500, key: 'over_lotacao_801_1500km' },
  { maxKm: 2500, key: 'over_lotacao_1501_2500km' },
  { maxKm: Number.POSITIVE_INFINITY, key: 'over_lotacao_acima_2500km' },
] as const;

export const LOTACAO_OVER_ANTT_KEY = 'over_lotacao_percent';

export type ResolvePricingRuleFn = (key: string) => number | undefined;

export function resolveLotacaoKmOverPercent(km: number, resolveRule: ResolvePricingRuleFn): number {
  const kmCeil = Math.ceil(Math.max(0, km));
  for (const band of LOTACAO_KM_OVER_RULE_KEYS) {
    if (kmCeil <= band.maxKm) {
      return resolveRule(band.key) ?? 0;
    }
  }
  return 0;
}

export interface LotacaoFretePesoResult {
  fretePeso: number;
  fretePesoReferenciaMax: number;
  freteTabela: number;
  freteTabelaComOverKm: number;
  pisoAntt: number;
  pisoComOverAntt: number;
  overKmPercent: number;
  overAnttPercent: number;
  pisoAplicado: boolean;
  anttCostBaseUsed: boolean;
  anttFloorApplied: boolean;
}

export function resolveLotacaoFretePeso(params: {
  freteTabela: number;
  pisoAntt: number;
  km: number;
  overKmPercent: number;
  overAnttPercent: number;
  round?: (n: number) => number;
}): LotacaoFretePesoResult {
  const round = params.round ?? ((n: number) => Math.round((n + Number.EPSILON) * 100) / 100);
  const freteTabela = round(Math.max(0, params.freteTabela));
  const pisoAntt = round(Math.max(0, params.pisoAntt));
  const freteTabelaComOverKm = round(freteTabela * (1 + params.overKmPercent / 100));
  const pisoComOverAntt = pisoAntt;
  const fretePesoReferenciaMax = round(Math.max(freteTabelaComOverKm, pisoAntt));
  const anttCostBaseUsed = pisoAntt > 0;
  const fretePeso = anttCostBaseUsed ? pisoAntt : freteTabelaComOverKm;
  const pisoAplicado = anttCostBaseUsed;
  const anttFloorApplied =
    anttCostBaseUsed ||
    (pisoAntt > 0 && pisoAntt > freteTabela) ||
    pisoAntt >= freteTabelaComOverKm;

  return {
    fretePeso,
    fretePesoReferenciaMax,
    freteTabela,
    freteTabelaComOverKm,
    pisoAntt,
    pisoComOverAntt,
    overKmPercent: params.overKmPercent,
    overAnttPercent: params.overAnttPercent,
    pisoAplicado,
    anttCostBaseUsed,
    anttFloorApplied,
  };
}

export interface LotacaoProfitabilityInput {
  receitaLiquida: number;
  overhead: number;
  fretePeso: number;
  pisoAntt?: number;
  custoServicos: number;
  custosDescarga: number;
  custosDiretos: number;
  totalCliente: number;
  profitMarginPercent: number;
}

export interface LotacaoProfitabilityResult {
  margemBruta: number;
  resultadoLiquido: number;
  margemPercent: number;
  custoMotoristaContratado: number;
  custoMotoristaAntt: number;
}

export function calculateLotacaoProfitability(
  input: LotacaoProfitabilityInput,
  round: (n: number) => number = (n) => Math.round((n + Number.EPSILON) * 100) / 100
): LotacaoProfitabilityResult {
  const pisoAntt = round(Math.max(0, input.pisoAntt ?? 0));
  const custoMotoristaContratado = round(input.fretePeso);
  const custoMotoristaMargem = pisoAntt > 0 ? pisoAntt : custoMotoristaContratado;
  const margemBruta = round(
    input.receitaLiquida -
      input.overhead -
      custoMotoristaMargem -
      input.custoServicos -
      input.custosDescarga
  );
  const custosDiretos = round(Math.max(0, input.custosDiretos));
  const resultadoLiquido =
    custosDiretos > 0 && input.profitMarginPercent > 0
      ? round(custosDiretos * (input.profitMarginPercent / 100))
      : margemBruta;
  const margemPercent =
    custosDiretos > 0
      ? round((resultadoLiquido / custosDiretos) * 100)
      : input.totalCliente > 0
        ? round((resultadoLiquido / input.totalCliente) * 100)
        : 0;

  return {
    margemBruta,
    resultadoLiquido,
    margemPercent,
    custoMotoristaContratado,
    custoMotoristaAntt: pisoAntt > 0 ? pisoAntt : custoMotoristaContratado,
  };
}
