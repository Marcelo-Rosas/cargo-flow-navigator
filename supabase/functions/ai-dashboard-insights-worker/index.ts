import { createClient } from '@supabase/supabase-js';

const Deno = (globalThis as any).Deno;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

async function callGemini(prompt: string, model: string) {
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

// Receita:
//   is_legacy=false (Nova COT): periodo = created_at
//   is_legacy=true  (COT Antiga): periodo = estimated_loading_date ?? created_at
function dataReceita(q: any): Date {
  if (!q.is_legacy) return new Date(q.created_at);
  return q.estimated_loading_date
    ? new Date(q.estimated_loading_date)
    : new Date(q.created_at);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const start = Date.now();

  try {
    let model = 'gemini-2.5-flash';
    try { const b = await req.json(); model = b.model ?? model; } catch {}

    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400000);
    const d60 = new Date(now.getTime() - 60 * 86400000);

    const [{ data: todasCOT }, { data: pipeline }, { data: financial }] = await Promise.all([
      sb.from('quotes')
        .select('id,stage,value,is_legacy,created_at,estimated_loading_date,freight_modality,origin,destination,quote_code'),
      sb.from('quotes')
        .select('id,quote_code,stage,value,is_legacy,created_at,freight_modality,origin,destination')
        .eq('is_legacy', false)
        .gte('created_at', d60.toISOString())
        .order('created_at', { ascending: false }),
      sb.from('financial_documents')
        .select('type,total_amount,status,category,created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const fmt = (v: number) =>
      v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const ganhas = (todasCOT ?? []).filter((q: any) => q.stage === 'ganho');

    // Receita Nova COT — por created_at
    const novas30    = ganhas.filter((q: any) => !q.is_legacy && dataReceita(q) >= d30);
    const novas30_60 = ganhas.filter((q: any) => !q.is_legacy && dataReceita(q) >= d60 && dataReceita(q) < d30);
    const recNova30  = novas30.reduce((s: number, q: any) => s + Number(q.value ?? 0), 0);
    const recNova60  = novas30_60.reduce((s: number, q: any) => s + Number(q.value ?? 0), 0);

    // Receita COT Antiga — por estimated_loading_date ?? created_at
    const antigas30    = ganhas.filter((q: any) => q.is_legacy && dataReceita(q) >= d30);
    const antigas30_60 = ganhas.filter((q: any) => q.is_legacy && dataReceita(q) >= d60 && dataReceita(q) < d30);
    const recAntiga30  = antigas30.reduce((s: number, q: any) => s + Number(q.value ?? 0), 0);
    const recAntiga60  = antigas30_60.reduce((s: number, q: any) => s + Number(q.value ?? 0), 0);

    const recTotal30 = recNova30 + recAntiga30;
    const recTotal60 = recNova60 + recAntiga60;

    // Pipeline COT Novas
    const pipe30    = (pipeline ?? []).filter((q: any) => new Date(q.created_at) >= d30);
    const pipe30_60 = (pipeline ?? []).filter((q: any) => {
      const d = new Date(q.created_at);
      return d >= d60 && d < d30;
    });
    const tot30 = pipe30.length;
    const gan30 = pipe30.filter((q: any) => q.stage === 'ganho').length;
    const neg30 = pipe30.filter((q: any) => q.stage === 'negociacao').length;
    const per30 = pipe30.filter((q: any) => q.stage === 'perdido').length;
    const tx30  = tot30 > 0 ? ((gan30 / tot30) * 100).toFixed(1) : '0';
    const tot60 = pipe30_60.length;
    const gan60 = pipe30_60.filter((q: any) => q.stage === 'ganho').length;
    const tx60  = tot60 > 0 ? ((gan60 / tot60) * 100).toFixed(1) : '0';

    const fallback = {
      risk: recTotal30 < recTotal60 * 0.7 && recTotal60 > 0 ? 'alto'
          : recTotal30 < recTotal60 ? 'medio' : 'baixo',
      summary: `Ultimos 30 dias: receita R$ ${fmt(recTotal30)} (Nova COT R$ ${fmt(recNova30)} + Antiga R$ ${fmt(recAntiga30)}), tx conversao ${tx30}%.`,
      insights: [
        `COT Novas (30 dias): ${tot30} | ${gan30} ganhas | ${neg30} em negociacao | ${per30} perdidas | tx ${tx30}%`,
        `Receita Nova COT: R$ ${fmt(recNova30)} | Receita COT Antiga (data frete): R$ ${fmt(recAntiga30)}`,
        `Comparativo 30-60 dias: receita R$ ${fmt(recTotal60)} | tx ${tx60}%`,
      ],
      recommendation: neg30 > 5
        ? `${neg30} COT Novas em negociacao. Priorizar follow-up.`
        : 'Pipeline saudavel. Manter cadencia.',
      alerts: recTotal30 < recTotal60 * 0.7 && recTotal60 > 0
        ? [`Receita 30 dias (R$ ${fmt(recTotal30)}) abaixo do periodo anterior (R$ ${fmt(recTotal60)})`]
        : [],
    };

    const prompt = `Analise os dados COMERCIAIS da Vectra Cargo. Retorne SOMENTE JSON sem markdown:
{"risk":"baixo|medio|alto","summary":"2 frases concisas.","insights":["a","b","c"],"recommendation":"acao","alerts":[]}

LOGICA DE RECEITA:
- COT Nova (is_legacy=false): periodo = data de criacao no sistema (created_at)
- COT Antiga (is_legacy=true): periodo = data do frete original (estimated_loading_date), fallback para created_at se nulo
- OS (Ordens de Servico) NAO sao receita

JANELA ATUAL (ultimos 30 dias):
- COT Novas: ${tot30} total | ${gan30} ganhas | ${neg30} em negociacao | ${per30} perdidas | tx ${tx30}%
- Receita Nova COT: R$ ${fmt(recNova30)}
- Receita COT Antiga (data frete): R$ ${fmt(recAntiga30)}
- Receita TOTAL: R$ ${fmt(recTotal30)}

JANELA ANTERIOR (30-60 dias atras):
- COT Novas: ${tot60} | ${gan60} ganhas | tx ${tx60}%
- Receita TOTAL: R$ ${fmt(recTotal60)}

COT recentes: ${JSON.stringify(pipe30?.slice(0, 5))}
Financeiro: ${JSON.stringify(financial?.slice(0, 5))}`;

    const { text, usage } = await callGemini(prompt, model);
    let analysis: any = fallback;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { const p = JSON.parse(m[0]); if (p.summary) analysis = p; }
    } catch {}

    await sb.from('ai_insights').insert({
      insight_type: 'dashboard_insights',
      entity_type: null,
      entity_id: null,
      analysis,
      summary_text: String(analysis.summary ?? ''),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });

    return new Response(
      JSON.stringify({ analysis, provider: 'gemini', model, usage, durationMs: Date.now() - start }),
      { headers: { ...cors, 'content-type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[ai-dashboard-insights-worker]', e.message);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...cors, 'content-type': 'application/json' } }
    );
  }
});