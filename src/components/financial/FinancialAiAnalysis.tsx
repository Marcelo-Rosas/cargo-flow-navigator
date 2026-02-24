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
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useEntityInsights, useRequestAiAnalysis } from '@/hooks/useAiInsights';
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
    insights?: string[];
    recommendation?: string;
    summary?: string;
  };

  const risk = analysis?.risk || 'medio';
  const insights = analysis?.insights || [];
  const recommendation = analysis?.recommendation || '';
  const summary = insight.summary_text || analysis?.summary || '';
  const margin = analysis?.margin;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {/* Risk + Margin */}
      <div className="flex items-center justify-between">
        <RiskBadge risk={risk} />
        {margin !== undefined && margin !== null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="w-3 h-3" />
            <span>Margem: <strong className="text-foreground">{margin.toFixed(1)}%</strong></span>
          </div>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
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
              <li key={i} className="text-xs text-muted-foreground list-disc">{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation */}
      {recommendation && (
        <div className="p-2.5 rounded-lg bg-muted/50 border border-border/50">
          <p className="text-xs font-medium mb-1">Recomendação</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{recommendation}</p>
        </div>
      )}

      {/* Timestamp */}
      <p className="text-[10px] text-muted-foreground/60">
        Análise em {new Date(insight.created_at).toLocaleString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
    </motion.div>
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
