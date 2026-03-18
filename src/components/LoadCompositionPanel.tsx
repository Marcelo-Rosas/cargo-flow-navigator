/**
 * Component: LoadCompositionPanel
 * Panel that displays list of load composition suggestions
 * Fetches suggestions for current shipper and manages approval flow
 */

import React, { useState } from 'react';
import { useLoadCompositionSuggestions } from '@/hooks/useLoadCompositionSuggestions';
import { useApproveComposition } from '@/hooks/useApproveComposition';
import { useCalculateDiscounts } from '@/hooks/useCalculateDiscounts';
import { LoadCompositionCard } from './LoadCompositionCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { LoadCompositionModal } from './LoadCompositionModal';

export interface LoadCompositionPanelProps {
  shipperId: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export function LoadCompositionPanel({ shipperId, dateRange }: LoadCompositionPanelProps) {
  const [selectedCompositionId, setSelectedCompositionId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'executed'>(
    'pending'
  );

  // Fetch suggestions
  const {
    data: suggestions,
    isLoading,
    error,
    refetch,
  } = useLoadCompositionSuggestions({
    shipper_id: shipperId,
    status: filterStatus === 'all' ? undefined : filterStatus,
    date_from: dateRange?.from,
    date_to: dateRange?.to,
    include_details: true,
  });

  // Approve mutation
  const { mutate: approve, isPending: isApproving } = useApproveComposition();

  // Calculate discounts mutation
  const { mutate: calculateDiscounts, isPending: isCalculatingDiscounts } = useCalculateDiscounts();

  // Handle approval
  const handleApprove = (compositionId: string) => {
    approve({ composition_id: compositionId });
  };

  // Handle calculate discounts
  const handleCalculateDiscounts = (compositionId: string) => {
    calculateDiscounts({
      composition_id: compositionId,
      discount_strategy: 'proportional_to_original',
      minimum_margin_percent: 30,
      simulate_only: false,
    });
  };

  // Handle view details
  const handleViewDetails = (compositionId: string) => {
    setSelectedCompositionId(compositionId);
    setShowModal(true);
  };

  // Filter suggestions for display
  const filteredSuggestions =
    suggestions?.filter((s) => {
      if (filterStatus === 'all') return true;
      return s.status === filterStatus;
    }) || [];

  // Calculate summary stats
  const totalSavings = filteredSuggestions.reduce(
    (sum, s) => sum + s.estimated_savings_brl / 100,
    0
  );
  const totalSuggestions = filteredSuggestions.length;
  const feasibleCount = filteredSuggestions.filter((s) => s.is_feasible).length;

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Oportunidades de Consolidação</CardTitle>
              <CardDescription>
                Análise automática de cargas do mesmo embarcador para otimização de rotas
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
              <div className="text-xs font-medium text-blue-600 mb-1">Sugestões</div>
              <div className="text-2xl font-bold text-blue-700">{totalSuggestions}</div>
            </div>

            <div className="bg-green-50 p-3 rounded-lg border border-green-100">
              <div className="text-xs font-medium text-green-600 mb-1">Economia Total</div>
              <div className="text-2xl font-bold text-green-700">
                R$ {totalSavings.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </div>
            </div>

            <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
              <div className="text-xs font-medium text-purple-600 mb-1">Viáveis</div>
              <div className="text-2xl font-bold text-purple-700">
                {feasibleCount}/{totalSuggestions}
              </div>
            </div>
          </div>

          {/* Tabs for filtering */}
          <Tabs
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="approved">Aprovadas</TabsTrigger>
              <TabsTrigger value="executed">Executadas</TabsTrigger>
            </TabsList>

            <TabsContent value={filterStatus} className="space-y-3 mt-4">
              {/* Loading State */}
              {isLoading && (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ))}
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">Erro ao carregar sugestões</p>
                    <p className="text-xs text-red-700 mt-1">
                      {error instanceof Error ? error.message : 'Tente novamente'}
                    </p>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!isLoading && !error && filteredSuggestions.length === 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                  <p className="text-sm text-gray-600 mb-3">
                    {filterStatus === 'all'
                      ? 'Nenhuma sugestão de consolidação encontrada'
                      : `Nenhuma sugestão ${filterStatus === 'pending' ? 'pendente' : filterStatus} encontrada`}
                  </p>
                  {filterStatus === 'pending' && (
                    <p className="text-xs text-gray-500">
                      Adicione mais cargas para gerar oportunidades de consolidação
                    </p>
                  )}
                </div>
              )}

              {/* Suggestions List */}
              {!isLoading &&
                !error &&
                filteredSuggestions.map((suggestion) => (
                  <LoadCompositionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onApprove={handleApprove}
                    onView={handleViewDetails}
                    onCalculateDiscounts={handleCalculateDiscounts}
                    isApproving={isApproving}
                    isCalculatingDiscounts={isCalculatingDiscounts}
                  />
                ))}
            </TabsContent>
          </Tabs>

          {/* Info Footer */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            <p>
              💡 As sugestões são geradas automaticamente analisando cargas pendentes dos últimos 14
              dias. Viabilidade leva em conta peso, datas de pickup e desvio de rota.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {showModal && selectedCompositionId && (
        <LoadCompositionModal
          compositionId={selectedCompositionId}
          onClose={() => {
            setShowModal(false);
            setSelectedCompositionId(null);
          }}
          onApprove={() => {
            handleApprove(selectedCompositionId);
            setShowModal(false);
          }}
        />
      )}
    </>
  );
}
