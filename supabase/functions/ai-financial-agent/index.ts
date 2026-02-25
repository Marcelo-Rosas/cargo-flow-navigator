import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { callLLM } from '../_shared/aiClient.ts';
// ─────────────────────────────────────────────────────
// Pricing Constants (USD per 1M tokens) — OpenAI
// ─────────────────────────────────────────────────────
const MODEL_PRICING = {
  'gpt-4.1': {
    input: 2,
    output: 8,
  },
  'gpt-4.1-mini': {
    input: 0.4,
    output: 1.6,
  },
};
// ─────────────────────────────────────────────────────
// Model Routing — select cheapest viable model
// ─────────────────────────────────────────────────────
function selectModel(analysisType) {
  switch (analysisType) {
    // Complex reasoning → GPT-4.1
    case 'approval_summary':
    case 'dashboard_insights':
      return 'gpt-4.1';
    // Structured / simpler analysis → GPT-4.1-mini (80% cheaper)
    case 'quote_profitability':
    case 'financial_anomaly':
      return 'gpt-4.1-mini';
    default:
      return 'gpt-4.1-mini';
  }
}
// ─────────────────────────────────────────────────────
// Cost Estimation
// ─────────────────────────────────────────────────────
function estimateCost(model, usage) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4.1-mini'];
  const perMillion = 1_000_000;
  const inputCost = ((usage?.input_tokens || 0) / perMillion) * pricing.input;
  const outputCost = ((usage?.output_tokens || 0) / perMillion) * pricing.output;
  return inputCost + outputCost;
}
// ─────────────────────────────────────────────────────
// Budget Check
// ─────────────────────────────────────────────────────
async function checkBudget(sb) {
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
// Smart Triggering — check entity value thresholds
// ─────────────────────────────────────────────────────
async function shouldSkipAi(sb, analysisType, entityId) {
  try {
    // Get threshold configs
    const { data: configs } = await sb
      .from('ai_budget_config')
      .select('key, value')
      .in('key', ['min_quote_value_brl', 'min_financial_value_brl']);
    const configMap = {};
    for (const c of configs || []) {
      configMap[c.key] = Number(c.value);
    }
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
  return {
    skip: false,
  };
}
// ─────────────────────────────────────────────────────
// Response Cache Check
// ─────────────────────────────────────────────────────
async function getCachedInsight(sb, insightType, entityType, entityId) {
  try {
    let query = sb
      .from('ai_insights')
      .select('analysis, summary_text, created_at')
      .eq('insight_type', insightType)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', {
        ascending: false,
      })
      .limit(1);
    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);
    const { data } = await query;
    if (data && data.length > 0) {
      return data[0].analysis;
    }
  } catch {
    // Continue without cache
  }
  return null;
}
// ─────────────────────────────────────────────────────
// Usage Logging
// ─────────────────────────────────────────────────────
async function logUsage(sb, params) {
  try {
    await sb.from('ai_usage_tracking').insert({
      analysis_type: params.analysisType,
      model_used: params.model,
      input_tokens: params.usage?.input_tokens || 0,
      output_tokens: params.usage?.output_tokens || 0,
      cache_read_tokens: params.usage?.cache_read_input_tokens || 0,
      cache_creation_tokens: params.usage?.cache_creation_input_tokens || 0,
      estimated_cost_usd: params.costUsd,
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
// LLM Client wrapper (Anthropic + OpenAI failover)
// ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um analista financeiro especializado em logística de cargas para a empresa Vectra Cargo, uma transportadora brasileira.

Analise dados em BRL (R$). Seja conciso e objetivo. Sempre forneça:
1. **Avaliação de risco**: baixo / médio / alto
2. **Métricas principais**: números-chave identificados
3. **Recomendação**: ação sugerida (aprovar, revisar, rejeitar, investigar)

Responda SEMPRE em português brasileiro (pt-BR).
Formate a resposta em JSON com a estrutura:
{
  "risk": "baixo" | "medio" | "alto",
  "metrics": { ... },
  "recommendation": "texto da recomendação",
  "summary": "resumo de 2-3 linhas para exibição rápida"
}`;

async function analyzeWithLLM(userPrompt, model, analysisType, sb, entityType, entityId) {
  const startTime = Date.now();
  try {
    const result = await callLLM({
      prompt: userPrompt,
      system: SYSTEM_PROMPT,
      maxTokens: 1024,
      analysisType,
      entityType: entityType || null,
      entityId: entityId || null,
    });

    const durationMs = Date.now() - startTime;
    // Log successful call (reusing existing schema)
    await logUsage(sb, {
      analysisType,
      model,
      usage: null,
      costUsd: 0,
      status: 'success',
      entityType,
      entityId,
      durationMs,
    });

    return {
      text: result.text || 'Sem resposta da análise.',
      usage: null,
      model,
      costUsd: 0,
    };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const durationMs = Date.now() - startTime;
    await logUsage(sb, {
      analysisType,
      model,
      costUsd: 0,
      status: 'error',
      entityType,
      entityId,
      durationMs,
      errorMessage: err.message,
    });
    throw err;
  }
}
// ─────────────────────────────────────────────────────
// Parse JSON from Claude response
// ─────────────────────────────────────────────────────
function parseAnalysisJson(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch
      ? JSON.parse(jsonMatch[0])
      : {
          raw: text,
        };
  } catch {
    return {
      raw: text,
    };
  }
}
// ─────────────────────────────────────────────────────
// Analysis Handlers
// ─────────────────────────────────────────────────────
async function analyzeQuoteProfitability(entityId, model, sb) {
  // Fetch quote with all pricing data
  const { data: quote, error } = await sb.from('quotes').select('*').eq('id', entityId).single();
  if (error || !quote) throw new Error(`Quote not found: ${entityId}`);
  const breakdown = quote.pricing_breakdown;
  const profitability = breakdown?.profitability;
  const meta = breakdown?.meta;
  // Fetch historical data for comparison
  const { data: recentQuotes } = await sb
    .from('quotes')
    .select('value, pricing_breakdown')
    .eq('stage', 'ganho')
    .order('created_at', {
      ascending: false,
    })
    .limit(20);
  const historicalMargins = (recentQuotes || [])
    .map((q) => {
      const pb = q.pricing_breakdown;
      const prof = pb?.profitability;
      return prof?.margem_percent;
    })
    .filter((m) => m != null);
  const avgMargin =
    historicalMargins.length > 0
      ? historicalMargins.reduce((a, b) => a + b, 0) / historicalMargins.length
      : null;
  const prompt = `Analise a rentabilidade desta cotação de frete:

**Cotação**: ${quote.quote_code}
**Cliente**: ${quote.client_name}
**Rota**: ${quote.origin} → ${quote.destination}
**Distância**: ${quote.km_distance || 'N/A'} km
**Valor total**: R$ ${Number(quote.value || 0).toFixed(2)}

**Breakdown de Rentabilidade**:
- Custos carreteiro: R$ ${profitability?.custos_carreteiro || 'N/A'}
- Custos diretos: R$ ${profitability?.custos_diretos || 'N/A'}
- Margem bruta: R$ ${profitability?.margem_bruta || 'N/A'}
- Margem %: ${profitability?.margem_percent || 'N/A'}%
- Resultado líquido: R$ ${profitability?.resultado_liquido || 'N/A'}

**ANTT Piso**: R$ ${meta?.antt_piso_carreteiro || 'N/A'}
**Status margem**: ${meta?.margin_status || 'N/A'}

**Comparativo histórico**:
- Margem média das últimas 20 cotações ganhas: ${avgMargin ? avgMargin.toFixed(1) + '%' : 'Sem dados'}
- Total de cotações para comparação: ${historicalMargins.length}

Avalie se esta cotação é rentável, se está acima ou abaixo da média, e se o preço está adequado em relação ao piso ANTT.`;
  const result = await analyzeWithLLM(prompt, model, 'quote_profitability', sb, 'quote', entityId);
  const analysisJson = parseAnalysisJson(result.text);
  // Enrich with model/cost metadata
  analysisJson._model = result.model;
  analysisJson._cost_usd = result.costUsd;
  await sb.from('ai_insights').insert({
    insight_type: 'quote_profitability',
    entity_type: 'quote',
    entity_id: entityId,
    analysis: analysisJson,
    summary_text: analysisJson.summary || result.text.substring(0, 300),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  return analysisJson;
}
async function analyzeFinancialAnomaly(entityId, model, sb) {
  const { data: doc, error } = await sb
    .from('financial_documents')
    .select('*')
    .eq('id', entityId)
    .single();
  if (error || !doc) throw new Error(`Financial document not found: ${entityId}`);
  const { data: historicalDocs } = await sb
    .from('financial_documents')
    .select('total_amount, type, created_at')
    .eq('type', doc.type)
    .order('created_at', {
      ascending: false,
    })
    .limit(50);
  const historicalAmounts = (historicalDocs || [])
    .map((d) => Number(d.total_amount) || 0)
    .filter((a) => a > 0);
  const avgAmount =
    historicalAmounts.length > 0
      ? historicalAmounts.reduce((a, b) => a + b, 0) / historicalAmounts.length
      : 0;
  const maxAmount = historicalAmounts.length > 0 ? Math.max(...historicalAmounts) : 0;
  const minAmount = historicalAmounts.length > 0 ? Math.min(...historicalAmounts) : 0;
  const prompt = `Analise este documento financeiro em busca de anomalias:

**Documento**: ${doc.code || doc.id}
**Tipo**: ${doc.type} (${doc.type === 'FAT' ? 'A Receber' : 'A Pagar'})
**Valor**: R$ ${Number(doc.total_amount || 0).toFixed(2)}
**Status**: ${doc.status}
**Origem**: ${doc.source_type} (${doc.source_id})

**Dados históricos (${doc.type})**:
- Documentos analisados: ${historicalAmounts.length}
- Valor médio: R$ ${avgAmount.toFixed(2)}
- Valor mínimo: R$ ${minAmount.toFixed(2)}
- Valor máximo: R$ ${maxAmount.toFixed(2)}
- Desvio do valor atual: ${avgAmount > 0 ? (((Number(doc.total_amount) - avgAmount) / avgAmount) * 100).toFixed(1) : 'N/A'}%

Identifique se este documento apresenta anomalias (valor muito acima/abaixo da média, padrões incomuns).`;
  const result = await analyzeWithLLM(
    prompt,
    model,
    'financial_anomaly',
    sb,
    'financial_document',
    entityId
  );
  const analysisJson = parseAnalysisJson(result.text);
  analysisJson._model = result.model;
  analysisJson._cost_usd = result.costUsd;
  await sb.from('ai_insights').insert({
    insight_type: 'financial_anomaly',
    entity_type: 'financial_document',
    entity_id: entityId,
    analysis: analysisJson,
    summary_text: analysisJson.summary || result.text.substring(0, 300),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  return analysisJson;
}
async function generateApprovalSummary(entityId, entityType, model, sb) {
  let entityData = null;
  let contextInfo = '';
  if (entityType === 'financial_document') {
    const { data } = await sb.from('financial_documents').select('*').eq('id', entityId).single();
    entityData = data;
    if (data) {
      if (data.source_type === 'quote') {
        const { data: quote } = await sb
          .from('quotes')
          .select('quote_code, client_name, origin, destination, value, pricing_breakdown')
          .eq('id', data.source_id)
          .maybeSingle();
        if (quote) {
          contextInfo = `
Cotação relacionada: ${quote.quote_code}
Cliente: ${quote.client_name}
Rota: ${quote.origin} → ${quote.destination}
Valor da cotação: R$ ${Number(quote.value || 0).toFixed(2)}`;
        }
      }
      if (data.source_type === 'order') {
        const { data: order } = await sb
          .from('orders')
          .select('os_number, client_name, origin, destination, value, driver_name')
          .eq('id', data.source_id)
          .maybeSingle();
        if (order) {
          contextInfo = `
OS relacionada: ${order.os_number}
Cliente: ${order.client_name}
Rota: ${order.origin} → ${order.destination}
Valor: R$ ${Number(order.value || 0).toFixed(2)}
Motorista: ${order.driver_name || 'Não atribuído'}`;
        }
      }
    }
  }
  if (!entityData) throw new Error(`Entity not found: ${entityType}/${entityId}`);
  const prompt = `Gere um resumo executivo para aprovação gerencial:

**Documento para aprovação**:
${JSON.stringify(entityData, null, 2)}

**Contexto adicional**:
${contextInfo}

Forneça um resumo claro e objetivo para que o gerente possa tomar uma decisão rápida de aprovar ou rejeitar. Inclua os principais riscos e a sua recomendação.`;
  const result = await analyzeWithLLM(prompt, model, 'approval_summary', sb, entityType, entityId);
  const analysisJson = parseAnalysisJson(result.text);
  analysisJson._model = result.model;
  analysisJson._cost_usd = result.costUsd;
  // Update the approval request with AI analysis
  await sb
    .from('approval_requests')
    .update({
      ai_analysis: analysisJson,
    })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('status', 'pending');
  await sb.from('ai_insights').insert({
    insight_type: 'approval_summary',
    entity_type: entityType,
    entity_id: entityId,
    analysis: analysisJson,
    summary_text: analysisJson.summary || result.text.substring(0, 300),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  return analysisJson;
}
async function generateDashboardInsights(model, sb) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: quotes }, { data: orders }, { data: financialDocs }, { count: pendingApprovals }] =
    await Promise.all([
      sb.from('quotes').select('stage, value, created_at').gte('created_at', thirtyDaysAgo),
      sb.from('orders').select('stage, value, created_at').gte('created_at', thirtyDaysAgo),
      sb
        .from('financial_documents')
        .select('type, status, total_amount, created_at')
        .gte('created_at', thirtyDaysAgo),
      sb
        .from('approval_requests')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('status', 'pending'),
    ]);
  const quotesByStage = {};
  let totalQuoteValue = 0;
  for (const q of quotes || []) {
    quotesByStage[q.stage] = (quotesByStage[q.stage] || 0) + 1;
    totalQuoteValue += Number(q.value) || 0;
  }
  const ordersByStage = {};
  for (const o of orders || []) {
    ordersByStage[o.stage] = (ordersByStage[o.stage] || 0) + 1;
  }
  const totalQuotes = (quotes || []).length;
  const wonQuotes = quotesByStage['ganho'] || 0;
  const conversionRate = totalQuotes > 0 ? ((wonQuotes / totalQuotes) * 100).toFixed(1) : '0';
  let totalReceivable = 0;
  let totalPayable = 0;
  for (const fd of financialDocs || []) {
    if (fd.type === 'FAT') totalReceivable += Number(fd.total_amount) || 0;
    if (fd.type === 'PAG') totalPayable += Number(fd.total_amount) || 0;
  }
  const prompt = `Analise os dados operacionais dos últimos 30 dias da Vectra Cargo e gere insights executivos:

**Pipeline Comercial (30 dias)**:
- Total de cotações: ${totalQuotes}
- Cotações por stage: ${JSON.stringify(quotesByStage)}
- Valor total das cotações: R$ ${totalQuoteValue.toFixed(2)}
- Taxa de conversão: ${conversionRate}%

**Operações**:
- Total de ordens: ${(orders || []).length}
- Ordens por stage: ${JSON.stringify(ordersByStage)}

**Financeiro**:
- Total a receber (FAT): R$ ${totalReceivable.toFixed(2)}
- Total a pagar (PAG): R$ ${totalPayable.toFixed(2)}
- Resultado bruto estimado: R$ ${(totalReceivable - totalPayable).toFixed(2)}
- Documentos financeiros gerados: ${(financialDocs || []).length}

**Aprovações pendentes**: ${pendingApprovals || 0}

Gere 3-5 insights acionáveis. Foque em oportunidades de melhoria, gargalos operacionais e alertas importantes.

Retorne um JSON com a estrutura:
{
  "risk": "baixo|medio|alto",
  "insights": [
    { "type": "opportunity|warning|alert", "title": "...", "description": "..." }
  ],
  "metrics": { "conversion_rate": ..., "revenue": ..., "margin": ... },
  "recommendation": "...",
  "summary": "..."
}`;
  const result = await analyzeWithLLM(
    prompt,
    model,
    'dashboard_insights',
    sb,
    undefined,
    undefined
  );
  const analysisJson = parseAnalysisJson(result.text);
  analysisJson._model = result.model;
  analysisJson._cost_usd = result.costUsd;
  await sb.from('ai_insights').insert({
    insight_type: 'dashboard_insights',
    entity_type: null,
    entity_id: null,
    analysis: analysisJson,
    summary_text: analysisJson.summary || result.text.substring(0, 300),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  return analysisJson;
}
// ─────────────────────────────────────────────────────
// HTTP Handler
// ─────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          error: 'Method not allowed',
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON body',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }
    if (!body?.analysisType) {
      return new Response(
        JSON.stringify({
          error: 'Missing analysisType',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }
    // 1. Budget check — block if over budget
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
      return new Response(
        JSON.stringify({
          success: false,
          error: 'AI budget exceeded',
          budget: {
            daily_pct: budget.daily_pct,
            monthly_pct: budget.monthly_pct,
            alert: budget.alert,
          },
          fallback: {
            risk: 'medio',
            summary: 'Análise AI indisponível — budget excedido. Revisão manual recomendada.',
            recommendation: 'Revisar manualmente',
          },
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }
    // 2. Smart triggering — skip AI for low-value entities
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
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: skipCheck.reason,
            analysis: {
              risk: 'baixo',
              summary: `Análise AI não necessária: ${skipCheck.reason}`,
              recommendation: 'Valor dentro da faixa normal — aprovação automática sugerida.',
            },
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'content-type': 'application/json',
            },
          }
        );
      }
    }
    // 3. Response cache check — reuse valid analysis
    const insightTypeMap = {
      quote_profitability: 'quote_profitability',
      financial_anomaly: 'financial_anomaly',
      approval_summary: 'approval_summary',
      dashboard_insights: 'dashboard_insights',
    };
    const cachedInsight = await getCachedInsight(
      sb,
      insightTypeMap[body.analysisType],
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
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          analysis: cachedInsight,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'content-type': 'application/json',
          },
        }
      );
    }
    // 4. Select model based on analysis type
    const model = selectModel(body.analysisType);
    // 5. Execute analysis
    let result;
    switch (body.analysisType) {
      case 'quote_profitability':
        result = await analyzeQuoteProfitability(body.entityId, model, sb);
        break;
      case 'financial_anomaly':
        result = await analyzeFinancialAnomaly(body.entityId, model, sb);
        break;
      case 'approval_summary':
        result = await generateApprovalSummary(body.entityId, body.entityType, model, sb);
        break;
      case 'dashboard_insights':
        result = await generateDashboardInsights(model, sb);
        break;
      default:
        return new Response(
          JSON.stringify({
            error: `Unknown analysisType: ${body.analysisType}`,
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'content-type': 'application/json',
            },
          }
        );
    }
    return new Response(
      JSON.stringify({
        success: true,
        analysis: result,
        budget: budget.alert
          ? {
              alert: true,
              daily_pct: budget.daily_pct,
              monthly_pct: budget.monthly_pct,
            }
          : undefined,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'content-type': 'application/json',
        },
      }
    );
  } catch (e) {
    console.error('ai-financial-agent error:', e);
    await logUsage(sb, {
      analysisType: 'unknown',
      model: 'unknown',
      costUsd: 0,
      status: 'error',
      errorMessage: String(e),
    });
    return new Response(
      JSON.stringify({
        error: String(e),
        provider: 'llm',
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
