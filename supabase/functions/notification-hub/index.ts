/// <reference path="../_shared/deno.d.ts" />
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '../_shared/cors.ts';

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

interface NotificationLog {
  id: string;
  template_key: string;
  channel: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  status: string;
  entity_type: string | null;
  entity_id: string | null;
}

interface NotificationTemplate {
  key: string;
  channel: string;
  subject_template: string | null;
  body_template: string;
  html_template: string | null;
  active: boolean;
}

interface EntityData {
  [key: string]: string | number | null | undefined;
}

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

/** Replace {{variable}} placeholders in template */
function renderTemplate(template: string, data: EntityData): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = data[key];
    if (value === null || value === undefined) return '';
    return String(value);
  });
}

/** Format currency as BRL */
function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Format Brazilian phone to E.164: 55 + DDD + number */
function formatPhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('55') && digits.length >= 12 ? digits : '55' + digits;
}

// ─────────────────────────────────────────────────────
// Entity Data Resolution
// ─────────────────────────────────────────────────────

async function resolveEntityData(
  sb: SupabaseClient,
  entityType: string | null,
  entityId: string | null,
  log: NotificationLog
): Promise<EntityData> {
  const data: EntityData = {};

  if (!entityType || !entityId) return data;

  try {
    if (entityType === 'quote') {
      const { data: quote } = await sb
        .from('quotes')
        .select(
          `
          id, quote_code, origin, destination, value, stage, freight_type,
          clients!inner(name, email, phone)
        `
        )
        .eq('id', entityId)
        .maybeSingle();

      if (quote) {
        const client = (quote as Record<string, unknown>).clients as Record<string, unknown> | null;
        data.quote_code = (quote.quote_code as string) || '';
        data.origin = (quote.origin as string) || '';
        data.destination = (quote.destination as string) || '';
        data.value = formatBRL(Number(quote.value) || 0);
        data.stage = (quote.stage as string) || '';
        data.client_name = (client?.name as string) || '';
        data.client_email = (client?.email as string) || '';
        data.client_phone = (client?.phone as string) || '';

        // Use client email as recipient if not set
        if (!log.recipient_email && client?.email) {
          data._recipient_email = client.email as string;
        }
      }
    }

    if (entityType === 'order') {
      const { data: order } = await sb
        .from('orders')
        .select(
          `
          id, os_number, stage, origin, destination,
          driver_name, driver_phone, carreteiro_antt,
          quotes!inner(
            id, quote_code, value,
            clients!inner(name, email, phone)
          )
        `
        )
        .eq('id', entityId)
        .maybeSingle();

      if (order) {
        const quote = (order as Record<string, unknown>).quotes as Record<string, unknown> | null;
        const client = quote?.clients as Record<string, unknown> | null;
        data.os_number = (order.os_number as string) || '';
        data.origin = (order.origin as string) || '';
        data.destination = (order.destination as string) || '';
        data.stage = (order.stage as string) || '';
        data.driver_name = (order.driver_name as string) || '';
        data.driver_phone = (order.driver_phone as string) || '';
        data.quote_code = (quote?.quote_code as string) || '';
        data.client_name = (client?.name as string) || '';
        data.client_email = (client?.email as string) || '';
        data.client_phone = (client?.phone as string) || '';

        if (!log.recipient_email && client?.email) {
          data._recipient_email = client.email as string;
        }
        if (!log.recipient_phone && order.driver_phone) {
          data._recipient_phone = order.driver_phone as string;
        }
      }
    }

    if (entityType === 'financial_document') {
      const { data: doc } = await sb
        .from('financial_documents')
        .select(
          `
          id, code, type, total_amount, status,
          source_type, source_id
        `
        )
        .eq('id', entityId)
        .maybeSingle();

      if (doc) {
        data.code = (doc.code as string) || '';
        data.type = (doc.type as string) || '';
        data.amount = formatBRL(Number(doc.total_amount) || 0);
        data.total_amount = formatBRL(Number(doc.total_amount) || 0);
        data.status = (doc.status as string) || '';

        // Try to resolve client from source
        if (doc.source_type === 'quote' && doc.source_id) {
          const { data: srcQuote } = await sb
            .from('quotes')
            .select('clients!inner(name, email)')
            .eq('id', doc.source_id as string)
            .maybeSingle();

          if (srcQuote) {
            const client = (srcQuote as Record<string, unknown>).clients as Record<
              string,
              unknown
            > | null;
            data.client_name = (client?.name as string) || '';
            if (!log.recipient_email && client?.email) {
              data._recipient_email = client.email as string;
            }
          }
        }
      }
    }

    // Approval-specific data
    if (log.template_key === 'approval_requested' || log.template_key === 'approval_decided') {
      const { data: approval } = await sb
        .from('approval_requests')
        .select('title, description, status, decision_notes')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (approval) {
        data.title = (approval.title as string) || '';
        data.description = (approval.description as string) || '';
        data.decision_notes = (approval.decision_notes as string) || '';
        data.approval_status = (approval.status as string) || '';
        // Map status for template
        if (approval.status === 'approved') data.status = 'aprovada';
        else if (approval.status === 'rejected') data.status = 'rejeitada';
      }
    }
  } catch (e) {
    console.error(`Error resolving entity data for ${entityType}/${entityId}:`, e);
  }

  return data;
}

