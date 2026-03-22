import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { validateJWT, AuthError, authErrorResponse } from '../_shared/auth.ts';

/**
 * Edge Function: generate-signed-url
 *
 * Generates a temporary signed URL for a document in the private 'documents' bucket.
 * Uses service role key server-side so the client never directly creates signed URLs.
 *
 * Route:  POST /functions/v1/generate-signed-url
 * Body:   { "path": "<storage_path>", "expiresIn": 3600 }
 * Auth:   Authorization: Bearer <user access token>
 *
 * Response: { "signedUrl": "https://..." }
 */

const BUCKET = 'documents';
const DEFAULT_EXPIRES_SECONDS = 3600; // 1 hour
const MAX_EXPIRES_SECONDS = 7200; // 2 hours max

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate user JWT
    await validateJWT(req);

    // Parse body
    let body: { path?: string; expiresIn?: number };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const filePath = body?.path?.trim();
    if (!filePath || filePath.includes('..') || filePath.startsWith('/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expiresIn = Math.min(
      Math.max(body?.expiresIn ?? DEFAULT_EXPIRES_SECONDS, 60),
      MAX_EXPIRES_SECONDS
    );

    // Use service role to generate signed URL (bypasses RLS on storage)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await serviceClient.storage
      .from(BUCKET)
      .createSignedUrl(filePath, expiresIn);

    if (error || !data?.signedUrl) {
      console.error('[generate-signed-url] Storage error:', error?.message);
      return new Response(
        JSON.stringify({ error: error?.message || 'Falha ao gerar URL assinada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ signedUrl: data.signedUrl }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return authErrorResponse(e, corsHeaders);
    }
    console.error('[generate-signed-url] Unexpected error:', String(e));
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
