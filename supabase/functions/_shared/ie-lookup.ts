// @ts-nocheck
/**
 * Inscrição Estadual lookup por CNPJ + UF via SintegrAPI.
 *
 * GET https://api.sintegrapi.com.br/consultas/v2/sintegra/{cnpj}?uf=XX
 * Header: x-api-key: <SINTEGRA_API_KEY>
 *
 * Classifica: IE ativa na UF → contribuinte (ie_indicator=1 + IE).
 * Nenhuma IE ativa na UF → não-contribuinte (ie_indicator=9).
 * Degrada para null em qualquer falha (sem travar emissão).
 */

export interface IeLookupResult {
  ie: string | null;
  uf: string;
  ativa: boolean;
  /** true quando não há IE ativa na UF (não-contribuinte de ICMS). */
  naoContribuinte: boolean;
  razaoSocial?: string;
}

const API_BASE = 'https://api.sintegrapi.com.br/consultas/v2/sintegra';
const memCache = new Map<string, IeLookupResult>();

function normalizeCnpj(c: string | null | undefined): string {
  return (c ?? '').replace(/\D/g, '');
}

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 8000
): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(t);
    return res;
  } catch {
    return null;
  }
}

/**
 * Resolve a IE ativa de um CNPJ na UF informada. Retorna null se não
 * configurado (sem API key), CNPJ/UF inválidos, ou falha de rede.
 */
export async function lookupIeByCnpj(
  cnpjInput: string,
  ufInput: string
): Promise<IeLookupResult | null> {
  const cnpj = normalizeCnpj(cnpjInput);
  const uf = (ufInput ?? '').toUpperCase().slice(0, 2);
  if (cnpj.length !== 14 || uf.length !== 2) return null;

  const cacheKey = `${cnpj}:${uf}`;
  const cached = memCache.get(cacheKey);
  if (cached) return cached;

  const apiKey = Deno.env.get('SINTEGRA_API_KEY');
  if (!apiKey) return null;

  const url = `${API_BASE}/${cnpj}?uf=${uf}&cache_strategy=ONLINE_PREFERENCIAL`;
  const res = await fetchWithTimeout(url, { 'x-api-key': apiKey });
  if (!res?.ok) return null;

  let json: Record<string, unknown>;
  try {
    json = await res.json();
  } catch {
    return null;
  }
  if (!json?.success) return null;

  const ies = Array.isArray(json.inscricoes_estaduais)
    ? (json.inscricoes_estaduais as Array<Record<string, unknown>>)
    : [];
  const active =
    ies.find((x) => String(x?.uf).toUpperCase() === uf && x?.ativa === true) ??
    ies.find((x) => x?.ativa === true);

  const razaoSocial = typeof json.razao_social === 'string' ? json.razao_social : undefined;

  const result: IeLookupResult =
    active?.inscricao_estadual != null
      ? {
          ie: String(active.inscricao_estadual),
          uf,
          ativa: true,
          naoContribuinte: false,
          razaoSocial,
        }
      : { ie: null, uf, ativa: false, naoContribuinte: true, razaoSocial };

  memCache.set(cacheKey, result);
  return result;
}
