// supabase/functions/ai-financial-anomaly-worker/index.ts

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
    const {
      entityId,
      model = 'gemini-2.0-flash',
      previousInsights,
    }: { entityId: string; model: GeminiModel; previousInsights?: string } = await req.json();

    const { data: doc } = await sb
      .from('financial_documents')
      .select('*')
      .eq('id', entityId)
      .single();

    if (!doc) throw new Error(`Financial document ${entityId} not found`);

    const prompt = `Detecte anomalias neste documento financeiro da Vectra Cargo (frete/logística).
Responda SOMENTE com JSON válido:
{
  "risk": "baixo" | "medio" | "alto",
  "summary": "análise em 2 frases",
  "anomalies": ["anomalia 1 se houver"],
  "recommendation": "ação recomendada",
  "alerts": []
}

Documento:
${JSON.stringify(doc, null, 2)}
${previousInsights ? `\nHistórico:\n${previousInsights}` : ''}`;

    const { text, usage } = await callGemini(prompt, model);

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      analysis = { risk: 'medio', summary: text.substring(0, 200), anomalies: [] };
    }

    await sb.from('ai_insights').insert({
      insight_type: 'financial_anomaly',
      entity_type: 'financial_document',
      entity_id: entityId,
      analysis,
      summary_text: String(analysis.summary ?? ''),
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2h cache
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
    console.error('[ai-financial-anomaly-worker]', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
