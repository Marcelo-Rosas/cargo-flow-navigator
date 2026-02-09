import { useState, useEffect } from 'react';
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
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { QuoteForm } from '@/components/forms/QuoteForm';
import { ConvertQuoteModal } from '@/components/modals/ConvertQuoteModal';
import { AdditionalFeesSection, AdditionalFeesSelection, defaultAdditionalFeesSelection } from '@/components/quotes/AdditionalFeesSection';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { usePriceTable } from '@/hooks/usePriceTables';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatRouteUf, StoredPricingBreakdown } from '@/lib/freightCalculator';
import { toast } from 'sonner';

type Quote = Database['public']['Tables']['quotes']['Row'];
type QuoteStage = Database['public']['Enums']['quote_stage'];

interface QuoteDetailModalProps {
  open: boolean;
  onClose: () => void;
  quote: Quote | null;
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

export function QuoteDetailModal({ open, onClose, quote }: QuoteDetailModalProps) {
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isAdditionalFeesOpen, setIsAdditionalFeesOpen] = useState(false);
  const queryClient = useQueryClient();

  // Initialize additional fees selection from breakdown
  const getInitialFeesSelection = (): AdditionalFeesSelection => {
    if (!quote) return defaultAdditionalFeesSelection;
    
    const breakdown = quote.pricing_breakdown as unknown as StoredPricingBreakdown | null;
    if (!breakdown?.meta) return defaultAdditionalFeesSelection;
    
    return {
      conditionalFees: breakdown.meta.selectedConditionalFeeIds || [],
      waitingTimeEnabled: breakdown.meta.waitingTimeEnabled || false,
      waitingTimeHours: breakdown.meta.waitingTimeHours || 0,
      waitingTimeCost: breakdown.components?.waitingTimeCost || 0,
    };
  };
  
  const [additionalFeesSelection, setAdditionalFeesSelection] = useState<AdditionalFeesSelection>(getInitialFeesSelection);

  // Update selection when quote changes
  useEffect(() => {
    setAdditionalFeesSelection(getInitialFeesSelection());
  }, [quote?.id, quote?.pricing_breakdown]);

  // All hooks MUST be called before any conditional returns
  const { data: priceTable } = usePriceTable(quote?.price_table_id || '');
  
  const { data: vehicleType } = useQuery({
    queryKey: ['vehicle-type', quote?.vehicle_type_id],
    queryFn: async () => {
      if (!quote?.vehicle_type_id) return null;
      const { data } = await supabase
        .from('vehicle_types')
        .select('name, code')
        .eq('id', quote.vehicle_type_id)
        .maybeSingle();
      return data;
    },
    enabled: !!quote?.vehicle_type_id,
  });

