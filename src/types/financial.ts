/** Tipos do documento financeiro: FAT (a receber) ou PAG (a pagar) */
export type FinancialDocType = 'FAT' | 'PAG';

/** Linha do Kanban financeiro (enriquecida pela view) */
export interface FinancialKanbanRow {
  id: string;
  status: string;
  is_overdue: boolean;
  due_date?: string | null;
  amount?: number | null;
  description?: string | null;
  client_name?: string | null;
  supplier_name?: string | null;
  [key: string]: unknown;
}

/** Coluna do Kanban agrupada por status */
export interface FinancialKanbanColumn {
  status: string;
  label: string;
  items: FinancialKanbanRow[];
}
