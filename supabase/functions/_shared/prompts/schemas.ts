interface AnalysisMeta {
  _model?: string;
  _cost_usd?: number;
  _provider?: string;
  _duration_ms?: number;
  [key: string]: unknown;
}

export interface OccurrenceDetail {
  description: string;
  severity: string;
}

export interface RealProfitabilityMetrics {
  custo_carreteiro_real: number;
  resultado_liquido_real: number;
  margem_percent_real: number;
  desvio_margem_prevista_real?: number;
  is_reconciled: boolean;
  pedagio_real?: number;
  descarga_real?: number;
  ocorrencias?: OccurrenceDetail[];
}

export interface QuoteProfitabilityResult extends AnalysisMeta {
  risk: 'baixo' | 'medio' | 'alto';
  confidence_score?: number;
  metrics?: {
    margem_percent?: number;
    margem_vs_media?: 'acima' | 'abaixo' | 'na_media';
    desvio_da_media_pct?: number;
    atende_piso_antt?: boolean;
    valor_por_km?: number | null;
  };
  recommendation?: string;
  summary?: string;
  details?: string;
  real_profitability?: RealProfitabilityMetrics;
}

export interface FinancialAnomalyResult extends AnalysisMeta {
  risk: 'baixo' | 'medio' | 'alto';
  anomaly_detected?: boolean;
  anomaly_type?:
    | 'none'
    | 'outlier_high'
    | 'outlier_low'
    | 'pattern_break'
    | 'duplicate_suspect'
    | 'integrity_issue'
    | 'payment_term_mismatch'
    | 'margin_below_target';
  confidence_score?: number;
  metrics?: {
    z_score?: number | null;
    desvio_da_media_pct?: number;
    posicao_historica?: string;
    margem_percent?: number | null;
    compliance_score?: number | null;
  };
  insights?: string[];
  recommendation?: string;
  summary?: string;
  details?: string;
}

export interface ApprovalSummaryResult extends AnalysisMeta {
  risk: 'baixo' | 'medio' | 'alto';
  urgency_level?: 'baixa' | 'media' | 'alta' | 'critica';
  approval_confidence?: number;
  checklist?: Array<{ item: string; status: 'ok' | 'alerta' | 'falha' }>;
  metrics?: {
    valor_total?: number;
    tipo_documento?: string;
    origem_vinculada?: boolean;
  };
  recommendation?: string;
  recommendation_detail?: string;
  summary?: string;
}

export interface DriverQualificationResult extends AnalysisMeta {
  risk: 'baixo' | 'medio' | 'alto';
  risk_score?: number;
  risk_flags?: Array<{ flag: string; severity: 'info' | 'warning' | 'critical'; detail: string }>;
  checklist?: {
    cnh_valid?: boolean;
    cnh_category_ok?: boolean;
    crlv_active?: boolean;
    antt_rntrc_valid?: boolean;
    tag_pedagio?: boolean;
    vpo_eligible?: boolean;
    comp_residencia?: boolean;
  };
  recommendation?: string;
  summary?: string;
  qualification_status?: 'aprovado' | 'em_analise' | 'bloqueado';
}

