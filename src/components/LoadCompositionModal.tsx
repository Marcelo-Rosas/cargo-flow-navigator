/**
 * Component: LoadCompositionModal
 * 4-tab detailed view of composition suggestion:
 * 1. Overview - score, savings, consolidation metrics
 * 2. Route - map visualization with polylines and legs
 * 3. Financial - cost breakdown and savings analysis
 * 4. Warnings - validation warnings and constraints
 */

import React, { useMemo } from 'react';
import { useLoadCompositionSuggestion } from '@/hooks/useLoadCompositionSuggestions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, MapPin, DollarSign, CheckCircle, Loader } from 'lucide-react';
import { RouteMapVisualization } from './RouteMapVisualization';
import { DiscountProposalBreakdown } from './DiscountProposalBreakdown';

export interface LoadCompositionModalProps {
  compositionId: string;
  onClose: () => void;
  onApprove: () => void;
}

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Aprovado', color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejeitado', color: 'bg-red-100 text-red-800' },
  executed: { label: 'Executado', color: 'bg-blue-100 text-blue-800' },
};

export function LoadCompositionModal({
  compositionId,
  onClose,
  onApprove,
}: LoadCompositionModalProps) {
  const { data: composition, isLoading, error } = useLoadCompositionSuggestion(compositionId);

  const status = composition ? statusConfig[composition.status] : null;
  const isExecutable = composition?.status === 'pending' && composition?.is_feasible;

  // Calculate totals from metrics
  const metrics = useMemo(() => {
    if (!composition?.metrics) {
      return {
        originalCost: 0,
        composedCost: 0,
        savings: 0,
        savingsPercent: 0,
        originalKm: 0,
        composedKm: 0,
        efficiency: 0,
        co2Reduction: 0,
      };
    }

    return {
      originalCost: composition.metrics.original_total_cost / 100,
      composedCost: composition.metrics.composed_total_cost / 100,
      savings: composition.metrics.savings_brl / 100,
      savingsPercent: composition.metrics.savings_percent || 0,
      originalKm: composition.metrics.original_km_total || 0,
      composedKm: composition.metrics.composed_km_total || 0,
      efficiency: composition.metrics.km_efficiency_percent || 0,
      co2Reduction: composition.metrics.co2_reduction_kg || 0,
    };
  }, [composition]);

  if (isLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <Skeleton className="h-6 w-1/3" />
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !composition) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Erro ao carregar detalhes</DialogTitle>
          </DialogHeader>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Não foi possível carregar</p>
              <p className="text-xs text-red-700 mt-1">
                {error instanceof Error ? error.message : 'Tente novamente'}
              </p>
            </div>
          </div>
          <Button onClick={onClose} variant="outline" className="w-full mt-4">
            Fechar
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="flex items-center gap-2">
                Consolidação de {composition.quote_ids.length} Cargas
                <Badge className={status?.color}>{status?.label}</Badge>
              </DialogTitle>
              <DialogDescription className="mt-1">
                ID: {composition.id} • Score: {composition.consolidation_score.toFixed(0)}%
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-4">
              <TabsTrigger value="overview">Resumo</TabsTrigger>
              <TabsTrigger value="route">Rota</TabsTrigger>
              <TabsTrigger value="financial">Financeiro</TabsTrigger>
              <TabsTrigger value="discounts">Descontos</TabsTrigger>
              <TabsTrigger value="warnings">Validação</TabsTrigger>
            </TabsList>

            {/* Tab 1: Overview */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="text-xs font-medium text-blue-600 mb-2">Viabilidade</div>
                  <div className="text-3xl font-bold text-blue-700 mb-2">
                    {composition.consolidation_score.toFixed(1)}%
                  </div>
                  <div className="flex items-center gap-2">
                    {composition.is_feasible ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-green-700">Viável</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span className="text-xs text-red-700">Não viável</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <div className="text-xs font-medium text-green-600 mb-2">Economia Estimada</div>
                  <div className="text-3xl font-bold text-green-700 mb-2">
                    R${' '}
                    {composition.estimated_savings_brl / 100 > 0
                      ? (composition.estimated_savings_brl / 100).toLocaleString('pt-BR', {
                          maximumFractionDigits: 0,
                        })
                      : '0'}
                  </div>
                  {composition.estimated_savings_brl > 0 && (
                    <div className="text-xs text-green-600">
                      ~
                      {(
                        (composition.estimated_savings_brl / 100 / (metrics.originalCost || 1)) *
                        100
                      ).toFixed(1)}
                      % de redução
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                <h4 className="font-medium text-sm">Detalhes da Consolidação</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Cargas Consolidadas:</span>
                    <p className="font-semibold text-gray-900">{composition.quote_ids.length}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Desvio de Rota:</span>
                    <p className="font-semibold text-gray-900">
                      +{composition.distance_increase_percent.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Criado em:</span>
                    <p className="font-semibold text-gray-900">
                      {new Date(composition.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Paradas na Rota:</span>
                    <p className="font-semibold text-gray-900">
                      {composition.routings?.length || 0}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Route */}
            <TabsContent value="route" className="space-y-4">
              {composition.routings && composition.routings.length > 0 ? (
                <>
                  <RouteMapVisualization routings={composition.routings} />

                  <div className="space-y-2 border-t pt-4">
                    <h4 className="font-medium text-sm">Sequência de Paradas</h4>
                    <div className="space-y-2">
                      {composition.routings
                        .sort((a, b) => a.route_sequence - b.route_sequence)
                        .map((leg, idx) => (
                          <div
                            key={leg.id}
                            className="flex items-center gap-3 p-2 bg-gray-50 rounded"
                          >
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {leg.leg_distance_km?.toFixed(1)}km • {leg.leg_duration_min}min
                              </p>
                              {leg.pickup_window_start && (
                                <p className="text-xs text-gray-600">
                                  Janela: {leg.pickup_window_start} - {leg.pickup_window_end}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-gray-50 p-8 rounded-lg text-center text-sm text-gray-600">
                  Rota não disponível
                </div>
              )}
            </TabsContent>

            {/* Tab 3: Financial */}
            <TabsContent value="financial" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-xs font-medium text-gray-600 mb-1">Custo Original</div>
                  <div className="text-2xl font-bold text-gray-900">
                    R$ {metrics.originalCost.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="text-xs font-medium text-blue-600 mb-1">Custo Consolidado</div>
                  <div className="text-2xl font-bold text-blue-700">
                    R$ {metrics.composedCost.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-100 col-span-2">
                  <div className="text-xs font-medium text-green-600 mb-1">Economia</div>
                  <div className="text-2xl font-bold text-green-700">
                    R$ {metrics.savings.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} (
                    {metrics.savingsPercent.toFixed(1)}%)
                  </div>
                </div>
              </div>

              {/* Kilometers */}
              <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-sm text-purple-900">Eficiência de Quilometragem</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-purple-700">Original:</span>
                    <p className="font-semibold">{metrics.originalKm.toFixed(1)}km</p>
                  </div>
                  <div>
                    <span className="text-purple-700">Consolidado:</span>
                    <p className="font-semibold">{metrics.composedKm.toFixed(1)}km</p>
                  </div>
                  {metrics.co2Reduction > 0 && (
                    <div className="col-span-2">
                      <span className="text-purple-700">Redução de CO₂:</span>
                      <p className="font-semibold">{metrics.co2Reduction.toFixed(2)}kg</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab 4: Discounts */}
            <TabsContent value="discounts" className="space-y-4">
              {composition.discounts && composition.discounts.length > 0 ? (
                <DiscountProposalBreakdown
                  discounts={composition.discounts}
                  minimumMarginPercent={
                    composition.discounts[0]?.minimum_margin_percent_applied || 30
                  }
                />
              ) : (
                <div className="bg-gray-50 p-8 rounded-lg text-center text-sm text-gray-600">
                  Descontos ainda não calculados. Clique em "Calcular Descontos" para gerar
                  proposta.
                </div>
              )}
            </TabsContent>

            {/* Tab 5: Warnings */}
            <TabsContent value="warnings" className="space-y-4">
              {composition.validation_warnings.length > 0 ? (
                <div className="space-y-2">
                  {composition.validation_warnings.map((warning, idx) => (
                    <div
                      key={idx}
                      className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-3"
                    >
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-800">{warning}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Nenhum aviso</p>
                    <p className="text-xs text-green-700 mt-1">
                      Consolidação atende todos os critérios
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {isExecutable && (
            <Button onClick={onApprove} className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Aprovar Consolidação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
