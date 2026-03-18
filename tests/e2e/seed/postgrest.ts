function requireSeedEnv(): { url: string; key: string } {
  // ✅ Leitura lazy — garante que dotenv já injetou as vars antes de usar
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para usar o PostgREST client de seed.'
    );
  }

  return { url, key };
}

export type PostgrestMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface PostgrestOptions<TBody = unknown> {
  method: PostgrestMethod;
  table: string;
  query?: string;
  body?: TBody;
}

export async function postgrest<T = unknown>({
  method,
  table,
  query = '',
  body,
}: PostgrestOptions): Promise<T> {
  const { url, key } = requireSeedEnv();

  const normalizedBase = url.replace(/\\/g, '/').replace(/\/+$/, '');
  const fullUrl = `${normalizedBase}/rest/v1/${table}${query}`;

  const response = await fetch(fullUrl, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : undefined;

  if (response.status >= 400) {
    throw new Error(
      `PostgREST ${method} ${table} falhou (${response.status}): ${text || 'sem resposta'}`
    );
  }

  return parsed as T;
}
