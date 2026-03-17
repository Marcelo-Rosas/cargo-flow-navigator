import { createClient } from '@supabase/supabase-js';
const Deno = (globalThis as any).Deno;
async function callGemini(prompt: string, model = 'gemini-2.0-flash') {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    usage: {
      input_tokens: data.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const start = Date.now();
  try {
    let model = 'gemini-2.0-flash';
    try {
      const b = await req.json();
      model = b.model ?? model;
    } catch {}
    const [{ data: quotes }, { data: orders }, { data: financial }] = await Promise.all([
      sb
        .from('quotes')
        .select('id,stage,value,freight_modality,origin,destination,created_at')
        .order('created_at', { ascending: false })
        .limit(20),
      sb
        .from('orders')
        .select('id,stage,value,freight_modality,origin,destination,created_at')
        .order('created_at', { ascending: false })
        .limit(20),
      sb
        .from('financial_documents')
        .select('type,total_amount,status,category,due_date,created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    const totalQ = quotes?.length ?? 0,
      ganhas = quotes?.filter((q: any) => q.stage === 'ganho').length ?? 0,
      perdidas = quotes?.filter((q: any) => q.stage === 'perdido').length ?? 0;
    const receitaOS = orders?.reduce((s: number, o: any) => s + Number(o.value ?? 0), 0) ?? 0;
    const txConv = totalQ > 0 ? ((ganhas / totalQ) * 100).toFixed(1) : '0';
    const fallback = {
      risk: 'medio',
      summary: `Taxa de conversao ${txConv}%. Receita OS: R$ ${receitaOS.toFixed(2)}.`,
      insights: [
        `Taxa de conversao: ${txConv}%`,
        `${ganhas} cotacoes ganhas de ${totalQ}`,
        `Receita OS: R$ ${receitaOS.toFixed(2)}`,
      ],
      recommendation: 'Revisar cotacoes em aberto.',
      alerts: [],
    };
    const prompt = `Analise os dados da Vectra Cargo e retorne SOMENTE JSON sem markdown:\n{"risk":"baixo","summary":"2 frases.","insights":["a","b","c"],"recommendation":"acao","alerts":[]}\n\nDados: cotacoes=${totalQ} ganhas=${ganhas} perdidas=${perdidas} taxa=${txConv}% receita_os=R$${receitaOS.toFixed(2)}\nCotacoes:${JSON.stringify(quotes?.slice(0, 5))}\nOS:${JSON.stringify(orders?.slice(0, 5))}\nFinanceiro:${JSON.stringify(financial?.slice(0, 5))}`;
    const { text, usage } = await callGemini(prompt, model);
    console.log('[ai-dashboard] raw:', text.substring(0, 150));
    let analysis = fallback;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const p = JSON.parse(m[0]);
        if (p.summary) analysis = p;
      }
    } catch {}
    await sb
      .from('ai_insights')
      .insert({
        insight_type: 'dashboard_insights',
        entity_type: null,
        entity_id: null,
        analysis,
        summary_text: String(analysis.summary ?? ''),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
    return new Response(
      JSON.stringify({
        analysis,
        provider: 'gemini',
        model,
        usage,
        durationMs: Date.now() - start,
      }),
      { headers: { ...cors, 'content-type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[ai-dashboard-insights-worker]', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }
});
