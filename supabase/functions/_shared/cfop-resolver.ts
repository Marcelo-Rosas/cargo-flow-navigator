// @ts-nocheck
/**
 * CFOP resolver for CT-e (transporte rodoviário de cargas, regime Normal/LP).
 *
 * Decision matrix (transportadora prestadora — CT-e modelo 57):
 *
 *   Tomador contribuinte ICMS (indIE=1):
 *     mesma UF  → 5353   (prestação intraestadual)
 *     UF distinta → 6353 (prestação interestadual)
 *
 *   Tomador contribuinte isento ou não-contribuinte (indIE=2 ou 9):
 *     mesma UF  → 5357
 *     UF distinta → 6357
 *
 * Out of scope (caso entrem depois): 5359/6359 (não-contribuinte específico),
 * 5403/6403 (substituição tributária), 5949/6949 (outras saídas), 7353/7949
 * (exportação), retorno (1353/2353).
 *
 * Reference: Convênio SINIEF 06/89 + RICMS/SC.
 */

export type IndicadorIE = 1 | 2 | 9;

export interface CfopInput {
  ufOrigem: string;
  ufDestino: string;
  tomadorIndicadorIE: IndicadorIE;
}

export function resolveCfopCte(input: CfopInput): number {
  const intraestadual = input.ufOrigem.toUpperCase() === input.ufDestino.toUpperCase();
  const contribuinte = input.tomadorIndicadorIE === 1;

  if (contribuinte) return intraestadual ? 5353 : 6353;
  return intraestadual ? 5357 : 6357;
}

/**
 * Describe the resolved CFOP for audit/log.
 */
export function describeCfop(cfop: number): string {
  switch (cfop) {
    case 5353:
      return 'Prestação de serviço de transporte a contribuinte (intraestadual)';
    case 6353:
      return 'Prestação de serviço de transporte a contribuinte (interestadual)';
    case 5357:
      return 'Prestação de serviço de transporte a não-contribuinte (intraestadual)';
    case 6357:
      return 'Prestação de serviço de transporte a não-contribuinte (interestadual)';
    default:
      return `CFOP ${cfop}`;
  }
}
