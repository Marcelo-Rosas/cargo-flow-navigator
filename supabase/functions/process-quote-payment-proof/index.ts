import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

type Body = { documentId: string };

type DocumentRow = {
  id: string;
  type: string;
  quote_id: string | null;
};

type QuoteRow = {
  id: string;
  value: number | null;
  payment_term_id: string | null;
};

type PaymentTermRow = { advance_percent: number | null };

const DOC_FAT_TYPES = ['a_vista_fat', 'adiantamento', 'saldo_fat', 'a_prazo_fat'] as const;

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function mapProofType(docType: string): 'a_vista' | 'adiantamento' | 'saldo' | 'a_prazo' {
  if (docType === 'a_vista_fat') return 'a_vista';
  if (docType === 'adiantamento') return 'adiantamento';
  if (docType === 'saldo_fat') return 'saldo';
  return 'a_prazo';
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

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

    const body = (await req.json()) as Body;
    if (!body?.documentId || !isUuid(body.documentId)) {
      return new Response(JSON.stringify({ error: 'Invalid documentId (expected uuid)' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: doc, error: docErr } = await sb
      .from('documents')
      .select('id, type, quote_id')
      .eq('id', body.documentId)
      .maybeSingle();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const d = doc as DocumentRow;
    if (!DOC_FAT_TYPES.includes(d.type as (typeof DOC_FAT_TYPES)[number])) {
      return new Response(
        JSON.stringify({ error: 'Document type not supported for quote payment proof' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        }
      );
    }

    if (!d.quote_id) {
      return new Response(JSON.stringify({ error: 'Document has no quote_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const { data: quote } = await sb
      .from('quotes')
      .select('id, value, payment_term_id')
      .eq('id', d.quote_id)
      .maybeSingle();

    const q = quote as QuoteRow | null;
    const totalValue = q?.value != null ? Number(q.value) : 0;
    const proofType = mapProofType(d.type);

    let expectedAmount: number | null = totalValue;
    if (proofType === 'adiantamento' || proofType === 'saldo') {
      let advancePercent = 0;
      if (q?.payment_term_id) {
        const { data: pt } = await sb
          .from('payment_terms')
          .select('advance_percent')
          .eq('id', q.payment_term_id)
          .maybeSingle();
        advancePercent = (pt as PaymentTermRow | null)?.advance_percent ?? 0;
      }
      expectedAmount =
        proofType === 'adiantamento'
          ? (totalValue * advancePercent) / 100
          : (totalValue * (100 - advancePercent)) / 100;
    }

    const { data: upserted, error: upsertErr } = await sb
      .from('quote_payment_proofs')
      .upsert(
        {
          quote_id: d.quote_id,
          document_id: d.id,
          proof_type: proofType,
          amount: null,
          expected_amount: expectedAmount,
          status: 'pending',
          extracted_fields: {},
        },
        { onConflict: 'document_id', ignoreDuplicates: false }
      )
      .select('id')
      .single();

    if (upsertErr) {
      return new Response(JSON.stringify({ error: upsertErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        quotePaymentProofId: (upserted as { id: string }).id,
        extracted: { amount: null, status: 'pending' },
      }),
      { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
