import { useMemo } from 'react';
import type { FinancialDocType } from '@/types/financial';
import { useFinancialDocumentsKanban } from '@/hooks/useFinancialDocumentsKanban';
import { groupFinancialKanbanColumns } from '@/lib/financial-kanban';

type Options = {
  enabled?: boolean;
};

export function useFinancialBoardData(type: FinancialDocType, options: Options = {}) {
  const query = useFinancialDocumentsKanban({
    type,
    rich: true,
    enabled: options.enabled ?? true,
  });

  const rows = query.data ?? [];

  const columns = useMemo(() => groupFinancialKanbanColumns(rows, type), [rows, type]);

  const overdueCount = useMemo(
    () => rows.reduce((acc, r) => acc + (r.is_overdue ? 1 : 0), 0),
    [rows]
  );

  const countsByStatus = useMemo(() => {
    const out: Record<string, number> = {};
    for (const col of columns) out[col.status] = col.items.length;
    return out;
  }, [columns]);

  return {
    rows,
    columns,
    overdueCount,
    countsByStatus,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
