// supabase/functions/ai-orchestrator-agent/index.ts

const Deno = (globalThis as any).Deno;

export async function callEdgeFunction(
  functionName: string,
  body: Record<string, unknown> | undefined
): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  // Env vars sometimes come with surrounding quotes/newlines; normalize.
  const serviceRoleKeyClean = serviceRoleKey
    .trim()
    .replace(/^['"]+/, '')
    .replace(/['"]+$/, '');

  const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      // For internal function-to-function calls, authenticate with `apikey`.
      // Avoid sending `Authorization: Bearer <service_role>` because in some gateway
      // configs it may be validated as a user JWT and rejected.
      apikey: serviceRoleKeyClean,
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
