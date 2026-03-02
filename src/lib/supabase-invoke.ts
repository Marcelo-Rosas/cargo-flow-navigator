import { supabase } from '@/integrations/supabase/client';

/**
 * Invoca uma Edge Function do Supabase garantindo a injeção do token de sessão.
 * Realiza o refresh do token automaticamente caso a sessão atual não o possua.
 */
export async function invokeEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData?.session?.access_token;

  if (!token) {
    const { data: refreshData } = await supabase.auth.refreshSession();
    token = refreshData?.session?.access_token ?? undefined;
  }

  if (!token) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const { data, error } = await supabase.functions.invoke<T>(functionName, {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) throw error;

  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }

  return data as T;
}
