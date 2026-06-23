// @ts-nocheck
/**
 * CFOP resolver for CT-e (transporte rodoviário de cargas, regime Normal/LP).
 *
 * Decision tree (transportadora emitente — CT-e modelo 57):
 *
 * Step 1 — Is prestation starting in the UF where the carrier is registered?
 *   - YES (ufOrigem == ufEmitente):
 *       intraestadual (ufOrigem == ufDestino):
 *         contribuinte (indIE=1)        → 5353
 *         não-contribuinte (indIE=2|9)  → 5357
 *       interestadual (ufOrigem != ufDestino):
 *         contribuinte                  → 6353
 *         não-contribuinte              → 6357
 *   - NO (ufOrigem != ufEmitente — Vectra registered in SC but cargo picked
 *         up elsewhere, e.g. SP → GO):
 *       always interestadual (origin ≠ Vectra UF):
 *         contribuinte                  → 6932 (transporte iniciado em UF
 *                                          diversa do estabelecimento inscrito)
 *         não-contribuinte              → 6932 (Brazilian states accept 6932
 *                                          for both; some prefer 6359 for
 *                                          não-contribuinte but 6932 is the
 *                                          safe default — Active uses 6932)
 *
 * Out of scope (até serem necessários): 5403/6403 (ST), 5949/6949 (outras
 * saídas), 7353/7949 (exportação), retorno (1353/2353), 5359 (não-contribuinte
 * intraestadual específico).
 *
 * Reference: Convênio SINIEF 06/89 + RICMS/SC + caso CT-e 577 Vectra (6932 SP→GO).
 */

export type IndicadorIE = 1 | 2 | 9;

export interface CfopInput {
  ufOrigem: string;
  ufDestino: string;
  /** UF where the carrier (emitente) is registered (e.g. Vectra=SC). */
  ufEmitente: string;
  tomadorIndicadorIE: IndicadorIE;
}

export function resolveCfopCte(input: CfopInput): number {
  const ufOrigem = input.ufOrigem.toUpperCase();
  const ufDestino = input.ufDestino.toUpperCase();
  const ufEmitente = input.ufEmitente.toUpperCase();

  // Origin outside carrier's UF — always 6932 regardless of destination
  if (ufOrigem !== ufEmitente) return 6932;

  const intraestadual = ufOrigem === ufDestino;
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
    case 6932:
      return 'Prestação de serviço iniciada em UF diversa do estabelecimento inscrito';
    default:
      return `CFOP ${cfop}`;
  }
}
