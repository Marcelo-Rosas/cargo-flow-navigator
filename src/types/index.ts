// CRM Vectra Cargo - Type Definitions

export type UserRole = 'admin' | 'comercial' | 'operacao' | 'fiscal' | 'leitura';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

// Quote/Deal Types
export type QuoteStage =
  | 'novo_pedido'
  | 'qualificacao'
  | 'precificacao'
  | 'enviado'
  | 'negociacao'
  | 'ganho'
  | 'perdido';

export interface Quote {
  id: string;
  clientName: string;
  clientEmail?: string;
  origin: string;
  destination: string;
  value: number;
  stage: QuoteStage;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  assignedTo?: string;
  notes?: string;
  weight?: number;
  volume?: number;
  cargoType?: string;
}

// Service Order Types
export type OrderStage =
  | 'ordem_criada'
  | 'busca_motorista'
  | 'documentacao'
  | 'coleta_realizada'
  | 'em_transito'
  | 'entregue';

export interface ServiceOrder {
  id: string;
  osNumber: string;
  quoteId?: string;
  clientName: string;
  origin: string;
  destination: string;
  value: number;
  stage: OrderStage;
  driverName?: string;
  driverPhone?: string;
  vehiclePlate?: string;
  eta?: Date;
  createdAt: Date;
  updatedAt: Date;
  hasNfe: boolean;
  hasCte: boolean;
  hasPod: boolean;
  occurrences: Occurrence[];
}

// Occurrence Types
export type OccurrenceSeverity = 'baixa' | 'media' | 'alta' | 'critica';

export interface Occurrence {
  id: string;
  orderId: string;
  description: string;
  severity: OccurrenceSeverity;
  createdAt: Date;
  resolvedAt?: Date;
  createdBy: string;
}

// Document Types
export type DocumentType = 'nfe' | 'cte' | 'pod' | 'outros';

export interface Document {
  id: string;
  orderId?: string;
  quoteId?: string;
  type: DocumentType;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: Date;
  uploadedBy: string;
  validationStatus?: 'pending' | 'valid' | 'invalid';
  nfeKey?: string;
}

// Dashboard KPI Types
export interface DashboardKPIs {
  pipelineValue: number;
  conversionRate: number;
  activeOrders: number;
  deliveriesToday: number;
  pendingDocuments: number;
  criticalAlerts: number;
}

// Stage configurations for boards
export const QUOTE_STAGES: { id: QuoteStage; label: string; color: string }[] = [
  { id: 'novo_pedido', label: 'Novo Pedido', color: 'bg-muted' },
  { id: 'qualificacao', label: 'Qualificação', color: 'bg-accent' },
  { id: 'precificacao', label: 'Precificação', color: 'bg-primary/20' },
  { id: 'enviado', label: 'Enviado', color: 'bg-warning/20' },
  { id: 'negociacao', label: 'Negociação', color: 'bg-warning/30' },
  { id: 'ganho', label: 'Ganho', color: 'bg-success/20' },
  { id: 'perdido', label: 'Perdido', color: 'bg-destructive/20' },
];

export const ORDER_STAGES: { id: OrderStage; label: string; color: string }[] = [
  { id: 'ordem_criada', label: 'Ordem Criada', color: 'bg-muted' },
  { id: 'busca_motorista', label: 'Busca Motorista', color: 'bg-accent' },
  { id: 'documentacao', label: 'Documentação', color: 'bg-primary/20' },
  { id: 'coleta_realizada', label: 'Coleta Realizada', color: 'bg-warning/20' },
  { id: 'em_transito', label: 'Em Trânsito', color: 'bg-warning/30' },
  { id: 'entregue', label: 'Entregue', color: 'bg-success/20' },
];
