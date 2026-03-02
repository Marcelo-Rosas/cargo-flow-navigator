// src/types/ai-analysis.ts

export type AiRiskLevel = 'baixo' | 'medio' | 'alto' | string;

export interface AiChecklistItem {
  item: string;
  status: 'ok' | 'alerta' | 'erro' | string;
}

export interface AiInsightObject {
  description?: string;
  [key: string]: unknown;
}

export interface AiAnalysisMetrics {
  margem_percent?: number;
  [key: string]: unknown;
}

export interface AiAnalysisResult {
  risk?: AiRiskLevel;
  margin?: number;
  confidence_score?: number;
  anomaly_detected?: boolean;
  anomaly_type?: string;
  urgency_level?: string;
  approval_confidence?: number;
  checklist?: AiChecklistItem[];
  insights?: Array<string | AiInsightObject>;
  recommendation?: string;
  recommendation_detail?: string;
  summary?: string;
  details?: string;
  metrics?: AiAnalysisMetrics;
}
