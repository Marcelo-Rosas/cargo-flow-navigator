// Shared helper for edge-function-to-edge-function calls (server-side).

const Deno = (globalThis as any).Deno;

/** Clean env var value (strip surrounding quotes/newlines). */
function cleanEnv(value: string): string {
  return value
    .trim()
    .replace(/^['"]+/, '')
    .replace(/['"]+$/, '');
}

export async function callEdgeFunction(
  functionName: string,
  body: Record<string, unknown> | undefined
): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const serviceRoleKeyClean = cleanEnv(serviceRoleKey);

  // The Supabase gateway requires the `apikey` header to identify the project.
  // Without it, the gateway ignores Authorization and returns "Missing authorization header".
  const apikey = anonKey ? cleanEnv(anonKey) : serviceRoleKeyClean;

  const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKeyClean}`,
      apikey: apikey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Worker ${functionName} failed (${res.status}): ${errText}`);
  }

  return res.json();
}
