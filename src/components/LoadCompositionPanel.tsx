/**
 * LoadCompositionPanel (v3)
 * Thin wrapper: uses shared controller + shared components.
 * Renders as a Card with tabs, expandable rows, and detail modal.
 */

import { useLoadCompositionController } from '@/hooks/useLoadCompositionController';
import { LoadCompositionSummary } from './load-composition/LoadCompositionSummary';
import { LoadCompositionSuggestionList } from './load-composition/LoadCompositionSuggestionList';
import { LoadCompositionFooter } from './load-composition/LoadCompositionFooter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import { LoadCompositionModal } from './LoadCompositionModal';
import type { CompositionFilterStatus } from '@/hooks/useLoadCompositionController';

export interface LoadCompositionPanelProps {
  shipperId: string;
  dateRange?: { from: Date; to: Date };
}

export function LoadCompositionPanel({ shipperId, dateRange }: LoadCompositionPanelProps) {
  const ctrl = useLoadCompositionController({ shipperId, dateRange });

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Oportunidades de Consolidação</CardTitle>
              <CardDescription>
                Análise por embarcador — janela operacional e aderência ao trajeto
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={ctrl.handleAnalyze}
                disabled={ctrl.isAnalyzing}
                className="gap-2"
              >
                {ctrl.isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Gerar sugestões
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => ctrl.refetch()}
                disabled={ctrl.isLoading}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <LoadCompositionSummary
            totalSuggestions={ctrl.totalSuggestions}
            totalSavingsCents={ctrl.totalSavingsCents}
            feasibleCount={ctrl.feasibleCount}
            realizableCount={ctrl.realizableCount}
            layout="grid"
          />

          <Tabs
            value={ctrl.filterStatus}
            onValueChange={(v) => ctrl.setFilterStatus(v as CompositionFilterStatus)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="approved">Aprovadas</TabsTrigger>
              <TabsTrigger value="executed">Executadas</TabsTrigger>
            </TabsList>

            <TabsContent value={ctrl.filterStatus} className="mt-4">
              <LoadCompositionSuggestionList
                suggestions={ctrl.suggestions}
                quoteInfoMap={ctrl.quoteInfoMap}
                isLoading={ctrl.isLoading}
                error={ctrl.error}
                filterStatus={ctrl.filterStatus}
                expandedIds={ctrl.expandedIds}
                onToggleExpand={ctrl.toggleExpand}
                onApprove={ctrl.handleApprove}
                onView={ctrl.handleViewDetails}
                onCalculateDiscounts={ctrl.handleCalculateDiscounts}
                isApproving={ctrl.isApproving}
                isCalculatingDiscounts={ctrl.isCalculatingDiscounts}
                onRetry={() => ctrl.refetch()}
                layout="expandable"
              />
            </TabsContent>
          </Tabs>

          <LoadCompositionFooter layout="panel" />
        </CardContent>
      </Card>

      {ctrl.showModal && ctrl.selectedCompositionId && (
        <LoadCompositionModal
          compositionId={ctrl.selectedCompositionId}
          onClose={ctrl.handleCloseModal}
          onApprove={ctrl.handleApproveFromModal}
        />
      )}
    </>
  );
}
