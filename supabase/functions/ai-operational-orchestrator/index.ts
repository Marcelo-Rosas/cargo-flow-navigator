import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { callEdgeFunction } from '../_shared/edgeFunctionClient.ts';
import { type DriverQualificationWorkerResult } from '../_shared/workers/driverQualificationWorker.ts';
import { type OperationalReportData } from '../_shared/workers/operationalReportWorker.ts';
import { type ParsedArticle } from '../_shared/workers/regulatoryUpdateWorker.ts';
import { type OperationalInsightsData } from '../_shared/workers/operationalInsightsWorker.ts';

// callWorker delegates to shared callEdgeFunction (workers are edge functions)
function callWorker(workerName: string, body: Record<string, unknown>) {
  return callEdgeFunction(workerName, body);
}

// ─────────────────────────────────────────────────────
// Model Routing
// ─────────────────────────────────────────────────────
function selectModel(analysisType: string): string {
  switch (analysisType) {
    case 'compliance_check':
      return 'gpt-4.1';
    case 'driver_qualification':
    case 'stage_gate_validation':
    case 'operational_insights':
    case 'operational_report':
    case 'regulatory_update':
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
// Pre-Fetch Helpers
// ─────────────────────────────────────────────────────
const ORDER_DRIVER_FIELDS = [
  'id',
  'os_number',
  'driver_name',
  'driver_phone',
  'driver_cnh',
  'driver_antt',
  'vehicle_plate',
  'vehicle_brand',
  'vehicle_model',
  'vehicle_type_name',
  'owner_name',
  'owner_phone',
  'has_cnh',
  'has_crlv',
  'has_comp_residencia',
  'has_antt_motorista',
].join(', ');

async function fetchOrderForDriverQual(sb: any, orderId: string) {
  const { data: order, error } = await sb
    .from('orders')
    .select(ORDER_DRIVER_FIELDS)
    .eq('id', orderId)
    .single();
  if (error || !order) throw new Error(`Order not found: ${orderId}`);
  return order;
}

async function fetchOrderForStageGate(sb: any, orderId: string) {
  const { data: order, error } = await sb.from('orders').select('*').eq('id', orderId).single();
  if (error || !order) throw new Error(`Order not found: ${orderId}`);
  return order;
}

async function fetchOrderAndQuote(sb: any, orderId: string) {
  const { data: order, error } = await sb.from('orders').select('*').eq('id', orderId).single();
  if (error || !order) throw new Error(`Order not found: ${orderId}`);

  let quote: any = null;
  if (order.quote_id) {
    const { data } = await sb
      .from('quotes')
      .select('*, pricing_breakdown')
      .eq('id', order.quote_id)
      .single();
    quote = data;
  }

  const [{ data: paymentProofs }, { data: reconciliation }] = await Promise.all([
    sb
      .from('payment_proofs')
      .select('id, amount, expected_amount, proof_type, status')
      .eq('order_id', orderId),
    sb
      .from('v_order_payment_reconciliation' as never)
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle(),
  ]);

  const orderEnriched = {
    ...order,
    payment_proofs: paymentProofs || [],
    reconciliation: reconciliation || null,
  };

  return { order: orderEnriched, quote };
}

function getPeriodStart(reportType: 'daily' | 'weekly'): string {
  const hours = reportType === 'daily' ? 24 : 7 * 24;
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

async function fetchOperationalReportData(
  sb: any,
  reportType: 'daily' | 'weekly'
): Promise<OperationalReportData> {
  const periodStart = getPeriodStart(reportType);
  const [
    { data: allOrders },
    { data: createdOrders },
    { data: completedOrders },
    { data: occurrences },
    { data: complianceChecks },
    { count: pendingDocsCount },
  ] = await Promise.all([
    sb.from('orders').select('stage, created_at, value'),
    sb.from('orders').select('id').gte('created_at', periodStart),
    sb
      .from('orders')
      .select('id, created_at')
      .eq('stage', 'entregue')
      .gte('created_at', periodStart),
    sb.from('occurrences').select('severity, status, created_at').gte('created_at', periodStart),
    sb
      .from('compliance_checks')
      .select('status, violation_type, created_at')
      .gte('created_at', periodStart),
    sb.from('order_documents').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);
  return {
    allOrders: allOrders || [],
    createdOrders: createdOrders || [],
    completedOrders: completedOrders || [],
    occurrences: occurrences || [],
    complianceChecks: complianceChecks || [],
    pendingDocsCount: pendingDocsCount || 0,
  };
}

async function fetchOperationalInsightsData(sb: any): Promise<OperationalInsightsData> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [
    { data: orders },
    { data: occurrences },
    { data: complianceChecks },
    { data: driverQualifications },
  ] = await Promise.all([
    sb
      .from('orders')
      .select('id, stage, value, created_at, origin, destination, carreteiro_real, carreteiro_antt')
      .gte('created_at', thirtyDaysAgo),
    sb
      .from('occurrences')
      .select('severity, status, type, created_at, resolved_at, order_id')
      .gte('created_at', thirtyDaysAgo),
    sb
      .from('compliance_checks')
      .select('status, violation_type, entity_type, created_at')
      .gte('created_at', thirtyDaysAgo),
    sb
      .from('driver_qualifications')
      .select('driver_id, status, expires_at, qualification_type')
      .gte('created_at', thirtyDaysAgo),
  ]);
  return {
    orders: orders || [],
    occurrences: occurrences || [],
    complianceChecks: complianceChecks || [],
    driverQualifications: driverQualifications || [],
  };
}

// Regulatory scraping helpers
const SOURCE_URLS = [
  'https://www.portalntc.org.br/noticias/',
  'https://www.portalntc.org.br/categoria/artigos-tecnicos/',
];

async function fetchHtml(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'VectraCargo-RegulatoryBot/1.0' },
    });
    if (!response.ok) return '';
    return await response.text();
  } catch {
    return '';
  }
}

