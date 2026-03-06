const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireSeedEnv(): void {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para usar o PostgREST client de seed.'
    );
  }
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
  requireSeedEnv();
  const normalizedBase = SUPABASE_URL!.replace(/\\/g, '/').replace(/\/+$/, '');
  const url = `${normalizedBase.replace(/\/$/, '')}/rest/v1/${table}${query}`;

  const response = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
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
