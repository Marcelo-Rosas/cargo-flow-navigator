import { useQuery } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { extractStoragePath } from '@/lib/storage';

interface SignedUrlResponse {
  signedUrl: string;
}

/**
 * React hook that generates a signed URL for a document via the
 * `generate-signed-url` Edge Function (server-side, service role key).
 *
 * URLs expire after `expiresIn` seconds (default 3600 = 1 hour).
 * The hook caches the result for half the expiry time to avoid unnecessary refetches.
 *
 * @param fileUrl  Storage path or full URL from the `documents.file_url` column.
 *                 Pass `null`/`undefined`/`''` to disable the query.
 * @param expiresIn  URL lifetime in seconds (default 3600).
 *
 * @example
 * ```tsx
 * const { data: signedUrl, isLoading } = useSignedUrl(doc.file_url);
 * if (signedUrl) window.open(signedUrl, '_blank');
 * ```
 */
export function useSignedUrl(fileUrl: string | null | undefined, expiresIn = 3600) {
  const storagePath = fileUrl ? extractStoragePath(fileUrl) : '';

  return useQuery({
    queryKey: ['signed-url', storagePath, expiresIn],
    queryFn: async () => {
      const result = await invokeEdgeFunction<SignedUrlResponse>('generate-signed-url', {
        body: { path: storagePath, expiresIn },
      });
      return result.signedUrl;
    },
    enabled: !!storagePath,
    // Cache for half the expiry time — fresh URL well before it expires
    staleTime: (expiresIn / 2) * 1000,
    gcTime: expiresIn * 1000,
    // Don't refetch on window focus (URL is still valid)
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
