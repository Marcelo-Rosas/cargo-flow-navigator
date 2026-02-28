/**
 * Supabase Storage utilities for private bucket access.
 *
 * APPROACH: Signed URLs (default)
 * - All document access uses signed URLs generated client-side via Supabase SDK.
 * - The user must be authenticated (RLS policies on storage.objects require it).
 * - URLs expire after `expiresInSeconds` (default 60s).
 * - For proxy download without exposing a signed URL, use the Edge Function
 *   `download-document` (POST /functions/v1/download-document).
 *
 * SECURITY:
 * - Never use getPublicUrl() for the private 'documents' bucket.
 * - Never expose SUPABASE_SERVICE_ROLE_KEY on the client.
 * - The bucket remains private; RLS policies are unchanged.
 */

import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'documents';
const DEFAULT_EXPIRES_SECONDS = 300; // 5 min

/**
 * Extracts the storage path from a file_url stored in the documents table.
 *
 * The `file_url` column may contain:
 *  - A full public URL: `https://<ref>.supabase.co/storage/v1/object/public/documents/<path>`
 *  - A full signed URL: already signed (ignored — we regenerate)
 *  - A bare path: `<user_id>/<timestamp>-<random>.<ext>`
 *
 * This function normalises any of the above to just `<folder>/<filename>`.
 */
export function extractStoragePath(fileUrl: string): string {
  // If it's a full Supabase Storage URL, extract the path after /documents/
  const publicMarker = `/storage/v1/object/public/${BUCKET}/`;
  const signedMarker = `/storage/v1/object/sign/${BUCKET}/`;
  const authMarker = `/storage/v1/object/${BUCKET}/`;

  for (const marker of [publicMarker, signedMarker, authMarker]) {
    const idx = fileUrl.indexOf(marker);
    if (idx !== -1) {
      let path = fileUrl.slice(idx + marker.length);
      // Remove query string (e.g. ?token=...)
      const qIdx = path.indexOf('?');
      if (qIdx !== -1) path = path.slice(0, qIdx);
      return decodeURIComponent(path);
    }
  }

  // If it looks like a bare path already (no http), return as-is
  if (!fileUrl.startsWith('http')) {
    return fileUrl;
  }

  // Fallback: try to get everything after /documents/ in any URL
  const genericIdx = fileUrl.indexOf(`/${BUCKET}/`);
  if (genericIdx !== -1) {
    let path = fileUrl.slice(genericIdx + `/${BUCKET}/`.length);
    const qIdx = path.indexOf('?');
    if (qIdx !== -1) path = path.slice(0, qIdx);
    return decodeURIComponent(path);
  }

  // Last resort: return the URL as-is (will likely fail, but better than crashing)
  return fileUrl;
}

/**
 * Generates a short-lived signed URL for a document stored in the private bucket.
 *
 * @param path  Storage path, e.g. `<user_id>/1234567890-abc.pdf`
 *              Can also be a full file_url — it will be normalised.
 * @param expiresInSeconds  How long the URL is valid (default 300s = 5 min).
 * @returns     The signed URL string. Throws on error.
 */
export async function getDocumentSignedUrl(
  path: string,
  expiresInSeconds: number = DEFAULT_EXPIRES_SECONDS
): Promise<string> {
  const storagePath = extractStoragePath(path);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error('[storage] Failed to create signed URL:', error?.message);
    throw new Error(error?.message || 'Não foi possível gerar URL de acesso ao documento.');
  }

  return data.signedUrl;
}

/**
 * Opens a document in a new tab using a signed URL.
 * Convenience wrapper around getDocumentSignedUrl + window.open.
 */
export async function openDocument(fileUrl: string): Promise<void> {
  const signedUrl = await getDocumentSignedUrl(fileUrl);
  window.open(signedUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Triggers a download for a document using a signed URL.
 * Creates a temporary anchor element with download attribute.
 */
export async function downloadDocument(fileUrl: string, fileName: string): Promise<void> {
  const signedUrl = await getDocumentSignedUrl(fileUrl);
  const a = document.createElement('a');
  a.href = signedUrl;
  a.download = fileName;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
