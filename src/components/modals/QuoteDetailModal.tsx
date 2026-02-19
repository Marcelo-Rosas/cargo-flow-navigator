import { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Calendar,
  DollarSign,
  Pencil,
  Building2,
  Mail,
  Package,
  Scale,
  Box,
  ArrowRightLeft,
  Truck,
  CreditCard,
  Route,
  AlertTriangle,
  TrendingUp,
  Receipt,
  Plus,
  FileText,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { QuoteForm } from '@/components/forms/QuoteForm';
import { ConvertQuoteModal } from '@/components/modals/ConvertQuoteModal';
import {
  AdditionalFeesSection,
  AdditionalFeesSelection,
  defaultAdditionalFeesSelection,
} from '@/components/quotes/AdditionalFeesSection';
import type { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { usePriceTable } from '@/hooks/usePriceTables';
import { usePricingParameter } from '@/hooks/usePricingRules';
import { useUpdateQuote } from '@/hooks/useQuotes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAnttFloorRate, calculateAnttMinimum } from '@/hooks/useAnttFloorRate';
import { supabase } from '@/integrations/supabase/client';
import { asDb, asInsert, filterSupabaseSingle } from '@/lib/supabase-utils';
import { formatRouteUf, StoredPricingBreakdown } from '@/lib/freightCalculator';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { DocumentList } from '@/components/documents/DocumentList';

type Quote = Database['public']['Tables']['quotes']['Row'];
type QuoteStage = Database['public']['Enums']['quote_stage'];

interface QuoteDetailModalProps {
  open: boolean;
  onClose: () => void;
  quote: Quote | null;
  canManage?: boolean;
}

const STAGE_LABELS: Record<QuoteStage, { label: string; color: string }> = {
  novo_pedido: { label: 'Novo Pedido', color: 'bg-muted text-muted-foreground' },
  qualificacao: { label: 'Qualificação', color: 'bg-accent text-accent-foreground' },
  precificacao: { label: 'Precificação', color: 'bg-primary/10 text-primary' },
  enviado: { label: 'Enviado', color: 'bg-warning/10 text-warning-foreground' },
  negociacao: { label: 'Negociação', color: 'bg-warning/10 text-warning-foreground' },
  ganho: { label: 'Ganho', color: 'bg-success/10 text-success' },
  perdido: { label: 'Perdido', color: 'bg-destructive/10 text-destructive' },
};

const TARGET_MARGIN_PERCENT = 15;

export function QuoteDetailModal({
  open,
  onClose,
  quote,
  canManage = true,
}: QuoteDetailModalProps) {
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isAdditionalFeesOpen, setIsAdditionalFeesOpen] = useState(false);
  const [isConvertingToFat, setIsConvertingToFat] = useState(false);
  const [selectedAdvancePercent, setSelectedAdvancePercent] = useState<string>('0');
  const queryClient = useQueryClient();
  const updateQuoteMutation = useUpdateQuote();

  // Initialize additional fees selection from breakdown
  const getInitialFeesSelection = useCallback((): AdditionalFeesSelection => {
    if (!quote) return defaultAdditionalFeesSelection;

    const breakdown = quote.pricing_breakdown as unknown as StoredPricingBreakdown | null;
    if (!breakdown?.meta) return defaultAdditionalFeesSelection;

    return {
      conditionalFees: breakdown.meta.selectedConditionalFeeIds || [],
      waitingTimeEnabled: breakdown.meta.waitingTimeEnabled || false,
      waitingTimeHours: breakdown.meta.waitingTimeHours || 0,
      waitingTimeCost: breakdown.components?.waitingTimeCost || 0,
    };
  }, [quote]);

  const [additionalFeesSelection, setAdditionalFeesSelection] =
    useState<AdditionalFeesSelection>(getInitialFeesSelection);

  // Update selection when quote changes
  useEffect(() => {
    setAdditionalFeesSelection(getInitialFeesSelection());
  }, [getInitialFeesSelection]);

  // All hooks MUST be called before any conditional returns
  const { data: priceTable } = usePriceTable(quote?.price_table_id || '');
  const { data: taxRegimeParam } = usePricingParameter('tax_regime_simples');
  const isSimplesNacional =
    taxRegimeParam?.value != null ? Number(taxRegimeParam.value) === 1 : true;

  const { data: vehicleType } = useQuery({
    queryKey: ['vehicle-type', quote?.vehicle_type_id],
    queryFn: async () => {
      if (!quote?.vehicle_type_id) return null;
      const { data } = await supabase
        .from('vehicle_types')
        .select('name, code, axes_count')
        .eq('id', asDb(quote.vehicle_type_id))
        .maybeSingle();
      return filterSupabaseSingle<{ name: string; code: string; axes_count: number }>(data);
    },
    enabled: !!quote?.vehicle_type_id,
  });

  const axesCount = (vehicleType as { axes_count?: number } | null)?.axes_count ?? null;
  const kmDistance = quote?.km_distance ?? null;
  const { data: anttRate } = useAnttFloorRate({
    operationTable: 'A',
    cargoType: 'carga_geral',
    axesCount,
  });
  const anttCalc =
    anttRate && kmDistance
      ? calculateAnttMinimum({
          kmDistance: Number(kmDistance),
          ccd: Number(anttRate.ccd),
          cc: Number(anttRate.cc),
        })
      : null;

  const { data: paymentTerm } = useQuery({
    queryKey: ['payment-term', quote?.payment_term_id],
    queryFn: async () => {
      if (!quote?.payment_term_id) return null;
      const { data } = await supabase
        .from('payment_terms')
        .select('name, code, adjustment_percent, advance_percent, days')
        .eq('id', asDb(quote.payment_term_id))
        .maybeSingle();
      return filterSupabaseSingle<{
        name: string;
        code: string;
        adjustment_percent: number;
        advance_percent?: number | null;
        days?: number | null;
      }>(data);
    },
    enabled: !!quote?.payment_term_id,
  });

  // Sync advance percent when paymentTerm loads (after paymentTerm declaration)
  useEffect(() => {
    if (!paymentTerm) return;
    const p = paymentTerm.advance_percent;
    setSelectedAdvancePercent(p === 70 ? '70' : p === 50 ? '50' : '0');
  }, [paymentTerm]);

  // Mutation to save additional fees selection
  const saveAdditionalFeesMutation = useMutation({
    mutationFn: async (selection: AdditionalFeesSelection) => {
      if (!quote) throw new Error('No quote');

      const currentBreakdown = quote.pricing_breakdown as unknown as StoredPricingBreakdown | null;

      // Build defaults for missing fields
      const defaultMeta = {
        routeUfLabel: '',
        kmBandLabel: '',
        kmStatus: 'OK' as const,
        marginStatus: 'UNKNOWN' as const,
        marginPercent: 0,
      };

      const defaultComponents = {
        baseCost: 0,
        baseFreight: 0,
        toll: 0,
        gris: 0,
        tso: 0,
        rctrc: 0,
        adValorem: 0,
        tde: 0,
        tear: 0,
        conditionalFeesTotal: 0,
        waitingTimeCost: 0,
        dasProvision: 0,
      };

      const defaultWeights = { cubageWeight: 0, billableWeight: 0, tonBillable: 0 };
      const defaultTotals = { receitaBruta: 0, das: 0, icms: 0, totalImpostos: 0, totalCliente: 0 };
      const defaultProfitability = {
        custosCarreteiro: 0,
        custosDescarga: 0,
        custosDiretos: 0,
        margemBruta: 0,
        overhead: 0,
        resultadoLiquido: 0,
        margemPercent: 0,
      };
      const defaultRates = {
        dasPercent: 14,
        markupPercent: 30,
        icmsPercent: 0,
        grisPercent: 0,
        tsoPercent: 0,
        costValuePercent: 0,
        overheadPercent: 15,
        targetMarginPercent: 15,
      };

      // Update breakdown with new selections
      const updatedBreakdown: StoredPricingBreakdown = {
        calculatedAt: currentBreakdown?.calculatedAt || new Date().toISOString(),
        version: currentBreakdown?.version || '2.1-fob-lotacao',
        status: currentBreakdown?.status || 'OK',
        meta: {
          ...defaultMeta,
          ...currentBreakdown?.meta,
          selectedConditionalFeeIds: selection.conditionalFees,
          waitingTimeEnabled: selection.waitingTimeEnabled,
          waitingTimeHours: selection.waitingTimeHours,
        },
        components: {
          ...defaultComponents,
          ...currentBreakdown?.components,
          waitingTimeCost: selection.waitingTimeCost,
        },
        weights: currentBreakdown?.weights || defaultWeights,
        totals: currentBreakdown?.totals || defaultTotals,
        profitability: currentBreakdown?.profitability || defaultProfitability,
        rates: currentBreakdown?.rates || defaultRates,
      };

      const { error } = await supabase
        .from('quotes')
        .update(
          asInsert({
            pricing_breakdown: updatedBreakdown as unknown as typeof quote.pricing_breakdown,
            waiting_time_cost: selection.waitingTimeCost,
          })
        )
        .eq('id', asDb(quote.id));

      if (error) throw error;
      return updatedBreakdown;
    },
    onSuccess: () => {
      toast.success('Taxas adicionais salvas');
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (error) => {
      console.error('Error saving additional fees:', error);
      toast.error('Erro ao salvar taxas adicionais');
    },
  });

  const handleSaveAdditionalFees = () => {
    saveAdditionalFeesMutation.mutate(additionalFeesSelection);
  };

  // Early return AFTER all hooks
  if (!quote) return null;

  const stageInfo = STAGE_LABELS[quote.stage];

  // REGRA: Converter para OS só quando stage === 'ganho'
  const canConvert = quote.stage === 'ganho';

  // Parse pricing breakdown - using new StoredPricingBreakdown type
  const breakdown = quote.pricing_breakdown as unknown as StoredPricingBreakdown | null;
  const routeUfLabel =
    breakdown?.meta?.routeUfLabel || formatRouteUf(quote.origin, quote.destination);
  const kmBandLabel = breakdown?.meta?.kmBandLabel;
  const kmStatus = breakdown?.meta?.kmStatus || 'OK';

  // Cálculo original de margem (meta) ainda usado para alertas gerais
  const originalMarginPercent =
    breakdown?.meta?.marginPercent ?? breakdown?.profitability?.margemPercent;
  const marginStatus = breakdown?.meta?.marginStatus || 'UNKNOWN';
  const isBelowTargetMeta =
    marginStatus === 'BELOW_TARGET' ||
    (originalMarginPercent !== undefined && originalMarginPercent < TARGET_MARGIN_PERCENT);

  // Visão contábil desejada:
  // Margem Bruta = Total Cliente - Piso ANTT - Carga/Descarga - Provisionamento DAS
  // Resultado Líquido = Margem Bruta - Overhead
  // Margem % = Resultado Líquido / Total Cliente
  const totalClienteView =
    breakdown?.totals != null
      ? isSimplesNacional
        ? (breakdown.totals.receitaBruta || 0) + (breakdown.totals.das || 0)
        : breakdown.totals.totalCliente || 0
      : 0;

  const pisoAnttView = Number(breakdown?.meta?.antt?.total ?? anttCalc?.total ?? 0);
  const cargaDescargaView = breakdown?.profitability?.custosDescarga ?? 0;
  const provisaoDasView = breakdown?.totals?.das ?? 0;
  const margemBrutaView = totalClienteView - pisoAnttView - cargaDescargaView - provisaoDasView;

  const overheadView = breakdown?.profitability?.overhead ?? 0;
  const resultadoLiquidoView = margemBrutaView - overheadView;
  const margemPercentView =
    totalClienteView > 0 ? (resultadoLiquidoView / totalClienteView) * 100 : 0;
  const isBelowTargetView = margemPercentView < TARGET_MARGIN_PERCENT;

  // Mantém compatibilidade com o alerta de margem existente
  const marginPercent = originalMarginPercent;
  const isBelowTarget = isBelowTargetMeta;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date));
  };

  const formatDateTime = (date: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const handleAdvancePercentChange = async (value: string) => {
    if (!quote) return;
    const prev = selectedAdvancePercent;
    setSelectedAdvancePercent(value);
    try {
      const targetPercent = Number(value); // 0, 50, ou 70
      const { data: term, error } = await supabase
        .from('payment_terms')
        .select('id')
        .eq('advance_percent', targetPercent)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!term) {
        toast.error('Condição de pagamento não encontrada');
        setSelectedAdvancePercent(prev);
        return;
      }
      await updateQuoteMutation.mutateAsync({ id: quote.id, updates: { payment_term_id: term.id } });
      toast.success('Adiantamento atualizado');
    } catch {
      toast.error('Erro ao salvar adiantamento');
      setSelectedAdvancePercent(prev);
    }
  };

  const handleConvertToFAT = async () => {
    if (!quote) return;
    setIsConvertingToFat(true);
    try {
      const { data, error } = await supabase.functions.invoke('ensure-financial-document', {
        body: {
          docType: 'FAT',
          sourceId: quote.id,
          totalAmount: totalClienteView || Number(quote.value) || null,
        },
      });
      if (error) {
        const res = error as { context?: Response };
        let errMsg = error.message;
        if (res?.context?.json) {
          const body = await res.context.json().catch(() => null);
          if (body?.error) errMsg = body.error;
        }
        throw new Error(errMsg);
      }
      const res = data as { data?: { id?: string; created?: boolean }; error?: string } | null;
      if (res?.error) throw new Error(res.error);
      toast.success(res?.data?.created ? 'FAT criado com sucesso' : 'FAT já existente');
      queryClient.invalidateQueries({ queryKey: ['financial-documents'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao converter para FAT';
      toast.error(msg);
    } finally {
      setIsConvertingToFat(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3">
                <span className="text-xl font-bold">Cotação</span>
                <Badge className={cn(stageInfo.color)}>{stageInfo.label}</Badge>
                {routeUfLabel && (
                  <Badge variant="outline" className="text-xs">
                    <Route className="w-3 h-3 mr-1" />
                    {routeUfLabel}
                  </Badge>
                )}
                {kmBandLabel && (
                  <Badge variant="outline" className="text-xs">
                    {kmBandLabel} km
                  </Badge>
                )}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {canManage && canConvert && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsConvertModalOpen(true)}
                      className="gap-2"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      Converter para OS
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleConvertToFAT}
                      disabled={isConvertingToFat}
                      className="gap-2"
                    >
                      {isConvertingToFat ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Receipt className="w-4 h-4" />
                      )}
                      Converter para FAT
                    </Button>
                  </>
                )}
                {canManage && (
                  <Button variant="ghost" size="icon" onClick={() => setIsEditFormOpen(true)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Mini cards: Adiantamento e Saldo (70/30 ou 50/50) */}
          {paymentTerm &&
            (paymentTerm.advance_percent === 50 || paymentTerm.advance_percent === 70) && (
              <div className="grid grid-cols-2 gap-3 -mt-2">
                <div className="p-3 rounded-lg border bg-primary/5 border-primary/20">
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Adiantamento {paymentTerm.advance_percent}%
                  </p>
                  <p className="font-semibold text-foreground">
                    {formatCurrency((totalClienteView * (paymentTerm.advance_percent ?? 0)) / 100)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {quote.advance_due_date ? formatDate(quote.advance_due_date) : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30 border-border">
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Saldo {100 - (paymentTerm.advance_percent ?? 0)}%
                  </p>
                  <p className="font-semibold text-foreground">
                    {formatCurrency(
                      (totalClienteView * (100 - (paymentTerm.advance_percent ?? 0))) / 100
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {quote.balance_due_date ? formatDate(quote.balance_due_date) : '—'}
                  </p>
                </div>
              </div>
            )}

          <Tabs defaultValue="resumo" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="documentos" className="gap-2">
                <FileText className="w-4 h-4" />
                Documento em Edição
              </TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="space-y-6 mt-4 m-0">
              {/* Margin Alert */}
              {isBelowTarget && marginPercent !== undefined && (
                <Alert
                  variant="destructive"
                  className="bg-warning/10 border-warning text-warning-foreground"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Margem de {marginPercent.toFixed(1)}% está abaixo da meta de{' '}
                    {TARGET_MARGIN_PERCENT}%
                  </AlertDescription>
                </Alert>
              )}

              {/* OUT_OF_RANGE Alert */}
              {kmStatus === 'OUT_OF_RANGE' && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Distância fora da faixa de quilometragem da tabela de preços selecionada
                  </AlertDescription>
                </Alert>
              )}

              {/* Client Info */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-lg">{quote.client_name}</p>
                    {quote.client_email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {quote.client_email}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Shipper Info */}
              {(quote.shipper_name || quote.freight_type) && (
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h4 className="font-semibold text-foreground mb-3">Embarcador</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      {quote.shipper_name && (
                        <p className="font-medium text-foreground">{quote.shipper_name}</p>
                      )}
                      {quote.shipper_email && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Mail className="w-3.5 h-3.5" />
                          {quote.shipper_email}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {quote.freight_type && (
                        <Badge variant="outline" className="text-sm">
                          {quote.freight_type}
                        </Badge>
                      )}
                      {quote.freight_modality && (
                        <Badge variant="outline" className="text-sm">
                          {quote.freight_modality === 'lotacao' ? 'Lotação' : 'Fracionado'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Route */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">Origem</span>
                  </div>
                  <p className="font-medium text-foreground">{quote.origin}</p>
                  {quote.origin_cep && (
                    <p className="text-xs text-muted-foreground mt-1">
                      CEP: {quote.origin_cep.replace(/(\d{5})(\d{3})/, '$1-$2')}
                    </p>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">Destino</span>
                  </div>
                  <p className="font-medium text-foreground">{quote.destination}</p>
                  {quote.destination_cep && (
                    <p className="text-xs text-muted-foreground mt-1">
                      CEP: {quote.destination_cep.replace(/(\d{5})(\d{3})/, '$1-$2')}
                    </p>
                  )}
                </div>
              </div>

              {/* Cargo Info */}
              {(quote.cargo_type || quote.weight || quote.volume) && (
                <div>
                  <h4 className="font-semibold text-foreground mb-3">Dados da Carga</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {quote.cargo_type && (
                      <div className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Package className="w-4 h-4" />
                          <span className="text-xs">Tipo</span>
                        </div>
                        <p className="font-medium text-foreground text-sm">{quote.cargo_type}</p>
                      </div>
                    )}
                    {quote.weight && (
                      <div className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Scale className="w-4 h-4" />
                          <span className="text-xs">Peso</span>
                        </div>
                        <p className="font-medium text-foreground text-sm">
                          {Number(quote.weight) >= 1000
                            ? `${(Number(quote.weight) / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} t`
                            : `${Number(quote.weight).toLocaleString('pt-BR')} kg`}
                        </p>
                      </div>
                    )}
                    {quote.volume && (
                      <div className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Box className="w-4 h-4" />
                          <span className="text-xs">Volume</span>
                        </div>
                        <p className="font-medium text-foreground text-sm">
                          {Number(quote.volume).toLocaleString('pt-BR')} m³
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pricing Details */}
              {(priceTable ||
                vehicleType ||
                paymentTerm ||
                quote.km_distance ||
                quote.freight_modality ||
                anttCalc) && (
                <div>
                  <h4 className="font-semibold text-foreground mb-3">Detalhes de Precificação</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {priceTable && (
                      <div className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <DollarSign className="w-4 h-4" />
                          <span className="text-xs">Tabela de Preços</span>
                        </div>
                        <p className="font-medium text-foreground text-sm">{priceTable.name}</p>
                      </div>
                    )}
                    {vehicleType && (
                      <div className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Truck className="w-4 h-4" />
                          <span className="text-xs">Veículo</span>
                        </div>
                        <p className="font-medium text-foreground text-sm">
                          {vehicleType.name} ({vehicleType.code})
                        </p>
                      </div>
                    )}
                    {paymentTerm && (
                      <div className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <CreditCard className="w-4 h-4" />
                          <span className="text-xs">Prazo Pagamento</span>
                        </div>
                        <p className="font-medium text-foreground text-sm">
                          {paymentTerm.name}
                          {paymentTerm.adjustment_percent !== 0 && (
                            <span className="text-muted-foreground ml-1">
                              ({paymentTerm.adjustment_percent > 0 ? '+' : ''}
                              {paymentTerm.adjustment_percent}%)
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                    {quote.km_distance && (
                      <div className="p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Route className="w-4 h-4" />
                          <span className="text-xs">Distância</span>
                        </div>
                        <p className="font-medium text-foreground text-sm">
                          {Number(quote.km_distance).toLocaleString('pt-BR')} km
                        </p>
                      </div>
                    )}

                    {/* Piso mínimo ANTT (carreteiro) - Tabela A / Carga Geral */}
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <DollarSign className="w-4 h-4" />
                          <span className="text-xs">Piso ANTT (carreteiro)</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          Tabela A • Carga Geral
                        </Badge>
                      </div>

                      {anttCalc ? (
                        <>
                          <p className="font-semibold text-foreground mt-1">
                            {formatCurrency(anttCalc.total)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {axesCount || '-'} eixos •{' '}
                            {Number(kmDistance || 0).toLocaleString('pt-BR')} km
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Memória: ({Number(kmDistance || 0).toLocaleString('pt-BR')} ×{' '}
                            {Number(anttRate?.ccd || 0).toFixed(4)}) +{' '}
                            {Number(anttRate?.cc || 0).toFixed(2)}
                          </p>
                          {canManage && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={async () => {
                                const current =
                                  quote.pricing_breakdown as unknown as StoredPricingBreakdown | null;
                                const updated: StoredPricingBreakdown = {
                                  calculatedAt: current?.calculatedAt || new Date().toISOString(),
                                  version: current?.version || '4.0-fob-lotacao-markup-scope',
                                  status: current?.status || 'OK',
                                  error: current?.error,
                                  meta: {
                                    ...(current?.meta || {
                                      routeUfLabel: formatRouteUf(quote.origin, quote.destination),
                                      kmBandLabel: null,
                                      kmStatus: 'OK',
                                      marginStatus: 'AT_TARGET',
                                      marginPercent: 0,
                                    }),
                                    antt: {
                                      operationTable: 'A',
                                      cargoType: 'carga_geral',
                                      axesCount: Number(axesCount),
                                      kmDistance: Number(kmDistance),
                                      ccd: Number(anttRate?.ccd || 0),
                                      cc: Number(anttRate?.cc || 0),
                                      ida: Number(anttCalc.ida),
                                      retornoVazio: 0,
                                      total: Number(anttCalc.total),
                                      calculatedAt: new Date().toISOString(),
                                    },
                                  },
                                  // mantém o resto se existir; senão cria estrutura mínima
                                  weights: current?.weights || {
                                    cubageWeight: 0,
                                    billableWeight: 0,
                                    tonBillable: 0,
                                  },
                                  components: current?.components || {
                                    baseCost: 0,
                                    baseFreight: 0,
                                    toll: 0,
                                    gris: 0,
                                    tso: 0,
                                    rctrc: 0,
                                    adValorem: 0,
                                    tde: 0,
                                    tear: 0,
                                    conditionalFeesTotal: 0,
                                    waitingTimeCost: 0,
                                    dasProvision: 0,
                                  },
                                  totals: current?.totals || {
                                    receitaBruta: 0,
                                    das: 0,
                                    icms: 0,
                                    totalImpostos: 0,
                                    totalCliente: 0,
                                  },
                                  profitability: current?.profitability || {
                                    custosCarreteiro: 0,
                                    custosDescarga: 0,
                                    custosDiretos: 0,
                                    margemBruta: 0,
                                    overhead: 0,
                                    resultadoLiquido: 0,
                                    margemPercent: 0,
                                  },
                                  rates: current?.rates || {
                                    dasPercent: 14,
                                    icmsPercent: 0,
                                    grisPercent: 0,
                                    tsoPercent: 0,
                                    costValuePercent: 0,
                                    markupPercent: 30,
                                    overheadPercent: 15,
                                    targetMarginPercent: 15,
                                  },
                                  conditionalFeesBreakdown: current?.conditionalFeesBreakdown,
                                };

                                const { error } = await supabase
                                  .from('quotes')
                                  .update(
                                    asInsert({
                                      pricing_breakdown:
                                        updated as unknown as typeof quote.pricing_breakdown,
                                    })
                                  )
                                  .eq('id', asDb(quote.id));

                                if (error) {
                                  toast.error('Erro ao salvar piso ANTT');
                                  return;
                                }
                                toast.success('Piso ANTT salvo na memória de cálculo');
                                queryClient.invalidateQueries({ queryKey: ['quotes'] });
                              }}
                            >
                              Salvar no breakdown
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-muted-foreground mt-1">—</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Cadastre CCD/CC em ANTT Floor Rates e selecione veículo + KM.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Pricing Breakdown */}
              {breakdown && breakdown.totals && (
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Breakdown do Cálculo
                  </h4>

                  {/* Components */}
                  <div className="space-y-2 text-sm">
                    {breakdown.components && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frete Base</span>
                          <span>{formatCurrency(breakdown.components.baseFreight || 0)}</span>
                        </div>
                        {breakdown.components.toll > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pedágio</span>
                            <span>{formatCurrency(breakdown.components.toll)}</span>
                          </div>
                        )}
                        {breakdown.components.rctrc > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              RCTR-C ({breakdown.rates?.costValuePercent?.toFixed(2)}%)
                            </span>
                            <span>{formatCurrency(breakdown.components.rctrc)}</span>
                          </div>
                        )}
                        {breakdown.components.gris > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              GRIS ({breakdown.rates?.grisPercent?.toFixed(2)}%)
                            </span>
                            <span>{formatCurrency(breakdown.components.gris)}</span>
                          </div>
                        )}
                        {breakdown.components.tso > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              TSO ({breakdown.rates?.tsoPercent?.toFixed(2)}%)
                            </span>
                            <span>{formatCurrency(breakdown.components.tso)}</span>
                          </div>
                        )}
                        {breakdown.components.tde > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">TDE (NTC)</span>
                            <span>{formatCurrency(breakdown.components.tde)}</span>
                          </div>
                        )}
                        {breakdown.components.tear > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">TEAR (NTC)</span>
                            <span>{formatCurrency(breakdown.components.tear)}</span>
                          </div>
                        )}
                      </>
                    )}

                    <Separator className="my-2" />

                    <div className="flex justify-between font-medium">
                      <span>Receita Bruta</span>
                      <span>{formatCurrency(breakdown.totals.receitaBruta || 0)}</span>
                    </div>
                  </div>

                  {/* Custos Diretos (ANTT + Carga e Descarga) — deduzidos para chegar na Margem Bruta */}
                  {breakdown && (
                    <>
                      <Separator className="my-4" />
                      <h5 className="font-medium text-foreground mb-2">Custos Diretos</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Piso ANTT (carreteiro)</span>
                          <span>
                            {formatCurrency(
                              Number(breakdown?.meta?.antt?.total ?? anttCalc?.total ?? 0)
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Carga e Descarga</span>
                          <span>
                            {formatCurrency(breakdown?.profitability?.custosDescarga ?? 0)}
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Impostos — deduzidos para visão correta da Margem Bruta, Resultado Líquido e Margem */}
                  {breakdown?.totals && (
                    <>
                      <Separator className="my-4" />
                      <h5 className="font-medium text-foreground mb-2">Impostos</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                          <span>
                            Provisionamento DAS ({breakdown.rates?.dasPercent?.toFixed(2)}%)
                          </span>
                          <span>{formatCurrency(breakdown.totals.das || 0)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>
                            ICMS (
                            {isSimplesNacional
                              ? '0.00'
                              : (breakdown.rates?.icmsPercent?.toFixed(2) ?? '0.00')}
                            %)
                          </span>
                          <span>
                            {formatCurrency(isSimplesNacional ? 0 : breakdown.totals.icms || 0)}
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Total Cliente (continua somando impostos; apenas mudamos de lugar no quadro) */}
                  {breakdown?.totals && (
                    <>
                      <Separator className="my-4" />
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total Cliente</span>
                        <span className="text-primary">
                          {formatCurrency(
                            isSimplesNacional && breakdown?.totals
                              ? (breakdown.totals.receitaBruta || 0) + (breakdown.totals.das || 0)
                              : breakdown.totals?.totalCliente || 0
                          )}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Profitability */}
                  {breakdown.profitability && (
                    <>
                      <Separator className="my-4" />
                      <h5 className="font-medium text-foreground mb-2 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Rentabilidade
                      </h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Margem Bruta</span>
                          <span>{formatCurrency(margemBrutaView)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Overhead</span>
                          <span>{formatCurrency(overheadView)}</span>
                        </div>
                        <div className="flex justify-between font-medium items-center gap-2">
                          <span>Resultado Líquido</span>
                          <Badge
                            variant={resultadoLiquidoView >= 0 ? 'default' : 'destructive'}
                            className={
                              resultadoLiquidoView >= 0 ? 'bg-success text-success-foreground' : ''
                            }
                          >
                            {formatCurrency(resultadoLiquidoView)}
                          </Badge>
                        </div>
                        <div className="flex justify-between font-semibold items-center gap-2">
                          <span>Margem %</span>
                          <Badge
                            variant={isBelowTargetView ? 'destructive' : 'default'}
                            className={
                              !isBelowTargetView ? 'bg-success text-success-foreground' : ''
                            }
                          >
                            {margemPercentView.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Value (fallback if no breakdown) */}
              {!breakdown && (
                <div className="p-6 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary">
                      <DollarSign className="w-5 h-5" />
                      <span className="font-medium">Valor Total</span>
                    </div>
                    <p className="text-3xl font-bold text-primary">
                      {formatCurrency(Number(quote.value))}
                    </p>
                  </div>
                </div>
              )}

              {/* Validity */}
              {quote.validity_date && (
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Validade da Cotação</span>
                  </div>
                  <p className="font-medium text-foreground">{formatDate(quote.validity_date)}</p>
                </div>
              )}

              {/* Tags */}
              {quote.tags && quote.tags.length > 0 && (
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {quote.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className={cn(
                          tag === 'urgente' && 'bg-destructive/10 text-destructive',
                          tag === 'contrato' && 'bg-primary/10 text-primary',
                          tag === 'refrigerado' && 'bg-accent text-accent-foreground'
                        )}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {quote.notes && (
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Observações</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
                </div>
              )}

              {/* Timestamps */}
              <Separator />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Criado em: {formatDateTime(quote.created_at)}</span>
                <span>Atualizado em: {formatDateTime(quote.updated_at)}</span>
              </div>
            </TabsContent>

            <TabsContent value="documentos" className="space-y-6 mt-4 m-0">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Adiantamento
                  </label>
                  <Select
                    value={selectedAdvancePercent}
                    onValueChange={handleAdvancePercentChange}
                    disabled={!canManage || updateQuoteMutation.isPending}
                  >
                    <SelectTrigger className="w-full max-w-[200px]">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">À vista</SelectItem>
                      <SelectItem value="50">50% Adiantamento / 50% Saldo</SelectItem>
                      <SelectItem value="70">70% Adiantamento / 30% Saldo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {canManage && (
                  <DocumentUpload
                    quoteId={quote.id}
                    onSuccess={() => queryClient.invalidateQueries({ queryKey: ['documents'] })}
                  />
                )}
                <DocumentList quoteId={quote.id} />
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit Form */}
      <QuoteForm
        open={canManage && isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        quote={quote}
      />

      {/* Convert Modal */}
      <ConvertQuoteModal
        open={canManage && isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        quote={quote}
      />
    </>
  );
}
