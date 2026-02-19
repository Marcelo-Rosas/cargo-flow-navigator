import type { FinancialKanbanRow, FinancialKanbanColumn } from '@/types/financial';
import type { FinancialDocType } from '@/types/financial';

/** Colunas do board FAT (a receber) - ERP-first */
export const FAT_COLUMNS: { id: string; label: string; color: string }[] = [
  { id: 'INCLUIR', label: 'Incluir', color: 'bg-muted-foreground' },
  { id: 'GERADO', label: 'Gerado', color: 'bg-accent-foreground' },
  { id: 'AGUARDANDO', label: 'Aguardando', color: 'bg-primary' },
  { id: 'RECEBIDO', label: 'Recebido', color: 'bg-success' },
  { id: 'FINALIZADO', label: 'Finalizado', color: 'bg-muted' },
];

/** Colunas do board PAG (a pagar) - ERP-first */
export const PAG_COLUMNS: { id: string; label: string; color: string }[] = [
  { id: 'INCLUIR', label: 'Incluir', color: 'bg-muted-foreground' },
  { id: 'GERADO', label: 'Gerado', color: 'bg-accent-foreground' },
  { id: 'AGUARDANDO', label: 'Aguardando', color: 'bg-primary' },
  { id: 'PAGO', label: 'Pago', color: 'bg-success' },
  { id: 'FINALIZADO', label: 'Finalizado', color: 'bg-muted' },
];

function getStatusLabel(status: string, type: FinancialDocType): string {
  const cols = type === 'FAT' ? FAT_COLUMNS : PAG_COLUMNS;
  return cols.find((c) => c.id === status)?.label ?? status;
}

/**
 * Agrupa linhas do Kanban por status (ERP-first: INCLUIR, GERADO, etc).
 */
export function groupFinancialKanbanColumns(
  rows: FinancialKanbanRow[],
  type: FinancialDocType
): FinancialKanbanColumn[] {
  const columns = type === 'FAT' ? FAT_COLUMNS : PAG_COLUMNS;
  const byStatus = new Map<string, FinancialKanbanRow[]>();

  for (const row of rows) {
    const status = (row.status ?? 'INCLUIR') as string;
    const list = byStatus.get(status) ?? [];
    list.push(row);
    byStatus.set(status, list);
  }

  return columns.map((col) => ({
    status: col.id,
    label: col.label,
    items: byStatus.get(col.id) ?? [],
  }));
}
