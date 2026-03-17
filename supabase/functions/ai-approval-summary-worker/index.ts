// supabase/functions/ai-approval-summary-worker/index.ts

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
      entityType,
      model = 'gemini-2.5-pro',
      previousInsights,
    }: {
      entityId: string;
      entityType: string;
      model: GeminiModel;
      previousInsights?: string;
    } = await req.json();

    // Buscar aprovação + entidade relacionada em paralelo
    const [{ data: approval }, entityResult] = await Promise.all([
      sb
        .from('approval_requests')
        .select('*, approval_rules(name, conditions)')
        .eq('id', entityId)
        .single(),
      entityType === 'quote'
        ? sb.from('quotes').select('*').eq('id', entityId).single()
        : sb.from('service_orders').select('*').eq('id', entityId).single(),
    ]);

    const prompt = `Resuma esta solicitação de aprovação para o gestor da Vectra Cargo.
Responda SOMENTE com JSON válido:
{
  "risk": "baixo" | "medio" | "alto",
  "summary": "resumo executivo em 2 frases",
  "key_points": ["ponto 1", "ponto 2"],
  "recommendation": "aprovar/rejeitar/escalar com justificativa clara",
  "alerts": []
}

Solicitação de aprovação:
${JSON.stringify(approval, null, 2)}

Entidade (${entityType}):
${JSON.stringify(entityResult.data, null, 2)}
${previousInsights ? `\nHistórico:\n${previousInsights}` : ''}`;

    const { text, usage } = await callGemini(prompt, model, 0.3);

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      analysis = { risk: 'medio', summary: text.substring(0, 200), recommendation: '' };
    }

    await sb.from('ai_insights').insert({
      insight_type: 'approval_summary',
      entity_type: entityType,
      entity_id: entityId,
      analysis,
      summary_text: String(analysis.summary ?? ''),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30min
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
    console.error('[ai-approval-summary-worker]', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
