import type { FinancialKanbanRow, FinancialKanbanColumn } from '@/types/financial';

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  em_analise: 'Em Análise',
  aprovado: 'Aprovado',
  pago: 'Pago',
  recebido: 'Recebido',
  cancelado: 'Cancelado',
};

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * Agrupa linhas do Kanban por status.
 */
export function groupFinancialKanbanColumns(
  rows: FinancialKanbanRow[],
  _type: 'FAT' | 'PAG'
): FinancialKanbanColumn[] {
  const byStatus = new Map<string, FinancialKanbanRow[]>();

  for (const row of rows) {
    const status = row.status ?? 'pendente';
    const list = byStatus.get(status) ?? [];
    list.push(row);
    byStatus.set(status, list);
  }

  const statusOrder = ['pendente', 'em_analise', 'aprovado', 'pago', 'recebido', 'cancelado'];
  const ordered = [...byStatus.entries()].sort(
    ([a], [b]) => statusOrder.indexOf(a) - statusOrder.indexOf(b) || a.localeCompare(b)
  );

  return ordered.map(([status, items]) => ({
    status,
    label: getStatusLabel(status),
    items,
  }));
}
