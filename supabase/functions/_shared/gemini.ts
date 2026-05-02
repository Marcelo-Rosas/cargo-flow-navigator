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

async function callGeminiModel(
  prompt: string,
  model: GeminiModel,
  temperature: number,
  apiKey: string
): Promise<GeminiResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status} (model=${model}): ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const usage: GeminiUsage = {
    input_tokens: data.usageMetadata?.promptTokenCount ?? 0,
    output_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };

  return { text, usage, model };
}

export async function callGemini(
  prompt: string,
  model: GeminiModel = 'gemini-2.0-flash',
  temperature = 0.4
): Promise<GeminiResult> {
  const apiKey = (globalThis as any).Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  try {
    return await callGeminiModel(prompt, model, temperature, apiKey);
  } catch (primaryErr) {
    // Fallback to flash if a non-flash model fails (model not found, quota, etc.)
    if (model !== 'gemini-2.0-flash') {
      console.warn(
        `[gemini] primary model ${model} failed, falling back to gemini-2.0-flash:`,
        primaryErr
      );
      return await callGeminiModel(prompt, 'gemini-2.0-flash', temperature, apiKey);
    }
    throw primaryErr;
  }
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
