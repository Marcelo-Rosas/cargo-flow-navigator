import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

type Body = {
  docType: "FAT" | "PAG";
  sourceId: string; // uuid
  totalAmount?: number | null; // optional fallback
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders(req), "content-type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders(req), "content-type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;

    if (!body?.docType || (body.docType !== "FAT" && body.docType !== "PAG")) {
      return new Response(JSON.stringify({ error: "Invalid docType (expected FAT|PAG)" }), {
        status: 400,
        headers: { ...corsHeaders(req), "content-type": "application/json" },
      });
    }

    if (!body?.sourceId || !isUuid(body.sourceId)) {
      return new Response(JSON.stringify({ error: "Invalid sourceId (expected uuid)" }), {
        status: 400,
        headers: { ...corsHeaders(req), "content-type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data, error } = await supabase.rpc("ensure_financial_document", {
      doc_type: body.docType,
      source_id_in: body.sourceId,
      total_amount_in: body.totalAmount ?? null,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message, code: error.code }), {
        status: 400,
        headers: { ...corsHeaders(req), "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { ...corsHeaders(req), "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders(req), "content-type": "application/json" },
    });
  }
});
