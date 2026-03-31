/**
 * nina-orchestrator — Gateway de deduplicação para WhatsApp (Navi/Nina)
 *
 * Recebe webhooks do OpenClaw/WhatsApp, verifica se o message_id já foi
 * processado e, se não, encaminha para o flow de IA. Retorna 200 imediato
 * para evitar retries do WhatsApp (timeout de 5s).
 *
 * Fluxo:
 *   OpenClaw/WhatsApp → nina-orchestrator → (dedup check) → forward to AI
 *
 * Deploy:
 *   npx supabase functions deploy nina-orchestrator --no-verify-jwt
 */
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

// ─────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────

const DEDUP_TTL_SECONDS = 30; // Ignore duplicate within this window

interface WhatsAppWebhookPayload {
  // OpenClaw / Meta Cloud API webhook fields
  message_id?: string;
  from?: string;
  phone?: string;
  sender?: string;
  text?: string;
  body?: string;
  type?: string;
  timestamp?: string | number;
  // Allow extra fields
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

function extractMessageId(payload: WhatsAppWebhookPayload): string | null {
  // Meta Cloud API format
  if (payload.message_id) return payload.message_id;

  // Nested Meta webhook format: entry[].changes[].value.messages[].id
  const entries = (payload as Record<string, unknown>).entry as Array<Record<string, unknown>> | undefined;
  if (entries?.[0]) {
    const changes = entries[0].changes as Array<Record<string, unknown>> | undefined;
    if (changes?.[0]) {
      const value = changes[0].value as Record<string, unknown> | undefined;
      const messages = value?.messages as Array<Record<string, unknown>> | undefined;
      if (messages?.[0]?.id) return messages[0].id as string;
    }
  }

  // OpenClaw might use different field names
  if ((payload as Record<string, unknown>).id) return (payload as Record<string, unknown>).id as string;

  return null;
}

function extractSenderPhone(payload: WhatsAppWebhookPayload): string {
  if (payload.from) return payload.from;
  if (payload.phone) return payload.phone;
  if (payload.sender) return payload.sender;

  // Nested Meta format
  const entries = (payload as Record<string, unknown>).entry as Array<Record<string, unknown>> | undefined;
  if (entries?.[0]) {
    const changes = entries[0].changes as Array<Record<string, unknown>> | undefined;
    if (changes?.[0]) {
      const value = changes[0].value as Record<string, unknown> | undefined;
      const messages = value?.messages as Array<Record<string, unknown>> | undefined;
      if (messages?.[0]?.from) return messages[0].from as string;
    }
  }

  return 'unknown';
}

function extractMessageText(payload: WhatsAppWebhookPayload): string {
  if (payload.text && typeof payload.text === 'string') return payload.text;
  if (payload.body && typeof payload.body === 'string') return payload.body;

  // Meta format: messages[].text.body
  const entries = (payload as Record<string, unknown>).entry as Array<Record<string, unknown>> | undefined;
  if (entries?.[0]) {
    const changes = entries[0].changes as Array<Record<string, unknown>> | undefined;
    if (changes?.[0]) {
      const value = changes[0].value as Record<string, unknown> | undefined;
      const messages = value?.messages as Array<Record<string, unknown>> | undefined;
      if (messages?.[0]) {
        const textObj = messages[0].text as Record<string, unknown> | undefined;
        if (textObj?.body) return textObj.body as string;
      }
    }
  }

  return '';
}

/** Check if message was already processed (dedup) */
async function isDuplicate(sb: SupabaseClient, messageId: string): Promise<boolean> {
  const { data } = await sb
    .from('nina_processed_messages')
    .select('id, status, created_at')
    .eq('wa_message_id', messageId)
    .maybeSingle();

  if (!data) return false;

  // If the previous attempt is stuck in 'processing' for more than DEDUP_TTL_SECONDS, allow retry
  if (data.status === 'processing') {
    const createdAt = new Date(data.created_at).getTime();
    const now = Date.now();
    if (now - createdAt > DEDUP_TTL_SECONDS * 1000) {
      // Stale processing entry — allow reprocessing
      await sb.from('nina_processed_messages').delete().eq('id', data.id);
      return false;
    }
  }

  return true; // Already processed or currently processing
}

/** Register message as being processed */
async function registerMessage(
  sb: SupabaseClient,
  messageId: string,
  senderPhone: string,
  payload: WhatsAppWebhookPayload
): Promise<string | null> {
  const { data, error } = await sb
    .from('nina_processed_messages')
    .insert({
      wa_message_id: messageId,
      sender_phone: senderPhone,
      direction: 'incoming',
      status: 'processing',
      payload,
    })
    .select('id')
    .single();

  if (error) {
    // unique constraint violation = another instance already registered it
    if (error.code === '23505') return null;
    console.error('[nina-orchestrator] Failed to register message:', error.message);
    return null;
  }

  return data.id;
}

/** Mark message as completed */
async function markCompleted(sb: SupabaseClient, recordId: string, response: unknown) {
  await sb
    .from('nina_processed_messages')
    .update({
      status: 'completed',
      response: response as Record<string, unknown>,
      completed_at: new Date().toISOString(),
    })
    .eq('id', recordId);
}

/** Mark message as failed */
async function markFailed(sb: SupabaseClient, recordId: string, error: string) {
  await sb
    .from('nina_processed_messages')
    .update({
      status: 'failed',
      response: { error },
      completed_at: new Date().toISOString(),
    })
    .eq('id', recordId);
}

/** Forward the message to OpenClaw AI for response generation */
async function forwardToAI(payload: WhatsAppWebhookPayload): Promise<Record<string, unknown>> {
  const aiWebhookUrl = Deno.env.get('NINA_AI_WEBHOOK_URL');

  if (!aiWebhookUrl) {
    console.warn('[nina-orchestrator] NINA_AI_WEBHOOK_URL not configured, skipping AI forward');
    return { forwarded: false, reason: 'NINA_AI_WEBHOOK_URL not configured' };
  }

  const res = await fetch(aiWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI webhook failed (${res.status}): ${errText}`);
  }

  const result = await res.json().catch(() => ({}));
  return { forwarded: true, ...result };
}

// ─────────────────────────────────────────────────────
// HTTP Handler
// ─────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // WhatsApp verification challenge (GET)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const verifyToken = Deno.env.get('WA_VERIFY_TOKEN') || 'vectra-nina';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[nina-orchestrator] Webhook verified');
      return new Response(challenge || '', { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only POST from here
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }

  // WhatsApp status updates (delivered, read) — acknowledge and ignore
  const statuses = extractStatuses(payload);
  if (statuses) {
    return new Response(JSON.stringify({ ok: true, type: 'status_update' }), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }

  const messageId = extractMessageId(payload);
  const senderPhone = extractSenderPhone(payload);
  const messageText = extractMessageText(payload);

  console.log(`[nina-orchestrator] Received: msg=${messageId} from=${senderPhone} text="${messageText?.slice(0, 50)}"`);

  // No message_id = can't dedup, but still process (fallback)
  if (!messageId) {
    console.warn('[nina-orchestrator] No message_id found, processing without dedup');
    try {
      const result = await forwardToAI(payload);
      return new Response(JSON.stringify({ ok: true, dedup: false, ...result }), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    } catch (e) {
      console.error('[nina-orchestrator] Forward failed:', (e as Error).message);
      return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }
  }

  // ── Deduplication check ──
  const sb = serviceClient();

  const duplicate = await isDuplicate(sb, messageId);
  if (duplicate) {
    console.log(`[nina-orchestrator] DUPLICATE blocked: msg=${messageId}`);
    return new Response(
      JSON.stringify({ ok: true, duplicate: true, message_id: messageId }),
      {
        status: 200, // Return 200 so WhatsApp doesn't retry
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  }

  // Register message
  const recordId = await registerMessage(sb, messageId, senderPhone, payload);
  if (!recordId) {
    // Race condition: another instance registered first
    console.log(`[nina-orchestrator] RACE dedup: msg=${messageId}`);
    return new Response(
      JSON.stringify({ ok: true, duplicate: true, message_id: messageId }),
      {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  }

  // Forward to AI
  try {
    const result = await forwardToAI(payload);
    await markCompleted(sb, recordId, result);

    console.log(`[nina-orchestrator] OK: msg=${messageId} forwarded=${result.forwarded}`);
    return new Response(
      JSON.stringify({ ok: true, duplicate: false, message_id: messageId, ...result }),
      {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  } catch (e) {
    const errMsg = (e as Error).message;
    await markFailed(sb, recordId, errMsg);
    console.error(`[nina-orchestrator] FAILED: msg=${messageId} error=${errMsg}`);
    return new Response(
      JSON.stringify({ ok: false, message_id: messageId, error: errMsg }),
      {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  }
});

// ─────────────────────────────────────────────────────
// Helpers: detect status-only webhooks
// ─────────────────────────────────────────────────────

function extractStatuses(payload: WhatsAppWebhookPayload): boolean {
  // Meta format: entry[].changes[].value.statuses[]
  const entries = (payload as Record<string, unknown>).entry as Array<Record<string, unknown>> | undefined;
  if (!entries?.[0]) return false;
  const changes = entries[0].changes as Array<Record<string, unknown>> | undefined;
  if (!changes?.[0]) return false;
  const value = changes[0].value as Record<string, unknown> | undefined;
  const statuses = value?.statuses as unknown[] | undefined;
  const messages = value?.messages as unknown[] | undefined;
  // Has statuses but no messages = status update only
  return !!(statuses && statuses.length > 0 && (!messages || messages.length === 0));
}
