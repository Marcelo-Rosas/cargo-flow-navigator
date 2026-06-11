/**
 * Paridade com src/lib/antt-cargo-type-map.ts (Edge Functions).
 */

import { ANTT_CARGO_TYPE_DEFAULT } from './antt-floor-calc.ts';

export const ANTT_CARGO_TYPES = [
  'granel_solido',
  'granel_liquido',
  'frigorificada',
  'conteinerizada',
  'carga_geral',
  'neogranel',
  'pressurizada',
  'perigosa_granel_solido',
  'perigosa_granel_liquido',
  'perigosa_frigorificada',
  'perigosa_conteinerizada',
  'perigosa_carga_geral',
  'perigosa_neogranel',
  'perigosa_pressurizada',
] as const;

export type AnttCargoType = (typeof ANTT_CARGO_TYPES)[number];

const ANTT_CARGO_TYPE_SET = new Set<string>(ANTT_CARGO_TYPES);

const VEHICLE_BODY_TERMS =
  /\b(graneleiro|grade\s*baixa|sider|ba[uú]|bau|bitrem|rodotrem|carreta|truck|bitruck|vanderleia|cacamba|caçamba|tanque\s*rodovi[aá]rio)\b/i;

function normalizeCargoLabel(raw: string): string {
  return raw.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

export function isAnttCargoType(value: string | null | undefined): value is AnttCargoType {
  return !!value && ANTT_CARGO_TYPE_SET.has(value);
}

function isPerigosaHint(text: string): boolean {
  return (
    /\bperigos[ao]?\b/.test(text) ||
    /\bonu\b/.test(text) ||
    /\binflam/.test(text) ||
    /\btoxi/.test(text) ||
    /\bradioativ/.test(text) ||
    /\bcorrosiv/.test(text) ||
    /\bexplosiv/.test(text)
  );
}

export function resolveAnttCargoTypeFromLabel(cargoTypeLabel?: string | null): AnttCargoType {
  const raw = (cargoTypeLabel ?? '').trim();
  if (!raw) return ANTT_CARGO_TYPE_DEFAULT;

  if (isAnttCargoType(raw)) return raw;

  const text = normalizeCargoLabel(raw);
  if (isAnttCargoType(text)) return text as AnttCargoType;

  const perigosa = isPerigosaHint(text);

  if (/\bpressurizad/.test(text) || /\bgranel\s*pressurizad/.test(text)) {
    return perigosa ? 'perigosa_pressurizada' : 'pressurizada';
  }
  if (/\bneogranel\b/.test(text)) {
    return perigosa ? 'perigosa_neogranel' : 'neogranel';
  }
  if (/\bconteiner|container\b/.test(text)) {
    return perigosa ? 'perigosa_conteinerizada' : 'conteinerizada';
  }
  if (/\bfrigor|refrig|aquecid|resfriad|congelad/.test(text)) {
    return perigosa ? 'perigosa_frigorificada' : 'frigorificada';
  }
  if (
    /\bgranel\s*liquid/.test(text) ||
    /\bliquido\b/.test(text) ||
    /\boleo\b/.test(text) ||
    /\betanol\b/.test(text) ||
    /\bcombustivel\b/.test(text)
  ) {
    return perigosa ? 'perigosa_granel_liquido' : 'granel_liquido';
  }
  if (
    /\bgranel\s*solid/.test(text) ||
    /\bgraos?\b/.test(text) ||
    /\bsoja\b/.test(text) ||
    /\bmilho\b/.test(text) ||
    /\btrigo\b/.test(text) ||
    /\bfarelo\b/.test(text) ||
    /\bminerio\b/.test(text) ||
    (/\bgranel\b/.test(text) && !VEHICLE_BODY_TERMS.test(text))
  ) {
    return perigosa ? 'perigosa_granel_solido' : 'granel_solido';
  }

  if (perigosa) return 'perigosa_carga_geral';

  return ANTT_CARGO_TYPE_DEFAULT;
}

export function resolveAnttCargoTypeForPiso(params: {
  anttCargoType?: string | null;
  storedAnttCargoType?: string | null;
  cargoTypeLabel?: string | null;
}): AnttCargoType {
  if (isAnttCargoType(params.anttCargoType)) return params.anttCargoType;
  if (isAnttCargoType(params.storedAnttCargoType)) return params.storedAnttCargoType;
  return resolveAnttCargoTypeFromLabel(params.cargoTypeLabel);
}
