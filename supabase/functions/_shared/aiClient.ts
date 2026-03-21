import { createClient } from 'jsr:@supabase/supabase-js@2';

type LLMProvider = 'anthropic' | 'openai' | 'gemini';

const getEnv = (key: string): string | undefined => {
  try {
    const deno = globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } };
    if (typeof deno.Deno?.env?.get === 'function') return deno.Deno.env.get(key);
  } catch {
    // ignore
  }
  return undefined;
};

interface CallLLMParams {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  modelHint?: LLMProvider;
  // Optional metadata for logging
  analysisType?: string;
  entityType?: string | null;
  entityId?: string | null;
}

interface CallLLMResult {
  provider: LLMProvider;
  text: string;
  raw: unknown;
}

// Basic Supabase client for optional logging into ai_usage_tracking (reuse existing schema)
const supabaseAdmin = (() => {
  const url = getEnv('SUPABASE_URL');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
})();

async function logProviderFallback(params: {
  from: LLMProvider;
  to: LLMProvider;
  reason: string;
  analysisType?: string;
  entityType?: string | null;
  entityId?: string | null;
}) {
  try {
    if (!supabaseAdmin) return;
    await supabaseAdmin.from('ai_usage_tracking').insert({
      analysis_type: params.analysisType ?? 'unknown',
      model_used: `${params.from}->${params.to}`,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      estimated_cost_usd: 0,
      status: 'fallback',
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      duration_ms: null,
      error_message: params.reason,
    });
  } catch (e) {
    console.error('Failed to log AI provider fallback:', e);
  }
}

async function callAnthropic(params: CallLLMParams): Promise<CallLLMResult> {
  const apiKey = getEnv('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const baseUrl = getEnv('AI_GATEWAY_URL') || 'https://api.anthropic.com';
  const model = getEnv('ANTHROPIC_MODEL') || 'claude-sonnet-4-20250514';
  const maxTokens = params.maxTokens ?? 1024;

  const body = {
    model,
    max_tokens: maxTokens,
    system: params.system
      ? [
          {
            type: 'text',
            text: params.system,
          },
        ]
      : undefined,
    messages: [
      {
        role: 'user' as const,
        content: params.prompt,
      },
    ],
  };

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const textBody = await res.text();

  if (!res.ok) {
    // Try to parse structured error from Anthropic
    let parsed: any = null;
    try {
      parsed = JSON.parse(textBody);
    } catch {
      // ignore
    }
    const error: any = new Error(
      `Claude API error (${res.status}): ${parsed?.error?.message || textBody}`
    );
    if (parsed?.error) {
      (error as any).anthropicError = parsed.error;
    }
    throw error;
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(textBody);
  } catch {
    parsed = textBody;
  }

  const contentText =
    parsed?.content?.[0]?.text ??
    (typeof parsed?.content === 'string' ? parsed.content : String(textBody));

  return {
    provider: 'anthropic',
    text: contentText,
    raw: parsed,
  };
}

async function callOpenAI(params: CallLLMParams): Promise<CallLLMResult> {
  const apiKey = getEnv('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const baseUrl = getEnv('OPENAI_API_BASE_URL') || 'https://api.openai.com/v1';
  const model = getEnv('OPENAI_MODEL') || 'gpt-4.1-mini';
  const maxTokens = params.maxTokens ?? 1024;
  const temperature = params.temperature ?? 0.2;

  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      ...(params.system
        ? [
            {
              role: 'system' as const,
              content: params.system,
            },
          ]
        : []),
      {
        role: 'user' as const,
        content: params.prompt,
      },
    ],
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const textBody = await res.text();

  if (!res.ok) {
    let parsed: any = null;
    try {
      parsed = JSON.parse(textBody);
    } catch {
      // ignore
    }
    const error: any = new Error(
      `OpenAI API error (${res.status}): ${parsed?.error?.message || textBody}`
    );
    if (parsed?.error) {
      (error as any).openaiError = parsed.error;
    }
    throw error;
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(textBody);
  } catch {
    parsed = textBody;
  }

  const contentText =
    parsed?.choices?.[0]?.message?.content ??
    (typeof parsed?.choices?.[0]?.text === 'string' ? parsed.choices[0].text : String(textBody));

  return {
    provider: 'openai',
    text: contentText,
    raw: parsed,
  };
}

async function callGeminiLLM(params: CallLLMParams): Promise<CallLLMResult> {
  const apiKey = getEnv('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const model = getEnv('GEMINI_MODEL') || 'gemini-2.0-flash';
  const maxTokens = params.maxTokens ?? 1024;
  const temperature = params.temperature ?? 0.2;

  const fullPrompt = params.system ? `${params.system}\n\n${params.prompt}` : params.prompt;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    }
  );

  const textBody = await res.text();

  if (!res.ok) {
    throw new Error(`Gemini API error (${res.status}): ${textBody}`);
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(textBody);
  } catch {
    parsed = textBody;
  }

  const contentText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? String(textBody);

  return {
    provider: 'gemini',
    text: contentText,
    raw: parsed,
  };
}

function resolveProvider(hint: LLMProvider | undefined): LLMProvider {
  const hasGeminiKey = !!getEnv('GEMINI_API_KEY');
  const hasAnthropicKey = !!getEnv('ANTHROPIC_API_KEY');
  const hasOpenAIKey = !!getEnv('OPENAI_API_KEY');

  // Honour explicit hint if the key is available
  if (hint === 'gemini' && hasGeminiKey) return 'gemini';
  if (hint === 'anthropic' && hasAnthropicKey) return 'anthropic';
  if (hint === 'openai' && hasOpenAIKey) return 'openai';

  // Default priority: gemini > anthropic > openai
  if (hasGeminiKey) return 'gemini';
  if (hasAnthropicKey) return 'anthropic';
  if (hasOpenAIKey) return 'openai';

  return 'gemini'; // will fail with "not configured" but gives clear error
}

const providerFns: Record<LLMProvider, (p: CallLLMParams) => Promise<CallLLMResult>> = {
  gemini: callGeminiLLM,
  anthropic: callAnthropic,
  openai: callOpenAI,
};

const RECOVERABLE_RE =
  /not configured|credit balance is too low|insufficient credit|insufficient_quota|rate_limit|exceeded your current quota|ECONNRESET|ENOTFOUND|ETIMEDOUT|Failed to fetch| 5\d{2}\b| 429\b/i;

export async function callLLM(params: CallLLMParams): Promise<CallLLMResult> {
  const preferred = resolveProvider(params.modelHint);

  // Build fallback chain: preferred first, then others in priority order
  const allProviders: LLMProvider[] = ['gemini', 'anthropic', 'openai'];
  const chain = [preferred, ...allProviders.filter((p) => p !== preferred)];

  let lastError: Error | null = null;

  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    try {
      return await providerFns[provider](params);
    } catch (e) {
      const err = e as Error;
      const message = err?.message || String(err);
      lastError = err;

      if (i < chain.length - 1 && RECOVERABLE_RE.test(message)) {
        const next = chain[i + 1];
        console.warn(`${provider} failed, falling back to ${next}:`, message);
        await logProviderFallback({
          from: provider,
          to: next,
          reason: message.substring(0, 200),
          analysisType: params.analysisType,
          entityType: params.entityType ?? null,
          entityId: params.entityId ?? null,
        });
        continue;
      }

      throw err;
    }
  }

  throw lastError ?? new Error('All LLM providers failed');
}
