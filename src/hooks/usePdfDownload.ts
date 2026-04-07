import { useState, useCallback } from 'react';

export function usePdfDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const download = useCallback(async (_opts: Record<string, unknown>) => {
    setIsDownloading(false);
  }, []);
  return { download, isDownloading };
}
