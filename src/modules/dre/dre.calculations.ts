import type { DreComparativoRow } from './dre.types';

/** Arredonda para 2 casas decimais */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
