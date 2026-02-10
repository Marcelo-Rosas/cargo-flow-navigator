import { useState } from 'react';
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
  Route,
  AlertTriangle,
  Truck,
  CreditCard,
  Receipt,
  TrendingUp,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QuoteForm } from '@/components/forms/QuoteForm';
import { ConvertQuoteModal } from '@/components/modals/ConvertQuoteModal';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { usePriceTable } from '@/hooks/usePriceTables';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type Quote = Database['public']['Tables']['quotes']['Row'];
type QuoteStage = Database['public']['Enums']['quote_stage'];

/** Quote with optional display-only fields (shipper, CEPs) for modal */
type QuoteDisplay = Quote & {
  shipper_name?: string | null;
  shipper_email?: string | null;
  freight_type?: string | null;
  origin_cep?: string | null;
  destination_cep?: string | null;
};

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

/** Minimal shape for pricing_breakdown JSON */
interface PricingBreakdownLike {
  status?: string;
  meta?: {
    marginPercent?: number;
    marginStatus?: string;
    routeUfLabel?: string;
    kmBandLabel?: string;
    kmStatus?: string;
  };
  totals?: { receitaBruta?: number; das?: number; icms?: number; totalCliente?: number };
  components?: {
    baseFreight?: number;
    toll?: number;
    gris?: number;
    tso?: number;
    rctrc?: number;
    tde?: number;
    tear?: number;
  };
  profitability?: {
    margemBruta?: number;
    overhead?: number;
    resultadoLiquido?: number;
    margemPercent?: number;
  };
  rates?: {
    dasPercent?: number;
    icmsPercent?: number;
    grisPercent?: number;
    tsoPercent?: number;
    costValuePercent?: number;
  };
}

