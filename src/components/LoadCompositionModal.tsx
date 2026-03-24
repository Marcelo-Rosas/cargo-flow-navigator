/**
 * Component: LoadCompositionModal
 * 4-tab detailed view of composition suggestion:
 * 1. Overview - score, savings, consolidation metrics
 * 2. Route - map visualization with polylines and legs
 * 3. Financial - cost breakdown and savings analysis
 * 4. Warnings - validation warnings and constraints
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLoadCompositionSuggestion } from '@/hooks/useLoadCompositionSuggestions';
import { useGenerateOptimalRoute } from '@/hooks/useGenerateOptimalRoute';
import { formatCurrencyFromCents, formatCurrency, formatDate } from '@/lib/formatters';
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
import {
  AlertCircle,
  MapPin,
  DollarSign,
  CheckCircle,
  Loader,
  FileDown,
  Package,
  Truck,
  Globe,
  Calculator,
  Calendar,
  Ruler,
} from 'lucide-react';
import { toast } from 'sonner';
import { RouteMapVisualization, type RouteMapVisualizationProps } from './RouteMapVisualization';
import { DiscountProposalBreakdown } from './DiscountProposalBreakdown';
import { generateLoadCompositionProposalPdf } from '@/lib/generateLoadCompositionProposalPdf';

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
  const {
    data: composition,
    isLoading,
    error,
    refetch: refetchComposition,
  } = useLoadCompositionSuggestion(compositionId);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [routeData, setRouteData] = useState<{
    legs?: {
      from_label: string;
      to_label: string;
      distance_km: number;
      duration_min: number;
      quote_id: string | null;
      sequence_number: number;
      toll_centavos: number;
    }[];
    polyline_coords?: [number, number][];
    total_distance_km?: number;
    total_duration_min?: number;
    total_toll_centavos?: number;
    route_source?: string;
  } | null>(null);
  const generateRoute = useGenerateOptimalRoute();

  // Fetch quote details + shipper name for the Detalhes tab
  const quoteIds = composition?.quote_ids ?? [];
  const shipperId = composition?.shipper_id;

  interface QuoteDetail {
    id: string;
    quote_code: string | null;
    client_name: string;
    origin: string;
    destination: string;
    value: number;
    weight: number | null;
    estimated_loading_date: string | null;
    km_distance: number | null;
  }

  const { data: quotesDetail } = useQuery({
    queryKey: ['composition-quotes-detail', quoteIds],
    queryFn: async (): Promise<QuoteDetail[]> => {
      if (quoteIds.length === 0) return [];
      const { data } = await supabase
        .from('quotes')
        .select(
          'id, quote_code, client_name, origin, destination, value, weight, estimated_loading_date, km_distance'
        )
        .in('id', quoteIds);
      return (data ?? []) as unknown as QuoteDetail[];
    },
    enabled: quoteIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const { data: shipperData } = useQuery({
    queryKey: ['shipper-name', shipperId],
    queryFn: async () => {
      if (!shipperId) return null;
      const { data } = await supabase
        .from('shippers')
        .select('id, name')
        .eq('id', shipperId)
        .single();
      return data;
    },
    enabled: !!shipperId,
    staleTime: 10 * 60 * 1000,
  });

  // When details open and there are no routings, trigger route generation (once per composition)
  const hasTriggeredRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (
      !compositionId ||
      !composition ||
      generateRoute.isPending ||
      (composition.routings && composition.routings.length > 0) ||
      composition.quote_ids.length < 2 ||
      hasTriggeredRef.current === compositionId
    ) {
      return;
    }
    hasTriggeredRef.current = compositionId;
    generateRoute.mutate(
      {
        quote_ids: composition.quote_ids,
        composition_id: compositionId,
        save_to_db: true,
      },
      {
        onSuccess: (data) => {
          if (data?.route) {
            setRouteData(data.route);
          }
          refetchComposition();
        },
      }
    );
  }, [compositionId, composition, generateRoute, refetchComposition]);

  const status = composition ? statusConfig[composition.status] : null;
  const isExecutable = composition?.status === 'pending' && composition?.is_feasible;

  // Calculate totals: prefer metrics table if populated, otherwise derive from suggestion v2 columns
  const metrics = useMemo(() => {
    if (!composition) {
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

    // If metrics table is populated, use it
    if (composition.metrics?.original_total_cost) {
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
    }

    // Fallback: derive from suggestion v2 columns
    const savingsBrl = (composition.estimated_savings_brl ?? 0) / 100;
    const baseKm = Number(composition.base_km_total) || 0;
    const composedKm = Number(composition.composed_km_total) || 0;
    const kmEfficiency = baseKm > 0 ? ((baseKm - composedKm) / baseKm) * 100 : 0;

    return {
      originalCost: 0, // not available without metrics table
      composedCost: 0,
      savings: savingsBrl,
      savingsPercent: kmEfficiency,
      originalKm: baseKm,
      composedKm: composedKm,
      efficiency: kmEfficiency,
      co2Reduction: 0,
    };
  }, [composition]);

  const quoteCodeById = useMemo<Record<string, string | null>>(() => {
    const entries =
      quotesDetail?.map((quote) => [quote.id, quote.quote_code] as const).filter(([id]) => !!id) ??
      [];
    return Object.fromEntries(entries);
  }, [quotesDetail]);

  const resolveSuggestionSequence = async (createdAt: string): Promise<number | undefined> => {
    const createdDate = new Date(createdAt);
    const monthStart = new Date(createdDate.getFullYear(), createdDate.getMonth(), 1);

    const { count, error } = (await supabase
      .from('load_composition_suggestions' as never)
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', createdDate.toISOString())) as {
      count: number | null;
      error: { message: string } | null;
    };

    if (error || !count) {
      return undefined;
    }

    return count;
  };

  if (isLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="sr-only">Carregando detalhes da composição</DialogTitle>
            <DialogDescription className="sr-only">Aguarde</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/3" />
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
            <DialogDescription>Não foi possível carregar os dados da composição.</DialogDescription>
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
              <DialogDescription className="mt-1 flex items-center gap-1.5 flex-wrap">
                {shipperData?.name && <span className="font-medium">{shipperData.name} • </span>}
                <span>Score: {composition.consolidation_score.toFixed(0)}%</span>
                {composition.route_evaluation_model &&
                  composition.route_evaluation_model !== 'mock_v1' &&
                  composition.route_evaluation_model !== 'insufficient_data' && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] gap-0.5 ${
                        composition.route_evaluation_model === 'webrouter_v1'
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}
                    >
                      {composition.route_evaluation_model === 'webrouter_v1' ? (
                        <>
                          <Globe className="w-3 h-3" /> Rota real
                        </>
                      ) : (
                        <>
                          <Calculator className="w-3 h-3" /> Estimativa
                        </>
                      )}
                    </Badge>
                  )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-6 mb-4">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="overview">Resumo</TabsTrigger>
              <TabsTrigger value="route">Rota</TabsTrigger>
              <TabsTrigger value="financial">Financeiro</TabsTrigger>
              <TabsTrigger value="discounts">Descontos</TabsTrigger>
              <TabsTrigger value="warnings">Validação</TabsTrigger>
            </TabsList>

            {/* Tab 0: Details — shipper, quotes, key info */}
            <TabsContent value="details" className="space-y-4">
              {/* Shipper */}
              {shipperData && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="text-xs text-blue-600">Embarcador</div>
                    <div className="text-sm font-semibold text-blue-800">{shipperData.name}</div>
                  </div>
                </div>
              )}

              {/* Technical explanation */}
              {composition.technical_explanation && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {composition.technical_explanation}
                  </p>
                </div>
              )}

              {/* Quote list */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  Cotações ({quoteIds.length})
                </h4>
                <div className="border rounded-lg divide-y">
                  {quotesDetail && quotesDetail.length > 0 ? (
                    quotesDetail.map((q) => (
                      <div key={q.id} className="p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">
                              {q.quote_code || q.id.slice(0, 8)}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {q.client_name}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {q.origin?.split(',')[0]} → {q.destination?.split(',')[0]}
                          </div>
                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                            {q.km_distance && (
                              <span>{Number(q.km_distance).toLocaleString('pt-BR')}km</span>
                            )}
                            {q.weight && <span>{Number(q.weight).toLocaleString('pt-BR')}kg</span>}
                            {q.estimated_loading_date ? (
                              <span>{formatDate(q.estimated_loading_date)}</span>
                            ) : (
                              <span className="text-amber-600">Sem data de coleta</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold">
                            {formatCurrency(Number(q.value))}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      Carregando cotações...
                    </div>
                  )}
                </div>
              </div>

              {/* Data quality checklist */}
              {quotesDetail &&
                quotesDetail.length > 0 &&
                (() => {
                  const withKm = quotesDetail.filter(
                    (q) => q.km_distance && Number(q.km_distance) > 0
                  ).length;
                  const withDate = quotesDetail.filter((q) => q.estimated_loading_date).length;
                  const total = quotesDetail.length;
                  const allKm = withKm === total;
                  const allDates = withDate === total;
                  // Only show checklist if something is missing
                  if (allKm && allDates) return null;
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <h4 className="text-xs font-medium text-blue-900 mb-2 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Qualidade dos Dados
                      </h4>
                      <div className="space-y-1.5 text-xs">
                        <div
                          className={`flex items-center gap-2 ${allDates ? 'text-green-700' : 'text-red-700'}`}
                        >
                          {allDates ? (
                            <CheckCircle className="w-3.5 h-3.5" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5" />
                          )}
                          <Calendar className="w-3 h-3" />
                          <span>
                            Data de carregamento: {withDate}/{total} cotações
                          </span>
                        </div>
                        <div
                          className={`flex items-center gap-2 ${allKm ? 'text-green-700' : 'text-amber-700'}`}
                        >
                          {allKm ? (
                            <CheckCircle className="w-3.5 h-3.5" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5" />
                          )}
                          <Ruler className="w-3 h-3" />
                          <span>
                            Distância (km): {withKm}/{total} cotações
                          </span>
                        </div>
                      </div>
                      {(!allKm || !allDates) && (
                        <p className="text-[10px] text-blue-600 mt-2">
                          Preencha os dados faltantes para melhorar a precisão da consolidação.
                        </p>
                      )}
                    </div>
                  );
                })()}

              {/* Trigger + model info */}
              <div className="flex gap-2 text-xs text-muted-foreground">
                {composition.trigger_source && (
                  <Badge variant="outline" className="text-[10px]">
                    {composition.trigger_source === 'batch'
                      ? 'Batch'
                      : composition.trigger_source === 'on_save'
                        ? 'Auto'
                        : 'Manual'}
                  </Badge>
                )}
                {composition.route_evaluation_model &&
                  composition.route_evaluation_model !== 'mock_v1' &&
                  composition.route_evaluation_model !== 'insufficient_data' && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] gap-0.5 ${
                        composition.route_evaluation_model === 'webrouter_v1'
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}
                    >
                      {composition.route_evaluation_model === 'webrouter_v1' ? (
                        <>
                          <Globe className="w-3 h-3" /> Rota real (WebRouter)
                        </>
                      ) : (
                        <>
                          <Calculator className="w-3 h-3" /> Estimativa (km armazenado)
                        </>
                      )}
                    </Badge>
                  )}
                <span>
                  Criado em {new Date(composition.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </TabsContent>

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
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : '0'}
                  </div>
                  {metrics.efficiency > 0 && (
                    <div className="text-xs text-green-600">
                      ~{metrics.efficiency.toFixed(1)}% de redução em km
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
                    <span className="text-gray-600">Delta de Rota:</span>
                    <p className="font-semibold text-gray-900">
                      {composition.delta_km_percent != null
                        ? `${Number(composition.delta_km_percent) > 0 ? '+' : ''}${Number(composition.delta_km_percent).toFixed(1)}%`
                        : `${composition.distance_increase_percent > 0 ? '+' : ''}${composition.distance_increase_percent.toFixed(1)}%`}
                      {composition.delta_km_abs != null && (
                        <span className="text-xs font-normal text-gray-500 ml-1">
                          ({Number(composition.delta_km_abs) > 0 ? '+' : ''}
                          {Number(composition.delta_km_abs).toFixed(0)}km)
                        </span>
                      )}
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
              {generateRoute.isPending ? (
                <div className="bg-gray-50 p-8 rounded-lg text-center">
                  <Loader className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
                  <p className="text-sm text-gray-600">Gerando rota otimizada...</p>
                </div>
              ) : routeData || (composition.routings && composition.routings.length > 0) ? (
                <RouteMapVisualization
                  polylineCoords={routeData?.polyline_coords}
                  encodedPolyline={routeData?.encoded_polyline ?? composition.encoded_polyline}
                  legs={routeData?.legs as RouteMapVisualizationProps['legs']}
                  totalDistanceKm={routeData?.total_distance_km}
                  totalDurationMin={routeData?.total_duration_min}
                  totalTollCentavos={
                    routeData?.total_toll_centavos ?? composition.total_toll_centavos
                  }
                  routeSource={routeData?.route_source}
                  routings={composition.routings}
                />
              ) : (
                <div className="bg-gray-50 p-8 rounded-lg text-center">
                  <p className="text-sm text-gray-600 mb-3">
                    Rota não disponível. Clique para gerar.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={generateRoute.isPending || composition.quote_ids.length < 2}
                    onClick={() =>
                      generateRoute.mutate(
                        {
                          quote_ids: composition.quote_ids,
                          composition_id: compositionId,
                          save_to_db: true,
                        },
                        {
                          onSuccess: (data) => {
                            if (data?.route) setRouteData(data.route);
                            refetchComposition();
                          },
                        }
                      )
                    }
                  >
                    {generateRoute.isPending ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin mr-2" />
                        Gerando...
                      </>
                    ) : (
                      'Gerar rota'
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Tab 3: Financial */}
            <TabsContent value="financial" className="space-y-4">
              {metrics.originalCost > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="text-xs font-medium text-gray-600 mb-1">Custo Original</div>
                    <div className="text-2xl font-bold text-gray-900">
                      R${' '}
                      {metrics.originalCost.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="text-xs font-medium text-blue-600 mb-1">Custo Consolidado</div>
                    <div className="text-2xl font-bold text-blue-700">
                      R${' '}
                      {metrics.composedCost.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                <div className="text-xs font-medium text-green-600 mb-1">Economia Estimada</div>
                <div className="text-2xl font-bold text-green-700">
                  R${' '}
                  {metrics.savings.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  {metrics.efficiency > 0 && (
                    <span className="text-base font-normal ml-2">
                      ({metrics.efficiency.toFixed(1)}% de km)
                    </span>
                  )}
                </div>
              </div>

              {/* Kilometers */}
              {(metrics.originalKm > 0 || metrics.composedKm > 0) && (
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-sm text-purple-900">
                    Eficiência de Quilometragem
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-purple-700">Soma individual:</span>
                      <p className="font-semibold">{metrics.originalKm.toFixed(1)}km</p>
                    </div>
                    <div>
                      <span className="text-purple-700">Rota consolidada:</span>
                      <p className="font-semibold">{metrics.composedKm.toFixed(1)}km</p>
                    </div>
                  </div>
                </div>
              )}

              {metrics.originalCost === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                  Custos detalhados não disponíveis. A economia é estimada com base na redução de
                  custo ANTT (Tabela A, Carga Geral, Resolução 6.076/2026) — separado vs
                  consolidado.
                </div>
              )}
            </TabsContent>

            {/* Tab 4: Discounts */}
            <TabsContent value="discounts" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Descontos propostos</h3>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    !composition.discounts || composition.discounts.length === 0 || isExportingPdf
                  }
                  onClick={async () => {
                    if (!composition.discounts || composition.discounts.length === 0) return;
                    try {
                      setIsExportingPdf(true);
                      const suggestionSequence = await resolveSuggestionSequence(
                        composition.created_at
                      );
                      await generateLoadCompositionProposalPdf({
                        suggestion: composition,
                        quoteCodeById,
                        suggestionSequence,
                      });
                      toast.success('PDF gerado com sucesso');
                    } catch (error) {
                      const description =
                        error instanceof Error ? error.message : 'Tente novamente em instantes.';
                      toast.error('Falha ao gerar PDF da proposta', { description });
                    } finally {
                      setIsExportingPdf(false);
                    }
                  }}
                  className="gap-2"
                >
                  {isExportingPdf ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Gerando PDF...
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" />
                      Exportar proposta em PDF
                    </>
                  )}
                </Button>
              </div>

              {composition.discounts && composition.discounts.length > 0 ? (
                <DiscountProposalBreakdown
                  discounts={composition.discounts}
                  minimumMarginPercent={
                    composition.discounts[0]?.minimum_margin_percent_applied || 30
                  }
                />
              ) : (
                <div className="bg-gray-50 p-8 rounded-lg text-center text-sm text-gray-600">
                  Descontos ainda não calculados. Clique em \"Calcular Descontos\" para gerar
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
