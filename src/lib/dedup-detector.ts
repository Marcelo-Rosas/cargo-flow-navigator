import type { Database } from '@/integrations/supabase/types';

type Client = Database['public']['Tables']['clients']['Row'];

export type DuplicateReason = 'cnpj-exact' | 'name-city' | 'cnpj-root-city';

export type DuplicateConfidence = 'high' | 'medium';

export type DuplicateGroup = {
  /** Stable key for the group (used for ignore-list and React keys) */
  id: string;
  reason: DuplicateReason;
  reasonLabel: string;
  reasonConfidence: DuplicateConfidence;
  /** All client records in this duplicate group (≥2) */
  clients: Client[];
};

/** Normalize a string for fuzzy matching (uppercase, no accents, no punct, single space) */
function normalize(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCnpjDigits(cnpj: string | null | undefined): string | null {
  if (!cnpj) return null;
  const d = cnpj.replace(/\D/g, '');
  return d.length === 14 ? d : null;
}

function getCnpjRoot(cnpj: string | null | undefined): string | null {
  const d = getCnpjDigits(cnpj);
  return d ? d.slice(0, 8) : null;
}

/**
 * Detects probable duplicate client records using a 3-pass pipeline.
 *
 *   Pass 1 — CNPJ idêntico: same 14-digit CNPJ. 100% confidence (literally
 *            the same legal entity registered twice).
 *
 *   Pass 2 — Nome + cidade: among unclaimed records, normalize `name` and
 *            `city` (uppercase, strip accents/punct). If two records match on
 *            both, they're a probable duplicate (typo or re-registration).
 *
 *   Pass 3 — CNPJ raiz + cidade: among unclaimed records, group by the first
 *            8 digits of the CNPJ (same parent company) plus the same city.
 *            Likely the same physical filial registered twice with different
 *            order numbers.
 *
 * Each client is claimed by at most one group. Groups smaller than 2 are
 * dropped (they aren't duplicates).
 *
 * Pass `ignoredGroupIds` to suppress groups already marked "not duplicates"
 * by the user — typically loaded from localStorage.
 */
export function detectDuplicates(
  clients: Client[] | undefined | null,
  ignoredGroupIds: Set<string> = new Set()
): DuplicateGroup[] {
  if (!clients || clients.length === 0) return [];

  const claimed = new Set<string>();
  const groups: DuplicateGroup[] = [];

  // ── Pass 1: CNPJ idêntico ────────────────────────────────────────────────
  const byCnpj = new Map<string, Client[]>();
  clients.forEach((c) => {
    const cnpj = getCnpjDigits(c.cnpj);
    if (!cnpj) return;
    const list = byCnpj.get(cnpj) ?? [];
    list.push(c);
    byCnpj.set(cnpj, list);
  });
  byCnpj.forEach((list, cnpj) => {
    if (list.length < 2) return;
    const id = `cnpj:${cnpj}`;
    if (ignoredGroupIds.has(id)) return;
    list.forEach((c) => claimed.add(c.id));
    groups.push({
      id,
      reason: 'cnpj-exact',
      reasonLabel: 'CNPJ idêntico',
      reasonConfidence: 'high',
      clients: list,
    });
  });

  // ── Pass 2: nome + cidade ────────────────────────────────────────────────
  const byNameCity = new Map<string, Client[]>();
  clients.forEach((c) => {
    if (claimed.has(c.id)) return;
    if (!c.name || !c.city) return;
    const key = `${normalize(c.name)}|${normalize(c.city)}`;
    if (!key.replace('|', '')) return;
    const list = byNameCity.get(key) ?? [];
    list.push(c);
    byNameCity.set(key, list);
  });
  byNameCity.forEach((list, key) => {
    if (list.length < 2) return;
    const id = `name-city:${key}`;
    if (ignoredGroupIds.has(id)) return;
    list.forEach((c) => claimed.add(c.id));
    groups.push({
      id,
      reason: 'name-city',
      reasonLabel: 'Nome + cidade iguais',
      reasonConfidence: 'medium',
      clients: list,
    });
  });

  // ── Pass 3: CNPJ raiz + cidade ───────────────────────────────────────────
  const byRootCity = new Map<string, Client[]>();
  clients.forEach((c) => {
    if (claimed.has(c.id)) return;
    const root = getCnpjRoot(c.cnpj);
    if (!root || !c.city) return;
    const key = `${root}|${normalize(c.city)}`;
    const list = byRootCity.get(key) ?? [];
    list.push(c);
    byRootCity.set(key, list);
  });
  byRootCity.forEach((list, key) => {
    if (list.length < 2) return;
    const id = `root-city:${key}`;
    if (ignoredGroupIds.has(id)) return;
    list.forEach((c) => claimed.add(c.id));
    groups.push({
      id,
      reason: 'cnpj-root-city',
      reasonLabel: 'Mesma raiz de CNPJ na mesma cidade',
      reasonConfidence: 'medium',
      clients: list,
    });
  });

  // Sort: high-confidence first, then by group size desc
  const order: Record<DuplicateConfidence, number> = { high: 0, medium: 1 };
  groups.sort(
    (a, b) =>
      order[a.reasonConfidence] - order[b.reasonConfidence] || b.clients.length - a.clients.length
  );

  return groups;
}

/** Returns the suggested "primary" client of a duplicate group: the most
 * recently updated record (or, if tied, the most recently created). The user
 * can override before confirming the merge. */
export function suggestPrimary(group: DuplicateGroup): Client {
  return [...group.clients].sort((a, b) => {
    const aT = a.updated_at ? Date.parse(a.updated_at) : 0;
    const bT = b.updated_at ? Date.parse(b.updated_at) : 0;
    if (aT !== bT) return bT - aT;
    const aC = a.created_at ? Date.parse(a.created_at) : 0;
    const bC = b.created_at ? Date.parse(b.created_at) : 0;
    return bC - aC;
  })[0];
}
