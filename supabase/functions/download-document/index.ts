/**
 * Edge Function: download-document
 *
 * Proxy download for files in the private 'documents' bucket.
 * Uses service role key (server-side only) to fetch the file,
 * then streams it back to the authenticated client.
 *
 * Route:  POST /functions/v1/download-document
 * Body:   { "path": "<folder>/<filename>" }
 * Auth:   Authorization: Bearer <user access token>
 *
 * Security:
 * - Validates user via supabase.auth.getUser()
 * - Authorises: path must start with user.id + "/" OR user must own the
 *   document record in the `documents` table.
 * - Downloads file using SUPABASE_SERVICE_ROLE_KEY (never exposed to client).
 * - Returns binary with correct Content-Type and Content-Disposition.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { validateJWT, AuthError, authErrorResponse } from '../_shared/auth.ts';

const BUCKET = 'documents';

/** Deduce MIME type from file extension */
function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    xml: 'application/xml',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    webm: 'video/webm',
  };
  return map[ext] || 'application/octet-stream';
}

/** Get basename from path */
function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || 'download';
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // --- Method validation ---
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    // --- Authentication via shared middleware ---
    const { user } = await validateJWT(req);

    // --- Body validation ---
    let body: { path?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    const filePath = body?.path?.trim();
    if (!filePath || filePath.includes('..') || filePath.startsWith('/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing path. Expected: <folder>/<filename>' }),
        { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } }
      );
    }

    // --- Authorisation ---
    // Strategy: Allow if path starts with user's own folder,
    // OR if the file_url is referenced in a document the user can access.
    const ownsPath = filePath.startsWith(user.id + '/');

    if (!ownsPath) {
      // Check if there's a document record with this path accessible by the user
      // (RLS on documents table will enforce visibility)
      const { data: docRecord, error: docError } = await userClient
        .from('documents')
        .select('id')
        .like('file_url', `%${filePath}%`)
        .limit(1)
        .maybeSingle();

      if (docError || !docRecord) {
        console.warn(
          '[download-document] Forbidden: user does not own path and no matching document'
        );
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        });
      }
    }

    // --- Download using service role ---
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from(BUCKET)
      .download(filePath);

    if (downloadError) {
      console.error('[download-document] Storage download error:', downloadError.message);
      const status = downloadError.message?.includes('not found') ? 404 : 500;
      return new Response(
        JSON.stringify({
          error: status === 404 ? 'File not found' : 'Failed to download file',
        }),
        { status, headers: { ...corsHeaders, 'content-type': 'application/json' } }
      );
    }

    if (!fileData) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      });
    }

    // --- Respond with binary ---
    const contentType = getMimeType(filePath);
    const fileName = basename(filePath);

    // Using `inline` so browsers can preview PDFs/images directly.
    // Switch to `attachment` if forced download is preferred.
    return new Response(fileData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'content-type': contentType,
        'content-disposition': `inline; filename="${fileName}"`,
        'cache-control': 'private, max-age=60',
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return authErrorResponse(e, corsHeaders);
    }
    console.error('[download-document] Unexpected error:', String(e));
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});
