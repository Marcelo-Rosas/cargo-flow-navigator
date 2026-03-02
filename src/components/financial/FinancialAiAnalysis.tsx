import { motion, AnimatePresence } from 'framer-motion';
import { Brain, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useEntityInsights, useRequestAiAnalysis } from '@/hooks/useAiInsights';
import { AnalysisSkeleton } from '@/components/ai/AnalysisSkeleton';
import { InsightCard } from '@/components/ai/InsightCard';

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
            <p className="text-xs text-muted-foreground">Nenhuma análise disponível.</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Clique em "Analisar com AI" para gerar insights.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
