// @ts-nocheck
/**
 * IBGE municipality code lookup from CEP.
 *
 * Strategy: ViaCEP first (returns ibge directly), then BrasilAPI v1 fallback.
 * No persistent cache here — invocation-scoped in-memory only. Add a
 * cache table if call volume becomes a concern.
 */

export interface IbgeLookupResult {
  ibge_code: number;
  uf: string;
  municipio: string;
  bairro?: string;
  logradouro?: string;
}

const memCache = new Map<string, IbgeLookupResult>();

function normalizeCep(cep: string): string {
  return cep.replace(/\D/g, '');
}

async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    return res;
  } catch {
    return null;
  }
}

async function viaCep(cep: string): Promise<IbgeLookupResult | null> {
  const res = await fetchWithTimeout(`https://viacep.com.br/ws/${cep}/json/`);
  if (!res?.ok) return null;
  const json = await res.json();
  if (json.erro || !json.ibge) return null;
  return {
    ibge_code: Number(json.ibge),
    uf: json.uf,
    municipio: json.localidade,
    bairro: json.bairro,
    logradouro: json.logradouro,
  };
}

async function brasilApiV1(cep: string): Promise<IbgeLookupResult | null> {
  const res = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v1/${cep}`);
  if (!res?.ok) return null;
  const json = await res.json();
  // v1 includes "ibge" inside an unstable "addresses" shape — best-effort
  const ibge = json.ibge ?? json.city_ibge ?? null;
  if (!ibge || !json.state || !json.city) return null;
  return {
    ibge_code: Number(ibge),
    uf: json.state,
    municipio: json.city,
    bairro: json.neighborhood,
    logradouro: json.street,
  };
}

/**
 * Resolve CEP → IBGE/UF/municipio. Returns null if not resolvable.
 */
export async function lookupIbgeByCep(cepInput: string): Promise<IbgeLookupResult | null> {
  const cep = normalizeCep(cepInput);
  if (cep.length !== 8) return null;

  const cached = memCache.get(cep);
  if (cached) return cached;

  const result = (await viaCep(cep)) ?? (await brasilApiV1(cep));
  if (result) memCache.set(cep, result);
  return result;
}

/**
 * Batch resolve multiple CEPs in parallel. Failures yield null entries.
 */
export async function lookupIbgeBatch(ceps: string[]): Promise<Array<IbgeLookupResult | null>> {
  return Promise.all(ceps.map((c) => lookupIbgeByCep(c)));
}
