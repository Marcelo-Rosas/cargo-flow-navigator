import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

type Body = {
  documentId: string;
};

type DocumentRow = {
  id: string;
  type: string;
  order_id: string | null;
};

type OrderRow = {
  id: string;
  trip_id: string | null;
  carreteiro_real: number | null;
  carrier_payment_term_id: string | null;
};

type PaymentTermRow = {
  advance_percent: number | null;
};

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

const PAYMENT_PROOF_TYPES = ['adiantamento_carreteiro', 'saldo_carreteiro'] as const;

function mapProofType(docType: string): 'adiantamento' | 'saldo' {
  if (docType === 'adiantamento_carreteiro') return 'adiantamento';
  if (docType === 'saldo_carreteiro') return 'saldo';
  return 'adiantamento';
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

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

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
      .select('id, type, order_id')
      .eq('id', body.documentId)
      .maybeSingle();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const d = doc as DocumentRow;
    if (!PAYMENT_PROOF_TYPES.includes(d.type as (typeof PAYMENT_PROOF_TYPES)[number])) {
      return new Response(
        JSON.stringify({ error: 'Document type not supported for payment proof' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        }
      );
    }

    if (!d.order_id) {
      return new Response(JSON.stringify({ error: 'Document has no order_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const { data: order } = await sb
      .from('orders')
      .select('id, trip_id, carreteiro_real, carrier_payment_term_id')
      .eq('id', d.order_id)
      .maybeSingle();

    const ord = order as OrderRow | null;
    const tripId = ord?.trip_id ?? null;
    const proofType = mapProofType(d.type);

    let expectedAmount: number | null = null;
    const carreteiroReal = ord?.carreteiro_real != null ? Number(ord.carreteiro_real) : null;
    if (carreteiroReal != null && carreteiroReal > 0 && ord?.carrier_payment_term_id) {
      const { data: pt } = await sb
        .from('payment_terms')
        .select('advance_percent')
        .eq('id', ord.carrier_payment_term_id)
        .maybeSingle();
      const advancePercent = (pt as PaymentTermRow | null)?.advance_percent ?? 0;
      if (proofType === 'adiantamento') {
        expectedAmount = (carreteiroReal * advancePercent) / 100;
      } else {
        expectedAmount = (carreteiroReal * (100 - advancePercent)) / 100;
      }
    } else if (carreteiroReal != null && carreteiroReal > 0 && proofType === 'saldo') {
      expectedAmount = carreteiroReal;
    }

    const row = {
      order_id: d.order_id,
      trip_id: tripId,
      document_id: d.id,
      proof_type: proofType,
      amount: null as number | null,
      expected_amount: expectedAmount,
      status: 'pending' as const,
      extracted_fields: {} as Record<string, unknown>,
    };

    const { data: upserted, error: upsertErr } = await sb
      .from('payment_proofs')
      .upsert(row, {
        onConflict: 'document_id',
        ignoreDuplicates: false,
      })
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
        paymentProofId: (upserted as { id: string }).id,
        extracted: { amount: null, status: 'pending' },
      }),
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
