import type { DreComparativoRow } from './dre.types';

/** Arredonda para 2 casas decimais */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Extrai valor numérico seguro de objeto aninhado */
function num(obj: unknown, ...keys: string[]): number {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return 0;
    cur = (cur as Record<string, unknown>)[k];
  }
  const v = typeof cur === 'number' ? cur : Number(cur);
  return Number.isFinite(v) ? v : 0;
}

/** Calcula DRE Real a partir dos valores presumidos, alterando APENAS custos operacionais.
 * Regra: receita, tributos e overhead permanecem fixos. */
export function computeDreRealFromPresumido(params: {
  receitaBrutaPresumida: number;
  dasPresumido: number;
  icmsPresumido: number;
  receitaLiquidaPresumida: number;
  custoMotoristaPresumido: number;
  pedagioPresumido: number;
  aluguelMaquinasPresumido: number;
  descargaPresumida: number;
  maoDeObraPresumida: number;
  custosDiretosPresumidos: number;
  overheadPresumido: number;
  resultadoPresumido: number;
  margemPresumidaPercent: number;
  custoMotoristaReal: number;
  pedagioReal: number;
  aluguelMaquinasReal: number;
  descargaReal: number;
  maoDeObraReal: number;
}): Pick<
  DreComparativoRow,
  'custosDiretosReais' | 'resultadoReal' | 'margemRealPercent' | 'deltaResultado' | 'deltaPercent'
> {
  const {
    receitaBrutaPresumida,
    receitaLiquidaPresumida,
    overheadPresumido,
    resultadoPresumido,
    custoMotoristaReal,
    pedagioReal,
    aluguelMaquinasReal,
    descargaReal,
    maoDeObraReal,
  } = params;

  const custosDiretosReais = round2(
    custoMotoristaReal + pedagioReal + aluguelMaquinasReal + descargaReal + maoDeObraReal
  );

  const resultadoReal = round2(receitaLiquidaPresumida - custosDiretosReais - overheadPresumido);

  const margemRealPercent =
    receitaBrutaPresumida > 0 ? round2((resultadoReal / receitaBrutaPresumida) * 100) : 0;

  const deltaResultado = round2(resultadoReal - resultadoPresumido);

  const deltaPercent =
    resultadoPresumido !== 0 ? round2((deltaResultado / Math.abs(resultadoPresumido)) * 100) : 0;

  return {
    custosDiretosReais,
    resultadoReal,
    margemRealPercent,
    deltaResultado,
    deltaPercent,
  };
}
