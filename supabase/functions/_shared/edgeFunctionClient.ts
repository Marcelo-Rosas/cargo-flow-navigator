/**
 * Shared client for invoking other Edge Functions from within Edge Functions.
 * Uses service role key for server-to-server calls.
 */
export async function callEdgeFunction(
  fnName: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/${fnName}`;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      ...(anonKey ? { apikey: anonKey } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Edge function ${fnName} failed (${res.status}): ${text}`);
  }
  return res.json();
}
