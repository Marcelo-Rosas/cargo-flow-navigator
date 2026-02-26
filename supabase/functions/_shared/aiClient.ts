import { createClient } from 'jsr:@supabase/supabase-js@2';

type LLMProvider = 'anthropic' | 'openai';

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
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
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
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const baseUrl = Deno.env.get('AI_GATEWAY_URL') || 'https://api.anthropic.com';
  const model = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-20250514';
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
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const baseUrl = Deno.env.get('OPENAI_API_BASE_URL') || 'https://api.openai.com/v1';
  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';
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

export async function callLLM(params: CallLLMParams): Promise<CallLLMResult> {
  const hasAnthropicKey = !!Deno.env.get('ANTHROPIC_API_KEY');
  const hasOpenAIKey = !!Deno.env.get('OPENAI_API_KEY');

  // Fail fast if no AI keys are configured at all
  if (!hasAnthropicKey && !hasOpenAIKey) {
    throw new Error(
      'Nenhuma chave de IA configurada. Configure ANTHROPIC_API_KEY ou OPENAI_API_KEY nos secrets do Supabase (Dashboard → Edge Functions → Secrets).'
    );
  }

  // Resolve preferred provider: honour modelHint first, then fall back to
  // whichever key is actually available so we never fail with "not configured"
  // when the other provider is ready to go.
  let preferred: LLMProvider;
  if (params.modelHint) {
    // If the hinted provider has no key but the other does, override the hint
    if (params.modelHint === 'anthropic' && !hasAnthropicKey && hasOpenAIKey) {
      preferred = 'openai';
    } else if (params.modelHint === 'openai' && !hasOpenAIKey && hasAnthropicKey) {
      preferred = 'anthropic';
    } else {
      preferred = params.modelHint;
    }
  } else if (hasAnthropicKey && !hasOpenAIKey) {
    preferred = 'anthropic';
  } else if (hasOpenAIKey && !hasAnthropicKey) {
    preferred = 'openai';
  } else {
    // Both keys present – default to openai for backwards compat
    preferred = 'openai';
  }

  const tryOpenAIFirst = preferred === 'openai';

  const primary = tryOpenAIFirst ? callOpenAI : callAnthropic;
  const secondary = tryOpenAIFirst ? callAnthropic : callOpenAI;
  const secondaryHasKey = tryOpenAIFirst ? hasAnthropicKey : hasOpenAIKey;

  try {
    return await primary(params);
  } catch (e) {
    const err = e as any;
    const message: string = err?.message || String(err);

    const isRecoverable =
      /not configured/i.test(message) ||
      /credit balance is too low/i.test(message) ||
      /insufficient credit/i.test(message) ||
      /insufficient_quota/i.test(message) ||
      /rate_limit/i.test(message) ||
      /ECONNRESET|ENOTFOUND|ETIMEDOUT|Failed to fetch/i.test(message) ||
      / 5\d{2}\b/.test(message) ||
      / 429\b/.test(message);

    if (isRecoverable && secondaryHasKey) {
      const fromProvider: LLMProvider = tryOpenAIFirst ? 'openai' : 'anthropic';
      const toProvider: LLMProvider = tryOpenAIFirst ? 'anthropic' : 'openai';
      console.warn(`${fromProvider} failed, falling back to ${toProvider}:`, message);
      await logProviderFallback({
        from: fromProvider,
        to: toProvider,
        reason: message.substring(0, 200),
        analysisType: params.analysisType,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
      });
      return await secondary(params);
    }

    throw err;
  }
}