// ─────────────────────────────────────────────────────
// Email Sender (Resend)
// ─────────────────────────────────────────────────────

async function sendEmail(
  recipientEmail: string,
  subject: string,
  body: string,
  htmlTemplate?: string | null
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  const htmlBody =
    htmlTemplate ||
    `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="https://app.vectracargo.com.br/brand/logo_vectra.jpg"
             alt="Vectra Cargo" style="max-height: 60px;" />
      </div>
      <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px;">
        ${body
          .split('\n')
          .map(
            (line) =>
              `<p style="margin: 8px 0; color: #374151; font-size: 14px; line-height: 1.6;">${line}</p>`
          )
          .join('')}
      </div>
      <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px;">Vectra Cargo Logística &amp; Transportes</p>
      </div>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Vectra Cargo <contato@vectralog.com.br>',
        to: [recipientEmail],
        subject,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Resend ${res.status}: ${errText}` };
    }

    const result = await res.json();
    return { success: true, externalId: result.id };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ─────────────────────────────────────────────────────
// WhatsApp Sender (via Evolution API)
// ─────────────────────────────────────────────────────

async function sendWhatsApp(
  recipientPhone: string,
  message: string
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  const baseUrl = Deno.env.get('EVOLUTION_API_URL');
  const apiKey = Deno.env.get('EVOLUTION_API_KEY');
  const instance = Deno.env.get('EVOLUTION_INSTANCE');

  if (!baseUrl || !apiKey || !instance) {
    return {
      success: false,
      error:
        'Evolution API not configured (EVOLUTION_API_URL/EVOLUTION_API_KEY/EVOLUTION_INSTANCE) — pending_whatsapp',
    };
  }

  const number = formatPhoneE164(recipientPhone);
  const url = `${baseUrl.replace(/\/$/, '')}/message/sendText/${instance}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ number, text: message }),
    });

    const resText = await res.text();
    let resJson: Record<string, unknown> | null = null;
    try {
      resJson = resText ? (JSON.parse(resText) as Record<string, unknown>) : null;
    } catch {
      /* ignore parse error */
    }

    if (!res.ok) {
      const errDetail = (resJson?.message ?? resJson?.error ?? resText) || res.statusText;
      return {
        success: false,
        error: `Evolution API ${res.status}: ${errDetail} — pending_whatsapp`,
      };
    }

    const key = resJson?.key as { id?: string } | undefined;
    const externalId = key?.id ?? 'evolution';
    return { success: true, externalId };
  } catch (e) {
    const msg = (e as Error).message;
    return {
      success: false,
      error: `Evolution API error: ${msg} — pending_whatsapp`,
    };
  }
}

// ─────────────────────────────────────────────────────
// Process Single Notification
// ─────────────────────────────────────────────────────

async function processNotification(
  sb: SupabaseClient,
  log: NotificationLog
): Promise<{ success: boolean; channel: string; error?: string }> {
  // 1. Fetch template
  const { data: template } = await sb
    .from('notification_templates')
    .select('*')
    .eq('key', log.template_key)
    .eq('active', true)
    .maybeSingle();

  if (!template) {
    await sb
      .from('notification_logs')
      .update({
        status: 'failed',
        error_message: `Template '${log.template_key}' not found or inactive`,
      } as Record<string, unknown>)
      .eq('id', log.id);
    return {
      success: false,
      channel: log.channel,
      error: `Template '${log.template_key}' not found`,
    };
  }

  const tmpl = template as unknown as NotificationTemplate;

  // 2. Resolve entity data
  const data = await resolveEntityData(sb, log.entity_type, log.entity_id, log);

  // 3. Render templates
  const renderedBody = renderTemplate(tmpl.body_template, data);
  const renderedSubject = tmpl.subject_template ? renderTemplate(tmpl.subject_template, data) : '';
  const renderedHtml = tmpl.html_template ? renderTemplate(tmpl.html_template, data) : null;

  // 4. Determine effective recipients
  const effectiveEmail = log.recipient_email || (data._recipient_email as string) || null;
  const effectivePhone = log.recipient_phone || (data._recipient_phone as string) || null;

  const results: { channel: string; success: boolean; externalId?: string; error?: string }[] = [];

  // 5. Send by channel
  const channel = log.channel || tmpl.channel;

  if ((channel === 'email' || channel === 'both') && effectiveEmail) {
    const emailResult = await sendEmail(
      effectiveEmail,
      renderedSubject,
      renderedBody,
      renderedHtml
    );
    results.push({ channel: 'email', ...emailResult });
  }

  if ((channel === 'whatsapp' || channel === 'both') && effectivePhone) {
    const whatsappResult = await sendWhatsApp(effectivePhone, renderedBody);
    results.push({ channel: 'whatsapp', ...whatsappResult });
  }

  // 6. Update notification_logs
  const allSuccess = results.length > 0 && results.every((r) => r.success);
  const anyWhatsAppPending = results.some(
    (r) => !r.success && r.error?.includes('pending_whatsapp')
  );
  const errors = results
    .filter((r) => !r.success)
    .map((r) => r.error)
    .join('; ');
  const externalIds = results
    .filter((r) => r.externalId)
    .map((r) => `${r.channel}:${r.externalId}`)
    .join(',');

  let newStatus: string;
  if (allSuccess) {
    newStatus = 'sent';
  } else if (anyWhatsAppPending && results.some((r) => r.success)) {
    newStatus = 'partial'; // email sent, whatsapp pending
  } else if (anyWhatsAppPending) {
    newStatus = 'pending_whatsapp';
  } else {
    newStatus = 'failed';
  }

  await sb
    .from('notification_logs')
    .update({
      status: newStatus,
      external_id: externalIds || null,
      ...(newStatus === 'sent' || newStatus === 'partial'
        ? { sent_at: new Date().toISOString() }
        : {}),
      ...(errors && !allSuccess ? { error_message: errors } : {}),
    } as Record<string, unknown>)
    .eq('id', log.id);

  return {
    success: allSuccess,
    channel,
    error: allSuccess ? undefined : errors,
  };
}

// ─────────────────────────────────────────────────────
// Main: Process notifications
// ─────────────────────────────────────────────────────

async function processNotifications(
  sb: SupabaseClient,
  logId?: string,
  batch?: boolean
): Promise<{
  processed: number;
  sent: number;
  failed: number;
  results: Array<{ id: string; status: string; error?: string }>;
}> {
  let query = sb
    .from('notification_logs')
    .select('*')
    .in('status', ['pending', 'pending_whatsapp'])
    .order('created_at', { ascending: true })
    .limit(batch ? 20 : 1);

  if (logId) {
    query = sb
      .from('notification_logs')
      .select('*')
      .eq('id', logId)
      .in('status', ['pending', 'pending_whatsapp']);
  }

  const { data: logs, error: fetchErr } = await query;
  if (fetchErr) throw new Error(`Failed to fetch notification logs: ${fetchErr.message}`);
  if (!logs || logs.length === 0) return { processed: 0, sent: 0, failed: 0, results: [] };

  const results: Array<{ id: string; status: string; error?: string }> = [];
  let sent = 0;
  let failed = 0;

  for (const log of logs as unknown as NotificationLog[]) {
    const result = await processNotification(sb, log);
    results.push({
      id: log.id,
      status: result.success ? 'sent' : 'failed',
      error: result.error,
    });
    if (result.success) sent++;
    else failed++;
  }

  return { processed: logs.length, sent, failed, results };
}

// ─────────────────────────────────────────────────────
// HTTP Handler
// ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const sb = serviceClient();
    let logId: string | undefined;
    let batch = false;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        logId = body?.logId;
        batch = body?.batch === true;
      } catch {
        // empty body → process single pending
        batch = false;
      }
    }

    const result = await processNotifications(sb, logId, batch || !logId);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('notification-hub error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