  const { data: paymentTerm } = useQuery({
    queryKey: ['payment-term', quote?.payment_term_id],
    queryFn: async () => {
      if (!quote?.payment_term_id) return null;
      const { data } = await supabase
        .from('payment_terms')
        .select('name, code, adjustment_percent')
        .eq('id', quote.payment_term_id)
        .maybeSingle();
      return data;
    },
    enabled: !!quote?.payment_term_id,
  });

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
      };
      
      const defaultWeights = { cubageWeight: 0, billableWeight: 0, tonBillable: 0 };
      const defaultTotals = { receitaBruta: 0, das: 0, icms: 0, totalImpostos: 0, totalCliente: 0 };
      const defaultProfitability = { custosDiretos: 0, margemBruta: 0, overhead: 0, resultadoLiquido: 0, margemPercent: 0 };
      const defaultRates = { dasPercent: 14, markupPercent: 30, icmsPercent: 0, grisPercent: 0, tsoPercent: 0, costValuePercent: 0, overheadPercent: 15 };
      
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
        .update({
          pricing_breakdown: updatedBreakdown as unknown as typeof quote.pricing_breakdown,
          waiting_time_cost: selection.waitingTimeCost,
        })
        .eq('id', quote.id);
      
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
  const routeUfLabel = breakdown?.meta?.routeUfLabel || formatRouteUf(quote.origin, quote.destination);
  const kmBandLabel = breakdown?.meta?.kmBandLabel;
  const kmStatus = breakdown?.meta?.kmStatus || 'OK';
  const marginPercent = breakdown?.meta?.marginPercent ?? breakdown?.profitability?.margemPercent;
  const marginStatus = breakdown?.meta?.marginStatus || 'UNKNOWN';
  const isBelowTarget = marginStatus === 'BELOW_TARGET' || (marginPercent !== undefined && marginPercent < TARGET_MARGIN_PERCENT);

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

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3">
                <span className="text-xl font-bold">Cotação</span>
                <Badge className={cn(stageInfo.color)}>
                  {stageInfo.label}
                </Badge>
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
                {canConvert && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsConvertModalOpen(true)}
                    className="gap-2"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Converter para OS
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setIsEditFormOpen(true)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Margin Alert */}
            {isBelowTarget && marginPercent !== undefined && (
              <Alert variant="destructive" className="bg-warning/10 border-warning text-warning-foreground">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Margem de {marginPercent.toFixed(1)}% está abaixo da meta de {TARGET_MARGIN_PERCENT}%
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
                  <p className="text-xs text-muted-foreground mt-1">CEP: {quote.origin_cep.replace(/(\d{5})(\d{3})/, '$1-$2')}</p>
                )}
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">Destino</span>
                </div>
                <p className="font-medium text-foreground">{quote.destination}</p>
                {quote.destination_cep && (
                  <p className="text-xs text-muted-foreground mt-1">CEP: {quote.destination_cep.replace(/(\d{5})(\d{3})/, '$1-$2')}</p>
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
                      <p className="font-medium text-foreground text-sm">{Number(quote.weight).toLocaleString('pt-BR')} kg</p>
                    </div>
                  )}
                  {quote.volume && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Box className="w-4 h-4" />
                        <span className="text-xs">Volume</span>
                      </div>
                      <p className="font-medium text-foreground text-sm">{Number(quote.volume).toLocaleString('pt-BR')} m³</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pricing Details */}
            {(priceTable || vehicleType || paymentTerm || quote.km_distance || quote.freight_modality) && (
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
                      <p className="font-medium text-foreground text-sm">{vehicleType.name} ({vehicleType.code})</p>
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
                            ({paymentTerm.adjustment_percent > 0 ? '+' : ''}{paymentTerm.adjustment_percent}%)
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
                      <p className="font-medium text-foreground text-sm">{Number(quote.km_distance).toLocaleString('pt-BR')} km</p>
                    </div>
                  )}
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
                          <span className="text-muted-foreground">RCTR-C ({breakdown.rates?.costValuePercent?.toFixed(2)}%)</span>
                          <span>{formatCurrency(breakdown.components.rctrc)}</span>
                        </div>
                      )}
                      {breakdown.components.gris > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">GRIS ({breakdown.rates?.grisPercent?.toFixed(2)}%)</span>
                          <span>{formatCurrency(breakdown.components.gris)}</span>
                        </div>
                      )}
                      {breakdown.components.tso > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">TSO ({breakdown.rates?.tsoPercent?.toFixed(2)}%)</span>
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
                  
                  {/* Totals */}
                  <div className="flex justify-between font-medium">
                    <span>Receita Bruta</span>
                    <span>{formatCurrency(breakdown.totals.receitaBruta || 0)}</span>
                  </div>
                  
                  <div className="flex justify-between text-muted-foreground">
                    <span>DAS ({breakdown.rates?.dasPercent?.toFixed(2)}%)</span>
                    <span>{formatCurrency(breakdown.totals.das || 0)}</span>
                  </div>
                  
                  <div className="flex justify-between text-muted-foreground">
                    <span>ICMS ({breakdown.rates?.icmsPercent?.toFixed(2)}%)</span>
                    <span>{formatCurrency(breakdown.totals.icms || 0)}</span>
                  </div>
                  
                  <Separator className="my-2" />
                  
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total Cliente</span>
                    <span className="text-primary">{formatCurrency(breakdown.totals.totalCliente || 0)}</span>
                  </div>
                </div>
                
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
                        <span>{formatCurrency(breakdown.profitability.margemBruta || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Overhead</span>
                        <span>{formatCurrency(breakdown.profitability.overhead || 0)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Resultado Líquido</span>
                        <span className={cn(
                          breakdown.profitability.resultadoLiquido >= 0 ? 'text-success' : 'text-destructive'
                        )}>
                          {formatCurrency(breakdown.profitability.resultadoLiquido || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Margem %</span>
                        <span className={cn(
                          isBelowTarget ? 'text-warning-foreground' : 'text-success'
                        )}>
                          {(breakdown.profitability.margemPercent || 0).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Additional Fees Section */}
            <Collapsible open={isAdditionalFeesOpen} onOpenChange={setIsAdditionalFeesOpen}>
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between p-0 h-auto hover:bg-transparent"
                  >
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Plus className={cn("w-4 h-4 transition-transform", isAdditionalFeesOpen && "rotate-45")} />
                      Taxas Adicionais
                      {(additionalFeesSelection.conditionalFees.length > 0 || additionalFeesSelection.waitingTimeEnabled) && (
                        <Badge variant="secondary" className="ml-2">
                          {additionalFeesSelection.conditionalFees.length + (additionalFeesSelection.waitingTimeEnabled ? 1 : 0)}
                        </Badge>
                      )}
                    </h4>
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="pt-4">
                  <AdditionalFeesSection
                    selection={additionalFeesSelection}
                    onChange={setAdditionalFeesSelection}
                    baseFreight={breakdown?.components?.baseFreight || 0}
                    cargoValue={quote.cargo_value || 0}
                    vehicleTypeId={quote.vehicle_type_id || undefined}
                  />
                  
                  <div className="flex justify-end mt-4">
                    <Button 
                      size="sm"
                      onClick={handleSaveAdditionalFees}
                      disabled={saveAdditionalFeesMutation.isPending}
                    >
                      {saveAdditionalFeesMutation.isPending ? 'Salvando...' : 'Salvar Taxas'}
                    </Button>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

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
                        tag === 'urgente' && "bg-destructive/10 text-destructive",
                        tag === 'contrato' && "bg-primary/10 text-primary",
                        tag === 'refrigerado' && "bg-accent text-accent-foreground"
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Form */}
      <QuoteForm
        open={isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        quote={quote}
      />

      {/* Convert Modal */}
      <ConvertQuoteModal
        open={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        quote={quote}
      />
    </>
  );
}
