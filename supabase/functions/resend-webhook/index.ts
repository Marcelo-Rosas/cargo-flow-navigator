/**
 * Receives Resend webhook events (email.sent, email.delivered, email.bounced, etc.)
 * and logs/stores them. Uses Svix for signature verification.
 *
 * Required secret: RESEND_WEBHOOK_SECRET (whsec_xxx from Resend dashboard)
 */
import { Webhook } from 'npm:svix@1.87.0';

interface ResendEvent {
  type: string;
  created_at: string;
  data: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  if (!secret) {
    console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not configured');
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response(JSON.stringify({ error: 'Missing Svix headers' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawBody = await req.text();

  try {
    const wh = new Webhook(secret);
    const payload = wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendEvent;

    console.log(`[resend-webhook] ${payload.type}`, payload.data?.email_id);

    // TODO: persist to DB, update quotes.email_sent_at, etc.
    switch (payload.type) {
      case 'email.sent':
        break;
      case 'email.delivered':
        break;
      case 'email.bounced':
        break;
      case 'email.opened':
        break;
      case 'email.clicked':
        break;
      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[resend-webhook] Verification failed:', err);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
