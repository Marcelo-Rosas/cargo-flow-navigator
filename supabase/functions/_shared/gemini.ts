// supabase/functions/_shared/gemini.ts

export type GeminiModel = 'gemini-2.0-flash' | 'gemini-2.5-pro';

export interface GeminiUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface GeminiResult {
  text: string;
  usage: GeminiUsage;
  model: GeminiModel;
}

export async function callGemini(
  prompt: string,
  model: GeminiModel = 'gemini-2.0-flash',
  temperature = 0.4
): Promise<GeminiResult> {
  const apiKey = (globalThis as any).Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const usage: GeminiUsage = {
    input_tokens: data.usageMetadata?.promptTokenCount ?? 0,
    output_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };

  return { text, usage, model };
}

/** Mapeia analysisType → modelo Gemini */
export function selectGeminiModel(analysisType: string): GeminiModel {
  switch (analysisType) {
    case 'approval_summary':
    case 'dashboard_insights':
      return 'gemini-2.5-pro'; // análises complexas
    case 'quote_profitability':
    case 'financial_anomaly':
    default:
      return 'gemini-2.0-flash'; // análises rápidas/baratas
  }
}
