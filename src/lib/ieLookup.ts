/**
 * Consulta de Inscrição Estadual (IE) por CNPJ + UF.
 *
 * A SintegrAPI exige uma API key server-side, então o frontend chama a Edge
 * Function `lookup-ie` (que valida o JWT e encapsula a key). Espelha o papel
 * do `cnpjLookup.ts`, mas via Edge em vez de API pública.
 */
import { invokeEdgeFunction } from '@/lib/edgeFunctions';

export interface IeLookupResult {
  ie: string | null;
  uf: string;
  ativa: boolean;
  /** true quando não há IE ativa na UF (não-contribuinte de ICMS). */
  naoContribuinte: boolean;
  razaoSocial?: string;
}

/**
 * Resolve a IE ativa de um CNPJ na UF. Retorna null quando CNPJ/UF inválidos
 * ou a consulta falha (degrada silenciosamente — não bloqueia o formulário).
 */
export async function lookupIe(rawCnpj: string, uf: string): Promise<IeLookupResult | null> {
  const cnpj = (rawCnpj ?? '').replace(/\D/g, '');
  const ufNorm = (uf ?? '').toUpperCase().slice(0, 2);
  if (cnpj.length !== 14 || ufNorm.length !== 2) return null;

  try {
    const result = await invokeEdgeFunction<IeLookupResult | { error: string }>('lookup-ie', {
      body: { cnpj, uf: ufNorm },
    });
    if (!result || 'error' in result) return null;
    return result as IeLookupResult;
  } catch {
    return null;
  }
}
