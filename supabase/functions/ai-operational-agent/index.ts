import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { executeDriverQualificationWorker } from '../_shared/workers/driverQualificationWorker.ts';
import { executeStageGateWorker } from '../_shared/workers/stageGateWorker.ts';
import { executeComplianceCheckWorker } from '../_shared/workers/complianceCheckWorker.ts';
import { executeOperationalReportWorker } from '../_shared/workers/operationalReportWorker.ts';
import { executeRegulatoryUpdateWorker } from '../_shared/workers/regulatoryUpdateWorker.ts';
import { executeOperationalInsightsWorker } from '../_shared/workers/operationalInsightsWorker.ts';

// ─────────────────────────────────────────────────────
// Model Routing
// ─────────────────────────────────────────────────────
function selectModel(analysisType: string): string {
  switch (analysisType) {
    case 'compliance_check':
    case 'operational_report':
      return 'gpt-4.1';
    case 'driver_qualification':
    case 'stage_gate_validation':
    case 'operational_insights':
    case 'regulatory_update':
      return 'gpt-4.1-mini';
    default:
      return 'gpt-4.1-mini';
  }
}

// ─────────────────────────────────────────────────────
// Budget Check
// ─────────────────────────────────────────────────────
async function checkBudget(sb: any) {
  try {
    const { data, error } = await sb.rpc('check_ai_budget');
    if (error) {
      console.warn('Budget check failed, allowing by default:', error.message);
      return {
        allowed: true,
        daily_remaining: 999,
        monthly_remaining: 999,
        daily_pct: 0,
        monthly_pct: 0,
        alert: false,
      };
    }
    return data;
  } catch {
    return {
      allowed: true,
      daily_remaining: 999,
      monthly_remaining: 999,
      daily_pct: 0,
      monthly_pct: 0,
      alert: false,
    };
  }
}

// ─────────────────────────────────────────────────────
// Cache Check
// ─────────────────────────────────────────────────────
async function getCachedInsight(
  sb: any,
  insightType: string,
  entityType: string | null,
  entityId: string | null
) {
  try {
    let query = sb
      .from('ai_insights')
      .select('analysis, summary_text, created_at')
      .eq('insight_type', insightType)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);
    const { data } = await query;
    if (data && data.length > 0) return data[0].analysis;
  } catch {
    /* continue without cache */
  }
  return null;
}

// ─────────────────────────────────────────────────────
// Context Enrichment
// ─────────────────────────────────────────────────────
async function fetchPreviousInsights(
  sb: any,
  entityType: string | null,
  entityId: string | null
): Promise<string | undefined> {
  if (!entityType || !entityId) return undefined;
  try {
    const { data } = await sb
      .from('ai_insights')
      .select('analysis, created_at, insight_type')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(3);
    if (!data || data.length === 0) return undefined;
    return data
      .map((row: any) => {
        const date = new Date(row.created_at).toLocaleDateString('pt-BR');
        const risk = row.analysis?.risk || '?';
        const summary = row.analysis?.summary || '';
        return `- ${date} (${row.insight_type}): Risco ${risk}. ${summary.substring(0, 120)}`;
      })
      .join('\n');
  } catch {
    return undefined;
  }
}

// ─────────────────────────────────────────────────────
// Usage Logging
// ─────────────────────────────────────────────────────
async function logUsage(sb: any, params: Record<string, any>) {
  try {
    await sb.from('ai_usage_tracking').insert({
      analysis_type: params.analysisType,
      model_used: params.model,
      input_tokens: params.usage?.input_tokens || 0,
      output_tokens: params.usage?.output_tokens || 0,
      cache_read_tokens: params.usage?.cache_read_input_tokens || 0,
      cache_creation_tokens: params.usage?.cache_creation_input_tokens || 0,
      estimated_cost_usd: params.costUsd ?? 0,
      status: params.status,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      duration_ms: params.durationMs || null,
      error_message: params.errorMessage || null,
    });
  } catch (e) {
    console.error('Failed to log AI usage:', e);
  }
}

// ─────────────────────────────────────────────────────
// JSON Response Helper
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

