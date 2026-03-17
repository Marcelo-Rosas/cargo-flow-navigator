// supabase/functions/ai-quote-profitability-worker/index.ts

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

    const { data: quote } = await sb
      .from('quotes')
      .select(
        '*, client:clients(name), origin_city, destination_city, cargo_type, weight_kg, total_value, freight_cost, status'
      )
      .eq('id', entityId)
      .single();

    if (!quote) throw new Error(`Quote ${entityId} not found`);

    const margin =
      quote.total_value && quote.freight_cost
        ? (((quote.total_value - quote.freight_cost) / quote.total_value) * 100).toFixed(1)
        : null;

    const prompt = `Analise a rentabilidade desta cotação de frete da Vectra Cargo.
Responda SOMENTE com JSON válido:
{
  "risk": "baixo" | "medio" | "alto",
  "summary": "análise em 2 frases",
  "margin_assessment": "comentário sobre a margem",
  "recommendation": "aprovar/revisar/rejeitar com justificativa",
  "alerts": []
}

Cotação:
- Origem→Destino: ${quote.origin_city} → ${quote.destination_city}
- Cliente: ${quote.client?.name ?? 'N/A'}
- Tipo de carga: ${quote.cargo_type ?? 'N/A'} | Peso: ${quote.weight_kg ?? 0}kg
- Valor total: R$ ${(quote.total_value / 100).toFixed(2)}
- Custo frete: R$ ${(quote.freight_cost / 100).toFixed(2)}
- Margem calculada: ${margin ?? 'N/A'}%
- Status: ${quote.status}
${previousInsights ? `\nHistórico desta entidade:\n${previousInsights}` : ''}`;

    const { text, usage } = await callGemini(prompt, model);

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      analysis = { risk: 'medio', summary: text.substring(0, 200), recommendation: '' };
    }

    await sb.from('ai_insights').insert({
      insight_type: 'quote_profitability',
      entity_type: 'quote',
      entity_id: entityId,
      analysis,
      summary_text: String(analysis.summary ?? ''),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1h cache
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
    console.error('[ai-quote-profitability-worker]', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
