/**
 * Piso mínimo ANTT (Lei 13.703/2018) — paridade com calculadorafrete.antt.gov.br
 * Paridade obrigatória com src/lib/antt-floor-calc.ts
 */

export type AnttOperationTable = 'A' | 'B' | 'C' | 'D';

export const ANTT_CARGO_TYPE_DEFAULT = 'carga_geral' as const;

export interface AnttFloorFlags {
  composicaoVeicular: boolean;
  altoDesempenho: boolean;
  retornoVazio: boolean;
}

export const ANTT_FLOOR_DEFAULT_FLAGS: AnttFloorFlags = {
  composicaoVeicular: true,
  altoDesempenho: false,
  retornoVazio: false,
};

export function resolveAnttOperationTable(flags: AnttFloorFlags): AnttOperationTable {
  if (flags.composicaoVeicular) {
    return flags.altoDesempenho ? 'C' : 'A';
  }
  return flags.altoDesempenho ? 'D' : 'B';
}

export function calculateAnttPisoBrl(params: {
  kmDistance: number;
  ccd: number;
  cc: number;
  retornoVazio: boolean;
}): { ida: number; retornoVazio: number; total: number } {
  const km = Math.max(0, params.kmDistance);
  const ida = km * params.ccd + params.cc;
  const retorno = params.retornoVazio ? km * params.ccd : 0;
  return {
    ida,
    retornoVazio: retorno,
    total: ida + retorno,
  };
}