function parseArticles(html: string, sourceUrl: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const linkPattern = /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();
    if (!url || !title) continue;
    articles.push({ title, url, date: null, source: sourceUrl });
  }
  const datePattern =
    /(\d{1,2})\s*(?:de\s+)?(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:de\s+)?(\d{4})/gi;
  const dateMatches = [...html.matchAll(datePattern)];
  for (let i = 0; i < Math.min(articles.length, dateMatches.length); i++) {
    articles[i].date = dateMatches[i][0];
  }
  return articles;
}

async function fetchAndFilterArticles(sb: any): Promise<ParsedArticle[]> {
  const htmlResults = await Promise.all(SOURCE_URLS.map(fetchHtml));
  const allArticles: ParsedArticle[] = [];
  for (let i = 0; i < SOURCE_URLS.length; i++) {
    if (htmlResults[i]) allArticles.push(...parseArticles(htmlResults[i], SOURCE_URLS[i]));
  }
  if (allArticles.length === 0) return [];

  const urls = allArticles.map((a) => a.url);
  const { data: existingUrls } = await sb
    .from('regulatory_updates')
    .select('source_url')
    .in('source_url', urls);
  const processedSet = new Set((existingUrls || []).map((r: any) => r.source_url));
  return allArticles.filter((a) => !processedSet.has(a.url)).slice(0, 10);
}

// ─────────────────────────────────────────────────────
// Post-Persist Helpers
// ─────────────────────────────────────────────────────
async function persistDriverQualification(
  sb: any,
  orderId: string,
  result: DriverQualificationWorkerResult
) {
  const { data: existing } = await sb
    .from('driver_qualifications')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (existing) {
    await sb
      .from('driver_qualifications')
      .update(result.driver_qualification_data)
      .eq('id', existing.id);
  } else {
    await sb.from('driver_qualifications').insert(result.driver_qualification_data);
  }
  await sb.from('ai_insights').insert(result.ai_insight_data);
}

async function persistComplianceResults(sb: any, result: any) {
  await Promise.all([
    sb.from('compliance_checks').insert(result.compliance_check_data),
    sb.from('ai_insights').insert(result.ai_insight_data),
  ]);
}

async function persistOperationalReport(sb: any, result: any) {
  await sb.from('operational_reports').insert(result.operational_report_data);
}

async function persistRegulatoryUpdates(sb: any, result: any) {
  if (result.regulatory_updates_data.length > 0) {
    await sb.from('regulatory_updates').insert(result.regulatory_updates_data);
  }
}

async function persistOperationalInsights(sb: any, result: any) {
  await sb.from('ai_insights').insert(result.ai_insight_data);
}

