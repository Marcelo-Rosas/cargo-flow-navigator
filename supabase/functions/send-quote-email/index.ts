import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '../_shared/cors.ts';
import { fetchQuoteEmailContext } from '../_shared/quote-email-context.ts';
import { buildQuoteEmailContent } from '../_shared/quote-email-content.ts';
import { bytesToBase64, isUuid, quotePdfFileName } from '../_shared/quote-email-format.ts';
import { buildQuoteEmailHtml } from '../_shared/quote-email-html.ts';
import { renderQuoteEmailPdf } from '../_shared/quote-email-pdf.ts';

interface RequestBody {
  quoteId: string;
  recipientEmail: string;
  cc?: string;
  bcc?: string;
  emailMode?: 'simplified' | 'detailed';
  attachPdf?: boolean;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    if (!body?.quoteId || !isUuid(body.quoteId)) {
      return new Response(JSON.stringify({ error: 'Invalid quoteId (expected uuid)' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    if (!body?.recipientEmail || !body.recipientEmail.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid recipientEmail' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { authorization: authHeader } } }
    );

    const emailMode = body.emailMode ?? 'simplified';
    const attachPdf = body.attachPdf !== false;

    let quote: Record<string, unknown>;
    let routeStops;
    let paymentTerm;
    let company;
    try {
      ({ quote, routeStops, paymentTerm, company } = await fetchQuoteEmailContext(
        supabase,
        body.quoteId
      ));
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 404,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const quoteCode = (quote.quote_code as string) || body.quoteId.slice(0, 8);
    const content = buildQuoteEmailContent(quote, paymentTerm, routeStops, emailMode, company);
    const html = buildQuoteEmailHtml(quote, paymentTerm, routeStops, emailMode, company);

    const emailPayload: Record<string, unknown> = {
      from: 'Vectra Cargo <cotacao@vectracargo.com.br>',
      to: [body.recipientEmail],
      ...(body.cc ? { cc: [body.cc] } : {}),
      ...(body.bcc ? { bcc: [body.bcc] } : {}),
      subject: `Cotação ${quoteCode} — Vectra Cargo`,
      html,
    };

    if (attachPdf) {
      const pdfBytes = await renderQuoteEmailPdf(content);
      emailPayload.attachments = [
        {
          filename: quotePdfFileName(quoteCode, emailMode),
          content: bytesToBase64(pdfBytes),
        },
      ];
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendRes.ok) {
      const resendError = await resendRes.text();
      return new Response(JSON.stringify({ error: `Resend error: ${resendError}` }), {
        status: 502,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const resendData = await resendRes.json();

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id, pdfAttached: attachPdf }),
      {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
