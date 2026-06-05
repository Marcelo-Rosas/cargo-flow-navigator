import type { FreightCalculationOutput } from '@/lib/freightCalculator';
import {
  isMarginBelowTarget,
  resolveMargemBrutaDisplay,
  resolveResultadoLiquidoDisplay,
  round2,
  sumRiskRepasse,
  type StoredPricingBreakdown,
} from '@/lib/freightCalculator';

export interface QuoteFinancialStripPag {
  motorista: number;
  pedagio: number;
  repasse: number;
  pisoAntt?: number;
  anttApplied: boolean;
  tabelaReferencia?: number;
}

export interface QuoteFinancialStripFat {
  totalCliente: number;
  receitaLiquida?: number;
  discount?: number;
  regimeFiscal?: string;
}

export interface QuoteFinancialStripLucro {
  alvo: number;
  percentCustosDiretos: number;
  contribuicao?: number;
  targetPercent: number;
  isBelowTarget: boolean;
}

export interface QuoteFinancialStripModel {
  pag: QuoteFinancialStripPag;
  fat: QuoteFinancialStripFat;
  lucro: QuoteFinancialStripLucro;
}

export function buildQuoteFinancialStripFromCalculation(
  calculation: FreightCalculationOutput | null,
  options?: { discount?: number; modality?: 'lotacao' | 'fracionado' }
): QuoteFinancialStripModel | null {
  if (!calculation || calculation.status !== 'OK') return null;
  const t = calculation.totals;
  const p = calculation.profitability;
  const c = calculation.components;
  const m = calculation.meta;
  if ((t?.totalCliente ?? 0) <= 0) return null;

  const discount = options?.discount ?? 0;
  const totalBruto = t?.totalCliente ?? 0;
  const totalCliente = Math.max(0, totalBruto - discount);

  const anttApplied = m?.anttCostBaseUsed === true || m?.anttFloorApplied === true;
  const pisoAntt = m?.lotacaoPisoComOver ?? m?.anttPisoCarreteiro ?? 0;
  const freteTabelaRef = m?.fretePesoOriginal ?? m?.lotacaoFreteTabelaComOverKm ?? 0;
  const motorista =
    p?.custoMotoristaContratado ??
    (anttApplied && pisoAntt > 0 ? pisoAntt : (c?.baseCost ?? c?.baseFreight ?? 0));

  const receitaLiquida =
    p?.receitaLiquida ??
    Math.max(0, totalBruto - (t?.totalImpostos ?? (t?.das ?? 0) + (t?.icms ?? 0)));
  const custoMotoristaGolden =
    anttApplied && pisoAntt > 0 ? pisoAntt : (c?.baseCost ?? c?.baseFreight ?? 0);
  const custoServicos = p?.custoServicos ?? 0;
  const margemContribuicao = resolveMargemBrutaDisplay(
    p?.margemBruta,
    receitaLiquida,
    p?.overhead ?? 0,
    custoMotoristaGolden,
    custoServicos
  );

  const custosDiretos = p?.custosDiretos ?? 0;
  const targetPercent = p?.profitMarginTarget ?? calculation.rates?.profitMarginPercent ?? 15;
  const lucroAlvo = resolveResultadoLiquidoDisplay(
    p?.resultadoLiquido,
    custosDiretos,
    targetPercent,
    margemContribuicao
  );
  const percentCd = custosDiretos > 0 ? round2((lucroAlvo / custosDiretos) * 100) : 0;
  const isLotacao =
    options?.modality === 'lotacao' ||
    (options?.modality !== 'fracionado' &&
      (m?.anttCostBaseUsed === true || m?.anttFloorApplied === true));
  const percentDisplay =
    isLotacao && custosDiretos > 0
      ? percentCd
      : totalCliente > 0
        ? round2((lucroAlvo / totalCliente) * 100)
        : 0;

  return {
    pag: {
      motorista: round2(motorista),
      pedagio: round2(c?.toll ?? 0),
      repasse: sumRiskRepasse({
        gris: c?.gris,
        tso: c?.tso,
        rctrc: c?.rctrc,
        adValorem: c?.adValorem,
      }),
      pisoAntt: pisoAntt > 0 ? round2(pisoAntt) : undefined,
      anttApplied,
      tabelaReferencia:
        anttApplied && freteTabelaRef > (pisoAntt || motorista) * 1.05
          ? round2(freteTabelaRef)
          : undefined,
    },
    fat: {
      totalCliente: round2(totalCliente),
      receitaLiquida: receitaLiquida > 0 ? round2(receitaLiquida) : undefined,
      discount: discount > 0 ? round2(discount) : undefined,
      regimeFiscal: p?.regimeFiscal,
    },
    lucro: {
      alvo: lucroAlvo,
      percentCustosDiretos: percentDisplay,
      contribuicao: margemContribuicao,
      targetPercent,
      isBelowTarget: isMarginBelowTarget(percentDisplay, targetPercent) || margemContribuicao < 0,
    },
  };
}

