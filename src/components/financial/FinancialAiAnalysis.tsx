import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Lightbulb,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useEntityInsights, useRequestAiAnalysis, useRateInsight } from '@/hooks/useAiInsights';
import type { AiInsight } from '@/hooks/useAiInsights';

// ─────────────────────────────────────────────────────
// Risk Badge
// ─────────────────────────────────────────────────────

const RISK_CONFIG = {
  baixo: {
    icon: ShieldCheck,
    label: 'Risco Baixo',
    variant: 'default' as const,
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  },
  medio: {
    icon: ShieldQuestion,
    label: 'Risco Médio',
    variant: 'default' as const,
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  },
  alto: {
    icon: ShieldAlert,
    label: 'Risco Alto',
    variant: 'default' as const,
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  },
} as const;

function RiskBadge({ risk }: { risk: string }) {
  const config = RISK_CONFIG[risk as keyof typeof RISK_CONFIG] || RISK_CONFIG.medio;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

// ─────────────────────────────────────────────────────
// Insight Card
// ─────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: AiInsight }) {
  const analysis = insight.analysis as {
    risk?: string;
    margin?: number;
    confidence_score?: number;
    anomaly_detected?: boolean;
    anomaly_type?: string;
    urgency_level?: string;
    approval_confidence?: number;
    checklist?: Array<{ item: string; status: string }>;
    insights?: string[];
    recommendation?: string;
    recommendation_detail?: string;
    summary?: string;
    details?: string;
    metrics?: Record<string, unknown>;
  };

  const risk = analysis?.risk || 'medio';
  const insights = analysis?.insights || [];
  const recommendation = analysis?.recommendation || '';
  const recommendationDetail = analysis?.recommendation_detail || '';
  const summary = insight.summary_text || analysis?.summary || '';
  const details = analysis?.details || '';
  const margin = analysis?.metrics?.margem_percent as number | undefined ?? analysis?.margin;
  const confidenceScore = analysis?.confidence_score;
  const anomalyType = analysis?.anomaly_type;
  const urgencyLevel = analysis?.urgency_level;
  const approvalConfidence = analysis?.approval_confidence;
  const checklist = analysis?.checklist;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {/* Risk + Confidence */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <RiskBadge risk={risk} />
        <div className="flex items-center gap-2">
          {margin !== undefined && margin !== null && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              <span>Margem: <strong className="text-foreground">{Number(margin).toFixed(1)}%</strong></span>
            </div>
          )}
          {confidenceScore !== undefined && (
            <Badge variant="outline" className="text-[10px]">
              {confidenceScore}% confianca
            </Badge>
          )}
        </div>
      </div>

      {/* Anomaly / Urgency / Approval badges */}
      {(anomalyType || urgencyLevel || approvalConfidence !== undefined) && (
        <div className="flex flex-wrap gap-1.5">
          {anomalyType && anomalyType !== 'none' && (
            <Badge variant="outline" className="text-[10px] border-red-300 text-red-600">
              <AlertTriangle className="w-3 h-3 mr-0.5" />
              {anomalyType.replace(/_/g, ' ')}
            </Badge>
          )}
          {urgencyLevel && (
            <Badge variant="outline" className={`text-[10px] ${
              urgencyLevel === 'critica' || urgencyLevel === 'alta' ? 'border-red-300 text-red-600' :
              urgencyLevel === 'media' ? 'border-amber-300 text-amber-600' : 'border-gray-300 text-gray-500'
            }`}>
              Urgencia: {urgencyLevel}
            </Badge>
          )}
          {approvalConfidence !== undefined && (
            <Badge variant="outline" className="text-[10px]">
              Confianca: {approvalConfidence}%
            </Badge>
          )}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
      )}

      {/* Details */}
      {details && (
        <p className="text-xs text-muted-foreground/80 leading-relaxed">{details}</p>
      )}

      {/* Checklist (for approvals) */}
      {checklist && checklist.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium">Checklist</span>
          <div className="space-y-1">
            {checklist.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  c.status === 'ok' ? 'bg-green-500' : c.status === 'alerta' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                <span className="text-muted-foreground">{c.item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights list */}
      {insights.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-medium">Insights</span>
          </div>
          <ul className="space-y-1 pl-5">
            {insights.map((item, i) => (
              <li key={i} className="text-xs text-muted-foreground list-disc">
                {typeof item === 'string'
                  ? item
                  : typeof item === 'object' && item !== null && 'description' in item
                    ? String((item as { description?: unknown }).description ?? JSON.stringify(item))
                    : JSON.stringify(item)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation */}
      {(recommendation || recommendationDetail) && (
        <div className="p-2.5 rounded-lg bg-muted/50 border border-border/50">
          <p className="text-xs font-medium mb-1">Recomendacao</p>
          {recommendation && <p className="text-xs font-semibold text-foreground">{recommendation}</p>}
          {recommendationDetail && <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{recommendationDetail}</p>}
        </div>
      )}

      {/* Feedback + Timestamp */}
      <div className="flex items-center justify-between pt-1">
        <InsightFeedback insightId={insight.id} currentRating={insight.user_rating} />
        <p className="text-[10px] text-muted-foreground/60">
          Analise em {new Date(insight.created_at).toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────
// Insight Feedback (thumbs up/down)
// ─────────────────────────────────────────────────────

function InsightFeedback({ insightId, currentRating }: { insightId: string; currentRating: number | null }) {
  const rateInsight = useRateInsight();

  const handleRate = (rating: number) => {
    if (currentRating === rating) return;
    rateInsight.mutate({ insightId, rating });
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground mr-1">Util?</span>
      <button
        onClick={() => handleRate(5)}
        disabled={rateInsight.isPending}
        className={`p-1 rounded transition-colors ${
          currentRating === 5
            ? 'text-green-600 bg-green-50 dark:bg-green-900/30'
            : 'text-muted-foreground/50 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
        }`}
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <button
        onClick={() => handleRate(1)}
        disabled={rateInsight.isPending}
        className={`p-1 rounded transition-colors ${
          currentRating === 1
            ? 'text-red-600 bg-red-50 dark:bg-red-900/30'
            : 'text-muted-foreground/50 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
        }`}
      >
        <ThumbsDown className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Loading Skeleton
// ─────────────────────────────────────────────────────

function AnalysisSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-5 w-24 rounded-full bg-muted" />
        <div className="h-4 w-16 rounded bg-muted" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-4/5 rounded bg-muted" />
      </div>
      <div className="space-y-1">
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
      <div className="h-16 w-full rounded-lg bg-muted" />
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────

interface FinancialAiAnalysisProps {
  entityId: string;
  entityType: string;
}

export function FinancialAiAnalysis({ entityId, entityType }: FinancialAiAnalysisProps) {
  const { data: insights, isLoading } = useEntityInsights(entityType, entityId);
  const requestAnalysis = useRequestAiAnalysis();

  const latestInsight = insights?.[0] ?? null;
  const isExpired = latestInsight?.expires_at
    ? new Date(latestInsight.expires_at) < new Date()
    : false;
  const hasValidInsight = latestInsight && !isExpired;

  const handleAnalyze = () => {
    requestAnalysis.mutate({
      analysisType: 'financial_anomaly',
      entityId,
      entityType,
    });
  };

  return (
    <div className="pt-3">
      <Separator className="mb-3" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Brain className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-semibold">Análise AI</span>
        </div>

        {/* Analyze / Re-analyze button */}
        {(!hasValidInsight || isExpired) && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={handleAnalyze}
            disabled={requestAnalysis.isPending}
          >
            {requestAnalysis.isPending ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Brain className="w-3 h-3" />
                {isExpired ? 'Reanalisar' : 'Analisar com AI'}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {requestAnalysis.isPending ? (
          <AnalysisSkeleton key="loading" />
        ) : requestAnalysis.isError ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          >
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400">
              Erro ao analisar: {requestAnalysis.error?.message || 'Tente novamente'}
            </p>
          </motion.div>
        ) : isLoading ? (
          <AnalysisSkeleton key="initial-loading" />
        ) : hasValidInsight ? (
          <InsightCard key="insight" insight={latestInsight} />
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-4"
          >
            <Brain className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">
              Nenhuma análise disponível.
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Clique em "Analisar com AI" para gerar insights.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