// ─────────────────────────────────────────────────────
// Notification Routing
// entity-bound  → notification_logs
// broadcast     → notification_queue
// ─────────────────────────────────────────────────────
async function persistNotifications(sb: any, analysisType: string, notifications: any[]) {
  if (!notifications || notifications.length === 0) return;
  try {
    if (
      ['driver_qualification', 'compliance_check', 'stage_gate_validation'].includes(analysisType)
    ) {
      for (const n of notifications) {
        await sb.from('notification_logs').insert({
          template_key: n.template_key,
          channel: n.channel,
          recipient_phone: n.recipient_phone || null,
          status: n.status || 'pending',
          entity_type: n.entity_type,
          entity_id: n.entity_id,
          metadata: n.metadata || n.payload || null,
        });
      }
    } else {
      for (const n of notifications) {
        await sb.from('notification_queue').insert({
          template: n.template,
          channel: n.channel,
          payload: n.payload,
          status: n.status || 'pending',
          created_at: n.created_at || new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.error('Failed to persist notifications:', e);
  }
}

// ─────────────────────────────────────────────────────
// HTTP Handler — Operational Orchestrator
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
    const needsLLM =
      body.analysisType !== 'stage_gate_validation' &&
      (body.analysisType !== 'regulatory_update' || !!body.analyzeContent);

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

    // 2. Cache check (entity-bound analysis types only)
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

    // 3. Select model + previous insights (for entity-bound types)
    const model = selectModel(body.analysisType);
    const previousInsights = await fetchPreviousInsights(
      sb,
      body.entityType || null,
      body.entityId || null
    );

    const orderId = body.entityId || body.orderId;

    // 4. Pre-fetch + dispatch to worker via HTTP + post-persist
    let workerResult: any;

    switch (body.analysisType) {
      case 'driver_qualification': {
        const orderData = await fetchOrderForDriverQual(sb, orderId);
        workerResult = await callWorker('ai-driver-qualification-worker', {
          orderData,
          model,
          previousInsights,
        });
        await persistDriverQualification(sb, orderId, workerResult);
        await persistNotifications(sb, 'driver_qualification', workerResult.notifications);
        break;
      }

      case 'stage_gate_validation': {
        const orderData = await fetchOrderForStageGate(sb, orderId);
        workerResult = await callWorker('ai-stage-gate-worker', {
          orderData,
          targetStage: body.targetStage,
        });
        await persistNotifications(sb, 'stage_gate_validation', workerResult.notifications);
        break;
      }

      case 'compliance_check': {
        const { order, quote } = await fetchOrderAndQuote(sb, orderId);
        workerResult = await callWorker('ai-compliance-check-worker', {
          orderData: order,
          quoteData: quote,
          checkType: body.checkType || 'pre_coleta',
          model,
          previousInsights,
        });
        await persistComplianceResults(sb, workerResult);
        await persistNotifications(sb, 'compliance_check', workerResult.notifications);
        break;
      }

      case 'operational_report': {
        const operationalData = await fetchOperationalReportData(sb, body.reportType || 'daily');
        workerResult = await callWorker('ai-operational-report-worker', {
          operationalData,
          reportType: body.reportType || 'daily',
          model,
        });
        await persistOperationalReport(sb, workerResult);
        await persistNotifications(sb, 'operational_report', workerResult.notifications);
        break;
      }

      case 'regulatory_update': {
        const articles = await fetchAndFilterArticles(sb);
        if (articles.length === 0) {
          workerResult = {
            analysisSummary: { new_articles: 0, high_relevance_count: 0 },
            durationMs: 0,
            provider: 'none',
            notifications: [],
            regulatory_updates_data: [],
          };
        } else {
          workerResult = await callWorker('ai-regulatory-update-worker', {
            articlesToProcess: articles,
            model,
          });
          await persistRegulatoryUpdates(sb, workerResult);
          await persistNotifications(sb, 'regulatory_update', workerResult.notifications);
        }
        break;
      }

      case 'operational_insights': {
        const operationalData = await fetchOperationalInsightsData(sb);
        workerResult = await callWorker('ai-operational-insights-worker', {
          operationalData,
          model,
        });
        await persistOperationalInsights(sb, workerResult);
        break;
      }

      default:
        return jsonResponse(
          { error: `Unknown analysisType: ${body.analysisType}` },
          400,
          corsHeaders
        );
    }

    // 5. Log success
    const finalAnalysis = workerResult.analysis ?? workerResult.analysisSummary ?? {};
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
        analysis: finalAnalysis,
        provider: workerResult.provider,
        ...(workerResult.notifications?.length
          ? { notifications: workerResult.notifications }
          : {}),
      },
      200,
      corsHeaders
    );
  } catch (e) {
    console.error('ai-operational-orchestrator error:', e);
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
