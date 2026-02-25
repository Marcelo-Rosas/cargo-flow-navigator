import { motion } from 'framer-motion';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Loader2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboardInsights, useRequestAiAnalysis } from '@/hooks/useAiInsights';
import { useToast } from '@/hooks/use-toast';

const typeIcons: Record<string, typeof TrendingUp> = {
  opportunity: Lightbulb,
  warning: AlertTriangle,
  alert: AlertTriangle,
};

const typeColors: Record<string, string> = {
  opportunity: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
  warning: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
  alert: 'text-red-600 bg-red-50 dark:bg-red-950/30',
};

export function AiInsightsWidget() {
  const { data: insight, isLoading } = useDashboardInsights();
  const requestAnalysis = useRequestAiAnalysis();
  const { toast } = useToast();

  const analysis = insight?.analysis ?? null;
  const insights = (analysis?.insights as Array<Record<string, string>>) ?? [];
  const summary = (analysis?.summary as string) ?? null;
  const risk = (analysis?.risk as string) ?? null;

  const handleRefresh = () => {
    requestAnalysis.mutate(
      {
        analysisType: 'dashboard_insights',
        entityId: '',
        entityType: '',
      },
      {
        onSuccess: () => {
          toast({
            title: 'Análise gerada',
            description: 'Os insights foram atualizados com sucesso.',
          });
        },
        onError: (error) => {
          toast({
            title: 'Erro ao gerar análise',
            description: error instanceof Error ? error.message : 'Erro desconhecido. Tente novamente.',
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="p-5 rounded-xl border bg-card shadow-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <Brain className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <h3 className="text-sm font-semibold">Insights AI</h3>
          {risk && (
            <Badge
              variant="outline"
              className={`text-[10px] ${
                risk === 'baixo'
                  ? 'border-green-300 text-green-600'
                  : risk === 'alto'
                    ? 'border-red-300 text-red-600'
                    : 'border-amber-300 text-amber-600'
              }`}
            >
              Risco {risk}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleRefresh}
          disabled={requestAnalysis.isPending}
        >
          {requestAnalysis.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm">Carregando insights...</span>
        </div>
      )}

      {/* Error state */}
      {requestAnalysis.isError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 mb-3">
          <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-red-700 dark:text-red-400">Falha ao gerar análise</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
              {requestAnalysis.error instanceof Error ? requestAnalysis.error.message : 'Erro desconhecido'}
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !insight && (
        <div className="text-center py-6">
          <Brain className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mb-3">
            Nenhuma análise disponível ainda
          </p>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={requestAnalysis.isPending}>
            {requestAnalysis.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                Gerando...
              </>
            ) : (
              <>
                <Brain className="w-3.5 h-3.5 mr-1" />
                Gerar análise
              </>
            )}
          </Button>
        </div>
      )}

      {/* Content */}
      {insight && (
        <div className="space-y-3">
          {/* Summary */}
          {summary && (
            <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
          )}

          {/* Insight items */}
          {insights.slice(0, 4).map((item, i) => {
            const IconComponent = typeIcons[item.type] || Lightbulb;
            const colorClass = typeColors[item.type] || typeColors.opportunity;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className={`shrink-0 p-1.5 rounded-md ${colorClass}`}>
                  <IconComponent className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            );
          })}

          {/* Timestamp */}
          {insight.created_at && (
            <p className="text-[10px] text-muted-foreground text-right">
              Atualizado em{' '}
              {new Date(insight.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}
