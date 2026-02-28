/**
 * ai-financial-agent — backward-compatibility wrapper
 *
 * @deprecated Use ai-orchestrator-agent directly. Frontend has been migrated.
 * Toda a lógica de orquestração foi migrada para `ai-orchestrator-agent`.
 * Este wrapper garante que chamadas existentes (workflow-orchestrator, front-end)
 * continuem funcionando sem alteração de URL.
 */
import { getCorsHeaders } from '../_shared/cors.ts';

type DenoLike = {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const deno = (globalThis as unknown as { Deno: DenoLike }).Deno;

deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS')
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  try {
    const body = await req.text();
    const res = await fetch(`${deno.env.get('SUPABASE_URL')}/functions/v1/ai-orchestrator-agent`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body,
    });
    const data = await res.text();
    return new Response(data, {
      status: res.status,
      headers: {
        ...corsHeaders,
        'content-type': 'application/json',
      },
    });
  } catch (e) {
    console.error('ai-financial-agent (wrapper) error:', e);
    return new Response(
      JSON.stringify({
        error: String(e),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'content-type': 'application/json',
        },
      }
    );
  }
});