export interface ComplianceRuleEvaluation {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface ComplianceViolation {
  rule: string;
  severity: 'warning' | 'critical';
  detail: string;
  remediation?: string;
}

export interface ComplianceCheckResult extends AnalysisMeta {
  risk: 'baixo' | 'medio' | 'alto';
  status?: 'ok' | 'warning' | 'violation';
  rules_evaluated?: ComplianceRuleEvaluation[];
  violations?: ComplianceViolation[];
  summary?: string;
  recommendation?: string;
}

export interface DashboardInsight {
  type: 'opportunity' | 'warning' | 'alert';
  title: string;
  description: string;
  action_item?: string;
  priority?: 'alta' | 'media' | 'baixa';
}

export interface DashboardInsightsResult extends AnalysisMeta {
  risk: 'baixo' | 'medio' | 'alto';
  insights?: DashboardInsight[];
  metrics?: {
    conversion_rate?: number;
    revenue_total?: number;
    expenses_total?: number;
    net_result?: number;
    trend_direction?: 'up' | 'down' | 'stable';
  };
  forecast?: {
    next_30d_revenue_estimate?: number | null;
    confidence?: 'alta' | 'media' | 'baixa';
    basis?: string;
  };
  recommendation?: string;
  summary?: string;
}

export interface OperationalReportAlert {
  type: string;
  message: string;
  priority: 'alta' | 'media' | 'baixa';
}

export interface OperationalReportResult {
  risk: 'baixo' | 'medio' | 'alto';
  summary?: string;
  metrics?: {
    orders_by_stage?: Record<string, number>;
    completed_today?: number;
    created_today?: number;
    avg_lead_time_hours?: number;
    open_occurrences?: number;
    critical_occurrences?: number;
    pending_docs_count?: number;
    compliance_violations?: number;
  };
  alerts?: OperationalReportAlert[];
  recommendation?: string;
  [key: string]: unknown;
}

export interface RegulatoryUpdateResult {
  risk: 'baixo' | 'medio' | 'alto';
  relevance_score?: number;
  summary?: string;
  action_required?: boolean;
  impact_areas?: string[];
  recommendation?: string;
  [key: string]: unknown;
}

const VALID_RISKS = ['baixo', 'medio', 'alto'];

function parseJsonFromText(text: string): Record<string, unknown> | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    return null;
  }
}

function ensureRisk(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj.risk || !VALID_RISKS.includes(String(obj.risk))) {
    obj.risk = 'medio';
  }
  return obj;
}

function ensureSummary(obj: Record<string, unknown>, rawText: string): Record<string, unknown> {
  if (!obj.summary || typeof obj.summary !== 'string') {
    obj.summary = rawText.substring(0, 300);
  }
  return obj;
}

export function validateAndParse<T extends Record<string, unknown>>(
  rawText: string,
  analysisType: string
): T {
  let parsed = parseJsonFromText(rawText);

  if (!parsed) {
    parsed = { raw: rawText, risk: 'medio', summary: rawText.substring(0, 300) };
  }

  ensureRisk(parsed);
  ensureSummary(parsed, rawText);

  if (analysisType === 'financial_anomaly' && parsed.anomaly_detected === undefined) {
    parsed.anomaly_detected = parsed.risk === 'alto';
    if (!parsed.anomaly_type) parsed.anomaly_type = 'none';
  }

  if (analysisType === 'approval_summary') {
    if (!parsed.urgency_level) parsed.urgency_level = 'media';
    if (parsed.approval_confidence === undefined) parsed.approval_confidence = 50;
  }

  if (analysisType === 'dashboard_insights' || analysisType === 'operational_insights') {
    if (!Array.isArray(parsed.insights)) parsed.insights = [];
  }

  if (analysisType === 'operational_report') {
    if (!Array.isArray(parsed.alerts)) parsed.alerts = [];
    if (!parsed.metrics) parsed.metrics = {};
  }

  if (analysisType === 'regulatory_update') {
    if (parsed.relevance_score === undefined) parsed.relevance_score = 0;
    if (parsed.action_required === undefined) parsed.action_required = false;
    if (!Array.isArray(parsed.impact_areas)) parsed.impact_areas = [];
  }

  if (analysisType === 'compliance_check') {
    if (!parsed.status) {
      const hasViolations = Array.isArray(parsed.violations) && parsed.violations.length > 0;
      parsed.status = hasViolations ? 'violation' : 'ok';
    }
    if (!Array.isArray(parsed.rules_evaluated)) parsed.rules_evaluated = [];
    if (!Array.isArray(parsed.violations)) parsed.violations = [];
  }

  if (analysisType === 'driver_qualification') {
    if (parsed.risk_score === undefined) parsed.risk_score = 50;
    if (!Array.isArray(parsed.risk_flags)) parsed.risk_flags = [];
    if (!parsed.checklist || typeof parsed.checklist !== 'object') {
      parsed.checklist = {};
    }
    if (!parsed.qualification_status) {
      const score = Number(parsed.risk_score) || 0;
      parsed.qualification_status =
        score >= 70 ? 'aprovado' : score >= 40 ? 'em_analise' : 'bloqueado';
    }
  }

  return parsed as T;
}