export function QuoteDetailModal({ open, onClose, quote }: QuoteDetailModalProps) {
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

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

  if (!quote) return null;

  const isEarlyStage =
    quote.stage === 'novo_pedido' || quote.stage === 'qualificacao';

  const isPricingOrLater =
    quote.stage === 'precificacao' ||
    quote.stage === 'enviado' ||
    quote.stage === 'negociacao' ||
    quote.stage === 'ganho' ||
    quote.stage === 'perdido';

  const stageInfo = STAGE_LABELS[quote.stage];
  const canConvert = quote.stage === 'ganho';

  const breakdown = quote.pricing_breakdown as unknown as PricingBreakdownLike | null;
  const routeUfLabel = breakdown?.meta?.routeUfLabel;
  const kmBandLabel = breakdown?.meta?.kmBandLabel;
  const kmStatus = breakdown?.meta?.kmStatus || 'OK';
  const marginPercent =
    breakdown?.meta?.marginPercent ?? breakdown?.profitability?.margemPercent;
  const marginStatus = breakdown?.meta?.marginStatus || 'UNKNOWN';
  const isBelowTarget =
    marginStatus === 'BELOW_TARGET' ||
    (marginPercent !== undefined && marginPercent < TARGET_MARGIN_PERCENT);

  const shouldShowMarginAlert =
    isPricingOrLater &&
    breakdown?.status === 'OK' &&
    marginPercent !== undefined &&
    (breakdown?.totals?.receitaBruta ?? 0) > 0 &&
    isBelowTarget;

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

  const q = quote as QuoteDisplay;

  const ClientSection = () => (
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
  );

  const ShipperSection = () =>
    q.shipper_name || q.freight_type ? (
      <div className="p-4 rounded-lg bg-muted/30 border border-border">
        <h4 className="font-semibold text-foreground mb-3">Embarcador</h4>
        <div className="flex items-center justify-between">
          <div>
            {q.shipper_name && (
              <p className="font-medium text-foreground">{q.shipper_name}</p>
            )}
            {q.shipper_email && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Mail className="w-3.5 h-3.5" />
                {q.shipper_email}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {q.freight_type && (
              <Badge variant="outline" className="text-sm">
                {q.freight_type}
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
    ) : null;

  const RouteSection = () => (
    <div className="grid grid-cols-2 gap-4">
      <div className="p-4 rounded-lg bg-muted/30 border border-border">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <MapPin className="w-4 h-4" />
          <span className="text-sm">Origem</span>
        </div>
        <p className="font-medium text-foreground">{quote.origin}</p>
        {q.origin_cep && (
          <p className="text-xs text-muted-foreground mt-1">
            CEP: {q.origin_cep.replace(/(\d{5})(\d{3})/, '$1-$2')}
          </p>
        )}
      </div>
      <div className="p-4 rounded-lg bg-muted/30 border border-border">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <MapPin className="w-4 h-4" />
          <span className="text-sm">Destino</span>
        </div>
        <p className="font-medium text-foreground">{quote.destination}</p>
        {q.destination_cep && (
          <p className="text-xs text-muted-foreground mt-1">
            CEP: {q.destination_cep.replace(/(\d{5})(\d{3})/, '$1-$2')}
          </p>
        )}
      </div>
    </div>
  );

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
            {shouldShowMarginAlert && (
              <Alert
                variant="destructive"
                className="bg-warning/10 border-warning text-warning-foreground"
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Margem de {marginPercent!.toFixed(1)}% está abaixo da meta de{' '}
                  {TARGET_MARGIN_PERCENT}%
                </AlertDescription>
              </Alert>
            )}

            {kmStatus === 'OUT_OF_RANGE' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Distância fora da faixa de quilometragem da tabela de preços selecionada
                </AlertDescription>
              </Alert>
            )}

            {isEarlyStage ? (
              <Tabs defaultValue="cliente" className="mt-4">
                <TabsList>
                  <TabsTrigger value="cliente">Cliente</TabsTrigger>
                  <TabsTrigger value="embarcador">Embarcador</TabsTrigger>
                  <TabsTrigger value="rota">Rota</TabsTrigger>
                </TabsList>
                <TabsContent value="cliente" className="mt-4">
                  <ClientSection />
                </TabsContent>
                <TabsContent value="embarcador" className="mt-4">
                  <ShipperSection />
                </TabsContent>
                <TabsContent value="rota" className="mt-4">
                  <RouteSection />
                </TabsContent>
              </Tabs>
            ) : (
              <Tabs defaultValue="qualificacao" className="mt-4">
                <TabsList>
                  <TabsTrigger value="qualificacao">Qualificação</TabsTrigger>
                  <TabsTrigger value="precificacao">Precificação</TabsTrigger>
                  <TabsTrigger value="operacional">Operacional</TabsTrigger>
                  <TabsTrigger value="rentabilidade">Rentabilidade</TabsTrigger>
                </TabsList>

                <TabsContent value="qualificacao" className="mt-4 space-y-4">
                  <ClientSection />
                  <ShipperSection />
                  <RouteSection />
                </TabsContent>

                <TabsContent value="precificacao" className="mt-4 space-y-4">
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
                            <p className="font-medium text-foreground text-sm">
                              {quote.cargo_type}
                            </p>
                          </div>
                        )}
                        {quote.weight && (
                          <div className="p-3 rounded-lg bg-muted/30 border border-border">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                              <Scale className="w-4 h-4" />
                              <span className="text-xs">Peso</span>
                            </div>
                            <p className="font-medium text-foreground text-sm">
                              {Number(quote.weight).toLocaleString('pt-BR')} kg
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

                  {(priceTable || vehicleType || paymentTerm || quote.km_distance) && (
                    <div>
                      <h4 className="font-semibold text-foreground mb-3">
                        Detalhes de Precificação
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {priceTable && (
                          <div className="p-3 rounded-lg bg-muted/30 border border-border">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                              <DollarSign className="w-4 h-4" />
                              <span className="text-xs">Tabela de Preços</span>
                            </div>
                            <p className="font-medium text-foreground text-sm">
                              {priceTable.name}
                            </p>
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
                                  (
                                  {paymentTerm.adjustment_percent! > 0 ? '+' : ''}
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
                      </div>
                    </div>
                  )}

                  {breakdown?.totals && (
                    <div className="p-4 rounded-lg bg-muted/30 border border-border">
                      <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Receipt className="w-4 h-4" />
                        Breakdown do Cálculo
                      </h4>
                      <div className="space-y-2 text-sm">
                        {breakdown.components && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Frete Base</span>
                              <span>
                                {formatCurrency(breakdown.components.baseFreight ?? 0)}
                              </span>
                            </div>
                            {(breakdown.components.toll ?? 0) > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Pedágio</span>
                                <span>{formatCurrency(breakdown.components.toll!)}</span>
                              </div>
                            )}
                            {(breakdown.components.gris ?? 0) > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">GRIS</span>
                                <span>{formatCurrency(breakdown.components.gris!)}</span>
                              </div>
                            )}
                            {(breakdown.components.tso ?? 0) > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">TSO</span>
                                <span>{formatCurrency(breakdown.components.tso!)}</span>
                              </div>
                            )}
                          </>
                        )}
                        <Separator className="my-2" />
                        <div className="flex justify-between font-medium">
                          <span>Receita Bruta</span>
                          <span>
                            {formatCurrency(breakdown.totals.receitaBruta ?? 0)}
                          </span>
                        </div>
                        {(breakdown.totals.das ?? 0) > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>DAS</span>
                            <span>{formatCurrency(breakdown.totals.das!)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold text-lg">
                          <span>Total Cliente</span>
                          <span className="text-primary">
                            {formatCurrency(breakdown.totals.totalCliente ?? 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="operacional" className="mt-4 space-y-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <h4 className="font-semibold text-foreground mb-3">Operacional</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {quote.km_distance != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Distância (km)</span>
                          <span>{Number(quote.km_distance).toLocaleString('pt-BR')}</span>
                        </div>
                      )}
                      {quote.toll_value != null && Number(quote.toll_value) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Pedágio</span>
                          <span>{formatCurrency(Number(quote.toll_value))}</span>
                        </div>
                      )}
                      {breakdown?.components?.toll != null &&
                        breakdown.components.toll > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pedágio (breakdown)</span>
                            <span>{formatCurrency(breakdown.components.toll)}</span>
                          </div>
                        )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="rentabilidade" className="mt-4">
                  {breakdown?.profitability ? (
                    <div className="p-4 rounded-lg bg-muted/30 border border-border">
                      <h5 className="font-medium text-foreground mb-2 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Rentabilidade
                      </h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Margem Bruta</span>
                          <span>
                            {formatCurrency(breakdown.profitability.margemBruta ?? 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Overhead</span>
                          <span>
                            {formatCurrency(breakdown.profitability.overhead ?? 0)}
                          </span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>Resultado Líquido</span>
                          <span
                            className={cn(
                              (breakdown.profitability.resultadoLiquido ?? 0) >= 0
                                ? 'text-success'
                                : 'text-destructive'
                            )}
                          >
                            {formatCurrency(
                              breakdown.profitability.resultadoLiquido ?? 0
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Margem %</span>
                          <span
                            className={cn(
                              isBelowTarget ? 'text-warning-foreground' : 'text-success'
                            )}
                          >
                            {(breakdown.profitability.margemPercent ?? 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-muted/30 border border-border text-muted-foreground text-sm">
                      Nenhum dado de rentabilidade disponível.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}

            {!breakdown?.totals && (
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

            {quote.validity_date && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Validade da Cotação</span>
                </div>
                <p className="font-medium text-foreground">{formatDate(quote.validity_date)}</p>
              </div>
            )}

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

            {quote.notes && (
              <div>
                <h4 className="font-semibold text-foreground mb-2">Observações</h4>
                <p className="text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}

            <Separator />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Criado em: {formatDateTime(quote.created_at)}</span>
              <span>Atualizado em: {formatDateTime(quote.updated_at)}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <QuoteForm
        open={isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        quote={quote}
      />

      <ConvertQuoteModal
        open={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        quote={quote}
      />
    </>
  );
}
