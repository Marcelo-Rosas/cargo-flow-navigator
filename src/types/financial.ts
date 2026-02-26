/** Tipos do documento financeiro: FAT (a receber) ou PAG (a pagar) */
export type FinancialDocType = 'FAT' | 'PAG';

/** Linha do Kanban financeiro (enriquecida pela view) */
export interface FinancialKanbanRow {
  id: string;
  type: FinancialDocType;
  code?: string | null;
  status: string;
  source_type?: string | null;
  source_id?: string | null;
  total_amount?: number | null;
  is_overdue: boolean;
  due_date?: string | null;
  next_due_date?: string | null;
  installments_total?: number | null;
  installments_pending?: number | null;
  installments_settled?: number | null;
  notes?: string | null;
  created_at?: string | null;

  // Enriched from quote/order
  client_name?: string | null;
  supplier_name?: string | null;
  origin?: string | null;
  destination?: string | null;
  origin_cep?: string | null;
  destination_cep?: string | null;
  quote_value?: number | null;
  order_value?: number | null;
  shipper_name?: string | null;

  // Cargo data
  cargo_type?: string | null;
  weight?: number | null;
  volume?: number | null;

  // Pricing details
  km_distance?: number | null;
  freight_type?: string | null;
  freight_modality?: string | null;
  toll_value?: number | null;
  pricing_breakdown?: Record<string, unknown> | null;

  // Vehicle type
  vehicle_type_name?: string | null;
  vehicle_type_code?: string | null;
  axes_count?: number | null;

  // Payment term
  payment_term_name?: string | null;
  payment_term_code?: string | null;
  payment_term_days?: number | null;
  payment_term_adjustment?: number | null;
  payment_term_advance?: number | null;

  // PAG-specific
  carreteiro_real?: number | null;
  carreteiro_antt?: number | null;

  // Trip
  trip_id?: string | null;
  trip_number?: string | null;

  // Allow additional fields from views
  [key: string]: unknown;
}

/** Coluna do Kanban agrupada por status */
export interface FinancialKanbanColumn {
  status: string;
  label: string;
  items: FinancialKanbanRow[];
}