// ─────────────────────────────────────────────────────
// HTTP Handler — Operational Agent Orchestrator
// ─────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, corsHeaders);
    }

    if (!body?.analysisType) {
      return jsonResponse({ error: 'Missing analysisType' }, 400, corsHeaders);
    }

    // 1. Budget check (skip for non-LLM tasks like regulatory_update scraping)
    const needsLLM = body.analysisType !== 'regulatory_update' || body.analyzeContent;
    if (needsLLM) {
      const budget = await checkBudget(sb);
      if (!budget.allowed) {
        await logUsage(sb, {
          analysisType: body.analysisType,
          model: selectModel(body.analysisType),
          costUsd: 0,
          status: 'budget_exceeded',
          entityType: body.entityType,
          entityId: body.entityId,
          errorMessage: `Daily remaining: $${budget.daily_remaining.toFixed(4)}`,
        });
        return jsonResponse(
          {
            success: false,
            error: 'AI budget exceeded',
            budget: { daily_pct: budget.daily_pct, monthly_pct: budget.monthly_pct },
          },
          200,
          corsHeaders
        );
      }
    }

    // 2. Cache check (for entity-bound analysis types)
    const cacheable = ['driver_qualification', 'compliance_check', 'operational_insights'];
    if (cacheable.includes(body.analysisType) && body.entityId) {
      const cached = await getCachedInsight(
        sb,
        body.analysisType,
        body.entityType || 'order',
        body.entityId
      );
      if (cached) {
        await logUsage(sb, {
          analysisType: body.analysisType,
          model: 'cache',
          costUsd: 0,
          status: 'cached',
          entityType: body.entityType,
          entityId: body.entityId,
        });
        return jsonResponse({ success: true, cached: true, analysis: cached }, 200, corsHeaders);
      }
    }

    // 3. Select model + fetch context
    const model = selectModel(body.analysisType);
    const previousInsights = await fetchPreviousInsights(
      sb,
      body.entityType || null,
      body.entityId || null
    );

    // 4. Route to specialized worker
    let workerResult: any;
    switch (body.analysisType) {
      case 'driver_qualification':
        workerResult = await executeDriverQualificationWorker({
          orderId: body.entityId || body.orderId,
          model,
          sb,
          previousInsights,
        });
        break;
      case 'stage_gate_validation':
        workerResult = await executeStageGateWorker({
          orderId: body.entityId || body.orderId,
          targetStage: body.targetStage,
          model,
          sb,
        });
        break;
      case 'compliance_check':
        workerResult = await executeComplianceCheckWorker({
          orderId: body.entityId || body.orderId,
          checkType: body.checkType || 'pre_coleta',
          model,
          sb,
          previousInsights,
        });
        break;
      case 'operational_report':
        workerResult = await executeOperationalReportWorker({
          reportType: body.reportType || 'daily',
          model,
          sb,
        });
        break;
      case 'regulatory_update':
        workerResult = await executeRegulatoryUpdateWorker({ model, sb });
        break;
      case 'operational_insights':
        workerResult = await executeOperationalInsightsWorker({ model, sb });
        break;
      default:
        return jsonResponse(
          { error: `Unknown analysisType: ${body.analysisType}` },
          400,
          corsHeaders
        );
    }

    // 5. Log success
    await logUsage(sb, {
      analysisType: body.analysisType,
      model,
      costUsd: 0,
      status: 'success',
      entityType: body.entityType,
      entityId: body.entityId,
      durationMs: workerResult.durationMs,
    });

    return jsonResponse(
      {
        success: true,
        analysis: workerResult.analysis,
        provider: workerResult.provider,
        ...(workerResult.notifications ? { notifications: workerResult.notifications } : {}),
      },
      200,
      corsHeaders
    );
  } catch (e) {
    console.error('ai-operational-agent error:', e);
    await logUsage(sb, {
      analysisType: 'unknown',
      model: 'unknown',
      costUsd: 0,
      status: 'error',
      errorMessage: String(e),
    });
    return jsonResponse({ error: String(e) }, 500, corsHeaders);
  }
});
