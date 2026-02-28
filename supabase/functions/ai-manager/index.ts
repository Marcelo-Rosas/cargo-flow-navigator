import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { callEdgeFunction } from '../_shared/edgeFunctionClient.ts';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

type TaskName =
  | 'quote_profitability'
  | 'financial_anomaly'
  | 'approval_summary'
  | 'dashboard_insights'
  | 'driver_qualification'
  | 'compliance_check'
  | 'stage_gate_validation'
  | 'operational_report'
  | 'operational_insights'
  | 'regulatory_update';

interface AiManagerRequest {
  task: TaskName;
  entityType?: string | null;
  entityId?: string | null;
  params?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function requireAuthHeader(req: Request): string {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) throw new Error('Missing Authorization header');
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error('Invalid Authorization header (expected Bearer token)');
  return m[1];
}

async function edgeAuthOrThrow(jwt: string) {
  // Edge Auth: validate the user JWT using the project's ANON key.
  // Downstream internal calls use service role (server-to-server).
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data, error } = await sb.auth.getUser(jwt);
  if (error || !data?.user) {
    throw new Error('Unauthorized');
  }

  return { userId: data.user.id };
}

function routeTask(task: TaskName): { router: string; fn: string; analysisType: string } {
  const general: TaskName[] = [
    'quote_profitability',
    'financial_anomaly',
    'approval_summary',
    'dashboard_insights',
  ];

  if (general.includes(task)) {
    return { router: 'ai-orchestrator-agent', fn: 'ai-orchestrator-agent', analysisType: task };
  }

  return {
    router: 'ai-operational-orchestrator',
    fn: 'ai-operational-orchestrator',
    analysisType: task,
  };
}

function buildDownstreamBody(body: AiManagerRequest): Record<string, unknown> {
  const params = body.params || {};

  // Normalize task → analysisType expected by downstream orchestrators.
  const base: Record<string, unknown> = {
    analysisType: body.task,
    entityType: body.entityType ?? undefined,
    entityId: body.entityId ?? undefined,
    ...params,
  };

  // Operational orchestrator sometimes expects orderId.
  // Keep both when entityType is order or when caller provides entityId.
  if (
    body.task === 'driver_qualification' ||
    body.task === 'compliance_check' ||
    body.task === 'stage_gate_validation'
  ) {
    if (body.entityId && !('orderId' in base)) base.orderId = body.entityId;
  }

  return base;
}

// ─────────────────────────────────────────────────────
// HTTP Handler
// ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    if (req.method !== 'POST')
      return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);

    // 1) Edge Auth
    const jwt = requireAuthHeader(req);
    const authInfo = await edgeAuthOrThrow(jwt);

    // 2) Parse body
    let body: AiManagerRequest;
    try {
      body = (await req.json()) as AiManagerRequest;
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, corsHeaders);
    }

    if (!body?.task) return jsonResponse({ error: 'Missing task' }, 400, corsHeaders);

    // 3) Route
    const route = routeTask(body.task);
    const downstreamBody = buildDownstreamBody(body);

    // 4) Call downstream
    const startedAt = Date.now();
    const downstreamResult = (await callEdgeFunction(route.fn, downstreamBody)) as any;
    const durationMs = Date.now() - startedAt;

    // 5) Normalize response
    return jsonResponse(
      {
        success: !!downstreamResult?.success,
        router: route.router,
        task: body.task,
        entityType: body.entityType ?? null,
        entityId: body.entityId ?? null,
        cached: downstreamResult?.cached ?? false,
        skipped: downstreamResult?.skipped ?? false,
        analysis: downstreamResult?.analysis ?? null,
        notifications: downstreamResult?.notifications ?? [],
        meta: {
          provider: downstreamResult?.provider ?? null,
          durationMs: downstreamResult?.durationMs ?? durationMs,
          userId: authInfo.userId,
        },
      },
      200,
      corsHeaders
    );
  } catch (e) {
    const msg = (e as Error).message || String(e);
    const status = msg === 'Unauthorized' || msg.includes('Authorization') ? 401 : 500;
    return jsonResponse({ success: false, error: msg }, status, corsHeaders);
  }
});
