import type { Database } from '@/integrations/supabase/types';

type Client = Database['public']['Tables']['clients']['Row'];

export type NetworkDetectionMethod = 'cnpj-root' | 'trade-name' | 'name-prefix';

export type Network = {
  /** Canonical key — stable across re-renders for use as React key */
  id: string;
  /** Display label (best-effort: trade_name > common prefix > first unit name) */
  label: string;
  /** Which pass produced this network */
  detectionMethod: NetworkDetectionMethod;
  /** All clients that belong to this network (≥2) */
  units: Client[];
  unitCount: number;
  /** city → unit count, sorted desc by count then asc by city name */
  cityCounts: Array<{ city: string; count: number }>;
  /** Distinct UFs present in this network */
  states: string[];
};

export type NetworkDetectionResult = {
  /** Detected networks (size ≥ minUnits), sorted desc by unitCount */
  networks: Network[];
  /** Clients that did not match any network */
  soloUnits: Client[];
};

export type NetworkDetectionOptions = {
  /** Minimum unit count for a group to count as a "rede". Default 3. */
  minUnits?: number;
  /** Enable pass 3 (heuristic name-prefix grouping). Default true. */
  enableNamePrefixPass?: boolean;
};

/** Default minimum units to qualify a group as a "rede" */
export const DEFAULT_MIN_UNITS = 3;

/**
 * Tokens descartados como "primeira palavra significativa" do nome.
 * Mantemos termos genéricos brasileiros (artigos, preposições, sufixos jurídicos)
 * mas NÃO incluímos termos como ACADEMIA porque eles costumam fazer parte do
 * nome real da rede; em vez disso o pass 3 usa as 2 primeiras palavras como
 * chave, o que evita colisões entre redes diferentes que começam com
 * "ACADEMIA …".
 */
const STOPWORDS = new Set([
  'A',
  'AS',
  'O',
  'OS',
  'DE',
  'DA',
  'DO',
  'DOS',
  'DAS',
  'E',
  'EM',
  'NA',
  'NO',
  'LTDA',
  'SA',
  'ME',
  'EIRELI',
  'EPP',
  'MEI',
]);

