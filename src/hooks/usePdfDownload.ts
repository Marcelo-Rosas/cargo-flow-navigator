import { useState, useCallback } from 'react';

export function usePdfDownload() {
  const [loading, setLoading] = useState<string | false>(false);
  const downloadQuotePdf = useCallback(async (_quoteId: string, _mode: string) => {
    setLoading(false);
  }, []);
  return { downloadQuotePdf, loading };
}
