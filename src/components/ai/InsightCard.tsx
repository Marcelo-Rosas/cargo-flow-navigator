// src/components/ai/InsightCard.tsx
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RiskBadge } from '@/components/ai/RiskBadge';
import { InsightMetrics } from '@/components/ai/InsightMetrics';
import { InsightChecklist } from '@/components/ai/InsightChecklist';
import { InsightList } from '@/components/ai/InsightList';
import { InsightRecommendation } from '@/components/ai/InsightRecommendation';
import { InsightFeedback } from '@/components/ai/InsightFeedback';
import type { AiAnalysisResult } from '@/types/ai-analysis';
import type { AiInsight } from '@/hooks/useAiInsights';

interface InsightCardProps {
  insight: AiInsight;
}

export function InsightCard({ insight }: InsightCardProps) {
  const analysis = (insight.analysis || {}) as AiAnalysisResult;

  const risk = analysis.risk || 'medio';
  const margin = analysis.metrics?.margem_percent ?? analysis.margin;
  const confidenceScore = analysis.confidence_score;
  const summary = insight.summary_text || analysis.summary || '';
  const details = analysis.details || '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {/* Header: Risco e Confiança */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <RiskBadge risk={risk} />
        <div className="flex items-center gap-2">
          {margin !== undefined && margin !== null && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              <span>
                Margem: <strong className="text-foreground">{Number(margin).toFixed(1)}%</strong>
              </span>
            </div>
          )}
          {confidenceScore !== undefined && (
            <Badge variant="outline" className="text-[10px]">
              {confidenceScore}% confiança
            </Badge>
          )}
        </div>
      </div>

      <InsightMetrics
        anomalyType={analysis.anomaly_type}
        urgencyLevel={analysis.urgency_level}
        approvalConfidence={analysis.approval_confidence}
      />

      {summary && <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>}
      {details && <p className="text-xs text-muted-foreground/80 leading-relaxed">{details}</p>}

      <InsightChecklist checklist={analysis.checklist} />
      <InsightList insights={analysis.insights} />
      <InsightRecommendation
        recommendation={analysis.recommendation}
        recommendationDetail={analysis.recommendation_detail}
      />

      <InsightFeedback
        insightId={insight.id}
        currentRating={insight.user_rating}
        currentFeedback={insight.user_feedback}
        createdAt={insight.created_at}
      />
    </motion.div>
  );
}