/** Normalize: uppercase, strip accents, strip punctuation, collapse whitespace */
function normalizeName(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Returns first 8 digits of a CNPJ (the "raiz", same legal entity) or null */
function getCnpjRoot(cnpj: string | null | undefined): string | null {
  if (!cnpj) return null;
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return null;
  return digits.slice(0, 8);
}

/**
 * Returns the first N significant words concatenated as a key.
 * "BONY FIT ACADEMIA LTDA"        → "BONY FIT"
 * "ACADEMIA FORCA TOTAL"          → "ACADEMIA FORCA"
 * "ACADEMIA SUPER FIT"            → "ACADEMIA SUPER"
 *
 * Using 2 words avoids the false-positive of grouping every "ACADEMIA …"
 * client together by their first generic word.
 */
function getNamePrefixKey(s: string | null | undefined, maxWords = 2): string | null {
  if (!s) return null;
  const words = normalizeName(s)
    .split(' ')
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  if (words.length === 0) return null;
  return words.slice(0, maxWords).join(' ');
}

function countCities(units: Client[]): Network['cityCounts'] {
  const map = new Map<string, number>();
  units.forEach((c) => {
    if (!c.city) return;
    map.set(c.city, (map.get(c.city) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, 'pt-BR'));
}

function collectStates(units: Client[]): string[] {
  const set = new Set<string>();
  units.forEach((c) => {
    if (c.state) set.add(c.state);
  });
  return Array.from(set).sort();
}

/**
 * Picks the best display label for a network.
 * Priority:
 *   1) Most common non-empty `trade_name` among units (the "nome fantasia" is
 *      the de-facto brand name).
 *   2) First N normalized words shared across all unit names (the common stem).
 *   3) Fallback: name of the first unit.
 */
function pickBestLabel(units: Client[]): string {
  // 1) trade_name vote
  const tradeNameVotes = new Map<string, number>();
  units.forEach((c) => {
    if (!c.trade_name) return;
    const trimmed = c.trade_name.trim();
    if (!trimmed) return;
    tradeNameVotes.set(trimmed, (tradeNameVotes.get(trimmed) ?? 0) + 1);
  });
  if (tradeNameVotes.size > 0) {
    return Array.from(tradeNameVotes.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }

  // 2) longest common normalized prefix (word-level)
  const tokenLists = units
    .map((c) =>
      normalizeName(c.name ?? '')
        .split(' ')
        .filter(Boolean)
    )
    .filter((arr) => arr.length > 0);
  if (tokenLists.length > 0) {
    const minLen = Math.min(...tokenLists.map((t) => t.length));
    const common: string[] = [];
    for (let i = 0; i < minLen; i++) {
      const word = tokenLists[0][i];
      if (tokenLists.every((t) => t[i] === word)) {
        common.push(word);
      } else {
        break;
      }
    }
    if (common.length > 0) return common.join(' ');
  }

  // 3) fallback
  return units[0].name ?? '—';
}

function buildNetwork(
  id: string,
  units: Client[],
  detectionMethod: NetworkDetectionMethod
): Network {
  return {
    id,
    label: pickBestLabel(units),
    detectionMethod,
    units,
    unitCount: units.length,
    cityCounts: countCities(units),
    states: collectStates(units),
  };
}

/**
 * Detects networks using a 3-pass pipeline:
 *
 *   Pass 1: groups by CNPJ raiz (first 8 digits) — same legal entity, just
 *           filiais. 100% confidence.
 *
 *   Pass 2: among clients still unclaimed, groups by normalized `trade_name`.
 *           Same brand across distinct legal entities (franchising).
 *
 *   Pass 3: among clients still unclaimed, groups by the first 2 significant
 *           words of `name` (after stripping common Portuguese stopwords and
 *           legal suffixes). Heuristic — may produce false positives, e.g.
 *           "Smart Fit" and "Smart Fitness" colliding. Can be disabled via
 *           `enableNamePrefixPass: false` for conservative mode.
 *
 * A client is claimed by at most one network; once a unit joins a network in
 * pass 1, it is excluded from passes 2 and 3.
 *
 * Groups smaller than `minUnits` (default 3) are returned as `soloUnits`,
 * not as networks.
 */
export function detectNetworks(
  clients: Client[] | undefined | null,
  options: NetworkDetectionOptions = {}
): NetworkDetectionResult {
  const minUnits = options.minUnits ?? DEFAULT_MIN_UNITS;
  const enableNamePrefixPass = options.enableNamePrefixPass ?? true;

  if (!clients || clients.length === 0) {
    return { networks: [], soloUnits: [] };
  }

  const claimed = new Set<string>();
  const networks: Network[] = [];

  // ── Pass 1: CNPJ raiz ─────────────────────────────────────────────────────
  const byCnpjRoot = new Map<string, Client[]>();
  clients.forEach((c) => {
    const root = getCnpjRoot(c.cnpj);
    if (!root) return;
    const list = byCnpjRoot.get(root) ?? [];
    list.push(c);
    byCnpjRoot.set(root, list);
  });
  byCnpjRoot.forEach((units, root) => {
    if (units.length < minUnits) return;
    units.forEach((c) => claimed.add(c.id));
    networks.push(buildNetwork(`cnpj:${root}`, units, 'cnpj-root'));
  });

  // ── Pass 2: trade_name ────────────────────────────────────────────────────
  const byTradeName = new Map<string, Client[]>();
  clients.forEach((c) => {
    if (claimed.has(c.id)) return;
    if (!c.trade_name) return;
    const key = normalizeName(c.trade_name);
    if (!key) return;
    const list = byTradeName.get(key) ?? [];
    list.push(c);
    byTradeName.set(key, list);
  });
  byTradeName.forEach((units, key) => {
    if (units.length < minUnits) return;
    units.forEach((c) => claimed.add(c.id));
    networks.push(buildNetwork(`trade:${key}`, units, 'trade-name'));
  });

  // ── Pass 3: first 2 significant words of name (optional) ─────────────────
  if (enableNamePrefixPass) {
    const byNamePrefix = new Map<string, Client[]>();
    clients.forEach((c) => {
      if (claimed.has(c.id)) return;
      const key = getNamePrefixKey(c.name, 2);
      if (!key) return;
      const list = byNamePrefix.get(key) ?? [];
      list.push(c);
      byNamePrefix.set(key, list);
    });
    byNamePrefix.forEach((units, key) => {
      if (units.length < minUnits) return;
      units.forEach((c) => claimed.add(c.id));
      networks.push(buildNetwork(`prefix:${key}`, units, 'name-prefix'));
    });
  }

  // Sort networks by size (largest first), then by label
  networks.sort((a, b) => b.unitCount - a.unitCount || a.label.localeCompare(b.label, 'pt-BR'));

  const soloUnits = clients.filter((c) => !claimed.has(c.id));

  return { networks, soloUnits };
}
