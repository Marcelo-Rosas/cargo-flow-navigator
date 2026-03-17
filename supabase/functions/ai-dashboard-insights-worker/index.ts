// supabase/functions/ai-dashboard-insights-worker/index.ts

import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '../_shared/cors.ts';
import { callGemini, type GeminiModel } from '../_shared/gemini.ts';

const Deno = (globalThis as any).Deno;

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const start = Date.now();

  try {
    const { model = 'gemini-2.0-flash' }: { model: GeminiModel } = await req.json();

    // Buscar dados do CFN
    const [{ data: quotes }, { data: orders }, { data: financial }] = await Promise.all([
      sb
        .from('quotes')
        .select('id, status, total_value, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      sb
        .from('service_orders')
        .select('id, status, freight_value, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      sb
        .from('financial_entries')
        .select('type, amount, status, category, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const prompt = `Você é o assistente financeiro da Vectra Cargo, transportadora de Navegantes/SC.
Analise os dados abaixo do TMS e responda SOMENTE com JSON válido neste formato:
{
  "risk": "baixo" | "medio" | "alto",
  "summary": "resumo em 2 frases",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "recommendation": "ação principal recomendada",
  "alerts": ["alerta urgente se houver"] 
}

Dados do período:
- Cotações recentes (${quotes?.length ?? 0}): ${JSON.stringify(quotes?.slice(0, 10))}
- Ordens de serviço (${orders?.length ?? 0}): ${JSON.stringify(orders?.slice(0, 10))}
- Lançamentos financeiros (${financial?.length ?? 0}): ${JSON.stringify(financial?.slice(0, 15))}

Foque em: tendências de receita, cotações não convertidas, anomalias, e oportunidades.`;

    const { text, usage } = await callGemini(prompt, model);

    // Parse seguro do JSON retornado pelo Gemini
    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      analysis = {
        risk: 'medio',
        summary: text.substring(0, 200),
        insights: [],
        recommendation: '',
      };
    }

    // Persistir insight no cache
    await sb.from('ai_insights').insert({
      insight_type: 'dashboard_insights',
      entity_type: null,
      entity_id: null,
      analysis,
      summary_text: String(analysis.summary ?? ''),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30min cache
    });

    return new Response(
      JSON.stringify({
        analysis,
        provider: 'gemini',
        model,
        usage,
        durationMs: Date.now() - start,
      }),
      { headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  } catch (e) {
    console.error('[ai-dashboard-insights-worker]', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