export function buildQuoteFinancialStripFromBreakdown(
  breakdown: StoredPricingBreakdown | null | undefined,
  options: {
    totalCliente: number;
    discount?: number;
    faturamentoRatio?: number;
    targetMarginPercent?: number;
    modality?: 'lotacao' | 'fracionado';
  }
): QuoteFinancialStripModel | null {
  if (!breakdown || breakdown.status !== 'OK') return null;
  const ratio = options.faturamentoRatio ?? 1;
  const scale = (n: number | null | undefined) =>
    n != null && Number.isFinite(n) ? round2(n * ratio) : 0;

  const t = breakdown.totals;
  const p = breakdown.profitability;
  const c = breakdown.components;
  const m = breakdown.meta;
  const totalCliente = options.totalCliente;
  if (totalCliente <= 0) return null;

  const anttApplied = m?.anttCostBaseUsed === true || m?.anttFloorApplied === true;
  const pisoAntt = scale(m?.lotacaoPisoComOver ?? m?.anttPisoCarreteiro);
  const freteTabelaRef = scale(m?.fretePesoOriginal ?? m?.lotacaoFreteTabelaComOverKm);
  const motorista = scale(
    p?.custoMotoristaContratado ??
      (anttApplied && pisoAntt > 0 ? pisoAntt : (c?.baseCost ?? c?.baseFreight))
  );

  const receitaLiquida = scale(p?.receitaLiquida);
  const custoMotoristaGolden =
    anttApplied && pisoAntt > 0 ? pisoAntt : scale(c?.baseCost ?? c?.baseFreight);
  const margemContribuicao = resolveMargemBrutaDisplay(
    p?.margemBruta != null ? scale(p.margemBruta) : undefined,
    receitaLiquida,
    scale(p?.overhead),
    custoMotoristaGolden,
    scale(p?.custoServicos)
  );

  const custosDiretos = scale(p?.custosDiretos);
  const targetPercent =
    options.targetMarginPercent ??
    p?.profitMarginTarget ??
    breakdown.rates?.profitMarginPercent ??
    15;
  const lucroAlvo = resolveResultadoLiquidoDisplay(
    p?.resultadoLiquido != null ? scale(p.resultadoLiquido) : null,
    custosDiretos,
    targetPercent,
    margemContribuicao
  );
  const percentCd = custosDiretos > 0 ? round2((lucroAlvo / custosDiretos) * 100) : 0;
  const isLotacao =
    options.modality === 'lotacao' ||
    (options.modality !== 'fracionado' &&
      (m?.anttCostBaseUsed === true || m?.anttFloorApplied === true));
  const percentDisplay =
    isLotacao && custosDiretos > 0
      ? percentCd
      : totalCliente > 0
        ? round2((lucroAlvo / totalCliente) * 100)
        : 0;

  return {
    pag: {
      motorista,
      pedagio: scale(c?.toll),
      repasse: sumRiskRepasse({
        gris: scale(c?.gris),
        tso: scale(c?.tso),
        rctrc: scale(c?.rctrc),
        adValorem: scale(c?.adValorem),
      }),
      pisoAntt: pisoAntt > 0 ? pisoAntt : undefined,
      anttApplied,
      tabelaReferencia:
        anttApplied && freteTabelaRef > (pisoAntt || motorista) * 1.05 ? freteTabelaRef : undefined,
    },
    fat: {
      totalCliente: round2(totalCliente),
      receitaLiquida: receitaLiquida > 0 ? receitaLiquida : undefined,
      discount: (options.discount ?? 0) > 0 ? round2(options.discount ?? 0) : undefined,
      regimeFiscal: p?.regimeFiscal,
    },
    lucro: {
      alvo: lucroAlvo,
      percentCustosDiretos: percentDisplay,
      contribuicao: margemContribuicao,
      targetPercent,
      isBelowTarget: isMarginBelowTarget(percentDisplay, targetPercent) || margemContribuicao < 0,
    },
  };
}

export function buildQuoteFinancialStripLegacy(
  totalCliente: number,
  carreteiroReal: number
): QuoteFinancialStripModel {
  const spread = round2(totalCliente - carreteiroReal);
  return {
    pag: {
      motorista: round2(carreteiroReal),
      pedagio: 0,
      repasse: 0,
      anttApplied: false,
    },
    fat: { totalCliente: round2(totalCliente) },
    lucro: {
      alvo: spread,
      percentCustosDiretos: carreteiroReal > 0 ? round2((spread / carreteiroReal) * 100) : 0,
      targetPercent: 0,
      isBelowTarget: spread < 0,
    },
  };
}
