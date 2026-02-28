import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { callEdgeFunction } from '../_shared/edgeFunctionClient.ts';

// ─────────────────────────────────────────────────────
// Model Routing
// ─────────────────────────────────────────────────────
function selectModel(analysisType: string): string {
  switch (analysisType) {
    case 'approval_summary':
    case 'dashboard_insights':
      return 'gpt-4.1';
    case 'quote_profitability':
    case 'financial_anomaly':
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
// Smart Triggering
// ─────────────────────────────────────────────────────
async function shouldSkipAi(sb: any, analysisType: string, entityId: string) {
  try {
    const { data: configs } = await sb
      .from('ai_budget_config')
      .select('key, value')
      .in('key', ['min_quote_value_brl', 'min_financial_value_brl']);
    const configMap: Record<string, number> = {};
    for (const c of configs || []) configMap[c.key] = Number(c.value);

    if (analysisType === 'quote_profitability') {
      const minValue = configMap['min_quote_value_brl'] || 5000;
      const { data: quote } = await sb
        .from('quotes')
        .select('value')
        .eq('id', entityId)
        .maybeSingle();
      if (quote && Number(quote.value) < minValue) {
        return {
          skip: true,
          reason: `Quote value R$ ${quote.value} below threshold R$ ${minValue}`,
        };
      }
    }
    if (analysisType === 'financial_anomaly') {
      const minValue = configMap['min_financial_value_brl'] || 10000;
      const { data: doc } = await sb
        .from('financial_documents')
        .select('total_amount')
        .eq('id', entityId)
        .maybeSingle();
      if (doc && Number(doc.total_amount) < minValue) {
        return {
          skip: true,
          reason: `Document value R$ ${doc.total_amount} below threshold R$ ${minValue}`,
        };
      }
    }
  } catch (e) {
    console.warn('Smart triggering check failed:', e);
  }
  return { skip: false };
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

// callWorker delegates to shared callEdgeFunction (workers are edge functions)
function callWorker(workerName: string, body: Record<string, unknown>) {
  return callEdgeFunction(workerName, body);
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
// HTTP Handler
// ─────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

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

    // 1. Budget check
    const budget = await checkBudget(sb);
    if (!budget.allowed) {
      await logUsage(sb, {
        analysisType: body.analysisType,
        model: selectModel(body.analysisType),
        costUsd: 0,
        status: 'budget_exceeded',
        entityType: body.entityType,
        entityId: body.entityId,
        errorMessage: `Daily remaining: $${budget.daily_remaining.toFixed(4)}, Monthly remaining: $${budget.monthly_remaining.toFixed(4)}`,
      });
      return jsonResponse(
        {
          success: false,
          error: 'AI budget exceeded',
          budget: {
            daily_pct: budget.daily_pct,
            monthly_pct: budget.monthly_pct,
            alert: budget.alert,
          },
          fallback: {
            risk: 'medio',
            summary: 'Analise AI indisponivel — budget excedido. Revisao manual recomendada.',
            recommendation: 'Revisar manualmente',
          },
        },
        200,
        corsHeaders
      );
    }

    // 2. Smart triggering
    if (body.entityId && body.analysisType !== 'dashboard_insights') {
      const skipCheck = await shouldSkipAi(sb, body.analysisType, body.entityId);
      if (skipCheck.skip) {
        await logUsage(sb, {
          analysisType: body.analysisType,
          model: 'none',
          costUsd: 0,
          status: 'cached',
          entityType: body.entityType,
          entityId: body.entityId,
          errorMessage: skipCheck.reason,
        });
        return jsonResponse(
          {
            success: true,
            skipped: true,
            reason: skipCheck.reason,
            analysis: {
              risk: 'baixo',
              summary: `Analise AI nao necessaria: ${skipCheck.reason}`,
              recommendation: 'Valor dentro da faixa normal — aprovacao automatica sugerida.',
            },
          },
          200,
          corsHeaders
        );
      }
    }

    // 3. Cache check
    const cachedInsight = await getCachedInsight(
      sb,
      body.analysisType,
      body.entityType || null,
      body.entityId || null
    );
    if (cachedInsight) {
      await logUsage(sb, {
        analysisType: body.analysisType,
        model: 'cache',
        costUsd: 0,
        status: 'cached',
        entityType: body.entityType,
        entityId: body.entityId,
      });
      return jsonResponse(
        { success: true, cached: true, analysis: cachedInsight },
        200,
        corsHeaders
      );
    }

    // 4. Select model + fetch previous insights (parallel)
    const model = selectModel(body.analysisType);
    const previousInsights = await fetchPreviousInsights(
      sb,
      body.entityType || null,
      body.entityId || null
    );

    // 5. Route to independent worker Edge Function
    let workerResult: any;
    switch (body.analysisType) {
      case 'quote_profitability':
        workerResult = await callWorker('ai-quote-profitability-worker', {
          entityId: body.entityId,
          model,
          previousInsights,
        });
        break;
      case 'financial_anomaly':
        workerResult = await callWorker('ai-financial-anomaly-worker', {
          entityId: body.entityId,
          model,
          previousInsights,
        });
        break;
      case 'approval_summary':
        workerResult = await callWorker('ai-approval-summary-worker', {
          entityId: body.entityId,
          entityType: body.entityType,
          model,
          previousInsights,
        });
        break;
      case 'dashboard_insights':
        workerResult = await callWorker('ai-dashboard-insights-worker', { model });
        break;
      default:
        return jsonResponse(
          { error: `Unknown analysisType: ${body.analysisType}` },
          400,
          corsHeaders
        );
    }

    // 6. Log success
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
        budget: budget.alert
          ? { alert: true, daily_pct: budget.daily_pct, monthly_pct: budget.monthly_pct }
          : undefined,
      },
      200,
      corsHeaders
    );
  } catch (e) {
    console.error('ai-orchestrator-agent error:', e);
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
