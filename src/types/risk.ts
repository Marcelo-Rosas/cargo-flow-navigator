// Risk Workflow types

export type RiskCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskEvaluationStatus = 'pending' | 'evaluated' | 'approved' | 'rejected' | 'expired';

export interface RiskPolicy {
  id: string;
  code: string;
  name: string;
  policy_type: string;
  insurer: string | null;
  endorsement: string | null;
  risk_manager: string | null;
  valid_from: string;
  valid_until: string | null;
  coverage_limit: number | null;
  deductible: number | null;
  is_active: boolean;
}

export interface RiskPolicyRule {
  id: string;
  policy_id: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  criticality: RiskCriticality;
  criticality_boost: number;
  requirements: string[];
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface RiskServiceCatalog {
  id: string;
  code: string;
  name: string;
  provider: string;
  unit_cost: number;
  cost_type: 'fixed' | 'percentage';
  scope: 'per_trip' | 'per_order' | 'per_driver';
  required_when: string | null;
  validity_days: number | null;
  is_active: boolean;
}

export interface RiskEvaluation {
  id: string;
  entity_type: 'order' | 'trip';
  entity_id: string;
  policy_id: string | null;
  criticality: RiskCriticality;
  status: RiskEvaluationStatus;
  cargo_value_evaluated: number | null;
  requirements: string[];
  requirements_met: Record<string, boolean>;
  route_municipalities: string[] | null;
  policy_rules_applied: string[] | null;
  evaluation_notes: string | null;
  evaluated_by: string | null;
  evaluated_at: string | null;
  approval_request_id: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiskEvidence {
  id: string;
  evaluation_id: string;
  evidence_type: 'buonny_check' | 'document' | 'route_analysis' | 'manual_note';
  document_id: string | null;
  payload: Record<string, unknown>;
  status: 'valid' | 'expired' | 'rejected';
  expires_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface RiskCost {
  id: string;
  order_id: string | null;
  trip_id: string | null;
  service_id: string;
  service_code: string;
  unit_cost: number;
  quantity: number;
  total_cost: number;
  scope: string;
  apportioned: boolean;
  evaluation_id: string | null;
}

export interface OrderRiskStatus {
  order_id: string;
  os_number: string | null;
  stage: string;
  cargo_value: number | null;
  trip_id: string | null;
  evaluation_id: string | null;
  criticality: RiskCriticality | null;
  risk_status: RiskEvaluationStatus | null;
  requirements: string[] | null;
  requirements_met: Record<string, boolean> | null;
  approval_request_id: string | null;
  total_risk_cost: number;
  buonny_valid: boolean;
}

export const CRITICALITY_CONFIG: Record<
  RiskCriticality,
  {
    label: string;
    color: string;
    badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
  }
> = {
  LOW: { label: 'Baixo', color: 'bg-green-500', badgeVariant: 'secondary' },
  MEDIUM: { label: 'Médio', color: 'bg-yellow-500', badgeVariant: 'default' },
  HIGH: { label: 'Alto', color: 'bg-orange-500', badgeVariant: 'destructive' },
  CRITICAL: { label: 'Crítico', color: 'bg-red-600', badgeVariant: 'destructive' },
};

export const REQUIREMENT_LABELS: Record<string, string> = {
  buonny_consulta: 'Consulta Buonny',
  buonny_cadastro: 'Cadastro Buonny',
  monitoramento: 'Monitoramento',
  gr_doc: 'Análise GR',
  rota_doc: 'Rota Documentada',
};
