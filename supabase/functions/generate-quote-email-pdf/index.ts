import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '../_shared/cors.ts';
import { fetchQuoteEmailContext } from '../_shared/quote-email-context.ts';
import { buildQuoteEmailContent } from '../_shared/quote-email-content.ts';
import { bytesToBase64, isUuid, quotePdfFileName } from '../_shared/quote-email-format.ts';
import { renderQuoteEmailPdf } from '../_shared/quote-email-pdf.ts';

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get(key: string): string | undefined };
};

interface RequestBody {
  quoteId: string;
  emailMode?: 'simplified' | 'detailed';
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { authorization: authHeader } } }
    );

    const emailMode = body.emailMode ?? 'simplified';

    const { quote, routeStops, paymentTerm } = await fetchQuoteEmailContext(supabase, body.quoteId);

    const quoteCode = (quote.quote_code as string) || body.quoteId.slice(0, 8);
    const content = buildQuoteEmailContent(quote, paymentTerm, routeStops, emailMode);
    const pdfBytes = await renderQuoteEmailPdf(content);

    return new Response(
      JSON.stringify({
        pdf_base64: bytesToBase64(pdfBytes),
        file_name: quotePdfFileName(quoteCode, emailMode),
        quote_code: quoteCode,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = /not found/i.test(message) ? 404 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
