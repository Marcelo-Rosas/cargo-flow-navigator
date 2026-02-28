import { useState } from 'react';
import {
  MapPin,
  DollarSign,
  Package,
  Scale,
  Box,
  Truck,
  CreditCard,
  Route,
  Landmark,
  Building2,
  Link2,
  Loader2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FinancialKanbanRow } from '@/types/financial';
import { FinancialAiAnalysis } from '@/components/financial/FinancialAiAnalysis';
import { useTrips, useLinkOrderToTargetTrip } from '@/hooks/useTrips';
import { toast } from 'sonner';

interface FinancialDetailModalProps {
  open: boolean;
  onClose: () => void;
  doc: FinancialKanbanRow | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateStr));
}

export function FinancialDetailModal({ open, onClose, doc }: FinancialDetailModalProps) {
  const { data: trips } = useTrips();
  const linkOrderToTargetTripMutation = useLinkOrderToTargetTrip();
  const [selectedTripId, setSelectedTripId] = useState<string>('');

  if (!doc) return null;

  const orderId =
    doc.type === 'PAG' && doc.source_type === 'order' && doc.source_id
      ? (doc.source_id as string)
      : null;
  const canLinkToTrip = !!orderId;
  const linkableTrips =
    trips?.filter((t) => ['aberta', 'em_transito'].includes(t.status_operational ?? '')) ?? [];

  const handleLinkToTrip = () => {
    if (!orderId || !selectedTripId) return;
    linkOrderToTargetTripMutation.mutate(
      { orderId, tripId: selectedTripId },
      {
        onSuccess: () => {
          toast.success('OS vinculada à Trip');
          setSelectedTripId('');
          onClose();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao vincular');
        },
      }
    );
  };

  const rawAmount =
    doc.type === 'PAG'
      ? (doc.carreteiro_real ?? doc.total_amount ?? doc.order_value ?? 0)
      : (doc.total_amount ?? doc.quote_value ?? doc.order_value ?? 0);
  const amount = Number(rawAmount);
  const name = (doc.client_name ?? doc.supplier_name ?? '—') as string;
  const dueDate = (doc.next_due_date ?? doc.due_date) as string | null | undefined;

  const hasCargo = doc.cargo_type || doc.weight != null || doc.volume != null;
  const hasPricing = doc.vehicle_type_name || doc.payment_term_name || doc.km_distance != null;
  const tollValue = doc.toll_value != null ? Number(doc.toll_value) : 0;

  const breakdown = doc.pricing_breakdown as Record<string, unknown> | null;
  const breakdownComponents = (breakdown?.components ?? null) as {
    toll?: number;
    gris?: number;
    tso?: number;
  } | null;
  const breakdownTotals = (breakdown?.totals ?? null) as {
    receitaBruta?: number;
    das?: number;
    totalCliente?: number;
    icms?: number;
  } | null;
  const breakdownProfitability = (breakdown?.profitability ?? null) as {
    margemPercent?: number;
    resultadoLiquido?: number;
    margemBruta?: number;
    custosCarreteiro?: number;
    custosDescarga?: number;
  } | null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{doc.code ?? doc.id?.slice(0, 8)}</span>
            <Badge variant={doc.is_overdue ? 'destructive' : 'secondary'}>
              {doc.status}
              {doc.is_overdue && ' • Atrasado'}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          {/* Client + Shipper */}
          <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-2">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="font-semibold">{name}</p>
              </div>
            </div>
            {doc.shipper_name && (
              <div className="pl-8">
                <p className="text-xs text-muted-foreground">Embarcador</p>
                <p className="text-sm font-medium">{doc.shipper_name as string}</p>
              </div>
            )}
          </div>

          {/* Route */}
          {doc.origin && doc.destination && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-xs">Origem</span>
                </div>
                <p className="font-medium text-sm">{doc.origin as string}</p>
                {doc.origin_cep && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    CEP: {doc.origin_cep as string}
                  </p>
                )}
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-xs">Destino</span>
                </div>
                <p className="font-medium text-sm">{doc.destination as string}</p>
                {doc.destination_cep && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    CEP: {doc.destination_cep as string}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Cargo Data */}
          {hasCargo && (
            <div>
              <h4 className="font-semibold text-foreground text-sm mb-2">Dados da Carga</h4>
              <div className="grid grid-cols-3 gap-2">
                {doc.cargo_type && (
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                      <Package className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Tipo</span>
                    </div>
                    <p className="font-medium text-xs">{doc.cargo_type as string}</p>
                  </div>
                )}
                {doc.weight != null && (
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                      <Scale className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Peso</span>
                    </div>
                    <p className="font-medium text-xs">
                      {Number(doc.weight) >= 1000
                        ? `${(Number(doc.weight) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t`
                        : `${Number(doc.weight).toLocaleString('pt-BR')} kg`}
                    </p>
                  </div>
                )}
                {doc.volume != null && (
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                      <Box className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Volume</span>
                    </div>
                    <p className="font-medium text-xs">
                      {Number(doc.volume).toLocaleString('pt-BR')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pricing Details */}
          {hasPricing && (
            <div>
              <h4 className="font-semibold text-foreground text-sm mb-2">
                Detalhes de Precificação
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {doc.vehicle_type_name && (
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                      <Truck className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Veículo</span>
                    </div>
                    <p className="font-medium text-xs">
                      {doc.vehicle_type_name as string}
                      {doc.vehicle_type_code && (
                        <span className="text-muted-foreground">
                          {' '}
                          ({doc.vehicle_type_code as string})
                        </span>
                      )}
                    </p>
                  </div>
                )}
                {doc.payment_term_name && (
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Prazo Pagamento</span>
                    </div>
                    <p className="font-medium text-xs">{doc.payment_term_name as string}</p>
                  </div>
                )}
                {doc.km_distance != null && (
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                      <Route className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Distância</span>
                    </div>
                    <p className="font-medium text-xs">
                      {Number(doc.km_distance).toLocaleString('pt-BR')} km
                    </p>
                  </div>
                )}
                {tollValue > 0 && (
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                      <Landmark className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Pedágio</span>
                    </div>
                    <p className="font-medium text-xs">{formatCurrency(tollValue)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Custos detalhados do breakdown */}
          {(breakdownComponents || breakdownProfitability) && (
            <div>
              <h4 className="font-semibold text-foreground text-sm mb-3">Custos detalhados</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {breakdownComponents?.toll != null && Number(breakdownComponents.toll) > 0 && (
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                      <Landmark className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Pedágio</span>
                    </div>
                    <p className="font-semibold text-sm">
                      {formatCurrency(Number(breakdownComponents.toll))}
                    </p>
                  </div>
                )}
                {breakdownProfitability?.custosCarreteiro != null &&
                  Number(breakdownProfitability.custosCarreteiro) > 0 && (
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                        <Truck className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Carreteiro</span>
                      </div>
                      <p className="font-semibold text-sm">
                        {formatCurrency(Number(breakdownProfitability.custosCarreteiro))}
                      </p>
                    </div>
                  )}
                {breakdownProfitability?.custosDescarga != null &&
                  Number(breakdownProfitability.custosDescarga) > 0 && (
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                      <span className="text-[10px] text-muted-foreground">Descarga</span>
                      <p className="font-semibold text-sm">
                        {formatCurrency(Number(breakdownProfitability.custosDescarga))}
                      </p>
                    </div>
                  )}
                {breakdownTotals?.das != null && Number(breakdownTotals.das) > 0 && (
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                    <span className="text-[10px] text-muted-foreground">DAS</span>
                    <p className="font-semibold text-sm">
                      {formatCurrency(Number(breakdownTotals.das))}
                    </p>
                  </div>
                )}
                {breakdownComponents?.gris != null && Number(breakdownComponents.gris) > 0 && (
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                    <span className="text-[10px] text-muted-foreground">GRIS</span>
                    <p className="font-semibold text-sm">
                      {formatCurrency(Number(breakdownComponents.gris))}
                    </p>
                  </div>
                )}
                {breakdownComponents?.tso != null && Number(breakdownComponents.tso) > 0 && (
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                    <span className="text-[10px] text-muted-foreground">TSO</span>
                    <p className="font-semibold text-sm">
                      {formatCurrency(Number(breakdownComponents.tso))}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Financial Values */}
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <DollarSign className="w-5 h-5" />
                <span className="font-medium">Valor do Documento</span>
              </div>
              <p className="text-2xl font-bold text-primary">{formatCurrency(amount)}</p>
            </div>

            {/* Breakdown summary if available */}
            {breakdownTotals && (
              <div className="mt-3 pt-3 border-t border-primary/10 grid grid-cols-2 gap-2 text-sm">
                {breakdownTotals.receitaBruta != null && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Receita Bruta</p>
                    <p className="font-medium">{formatCurrency(breakdownTotals.receitaBruta)}</p>
                  </div>
                )}
                {breakdownTotals.das != null && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">DAS</p>
                    <p className="font-medium">{formatCurrency(breakdownTotals.das)}</p>
                  </div>
                )}
              </div>
            )}

            {breakdownProfitability && breakdownProfitability.margemPercent != null && (
              <div className="mt-2 pt-2 border-t border-primary/10 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Margem</span>
                <Badge
                  variant={breakdownProfitability.margemPercent < 15 ? 'destructive' : 'default'}
                  className={
                    breakdownProfitability.margemPercent >= 15
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : ''
                  }
                >
                  {breakdownProfitability.margemPercent.toFixed(1)}%
                </Badge>
              </div>
            )}
          </div>

          {/* PAG-specific: carreteiro */}
          {(doc.carreteiro_antt != null || doc.carreteiro_real != null) && (
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                <p className="text-[10px] text-muted-foreground">Carreteiro ANTT</p>
                <p className="font-semibold text-sm">
                  {doc.carreteiro_antt != null ? formatCurrency(Number(doc.carreteiro_antt)) : '—'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border">
                <p className="text-[10px] text-muted-foreground">Carreteiro Real</p>
                <p className="font-semibold text-sm">
                  {doc.carreteiro_real != null ? formatCurrency(Number(doc.carreteiro_real)) : '—'}
                </p>
              </div>
            </div>
          )}

          {/* PAG: Vincular à Trip */}
          {canLinkToTrip && (
            <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Vincular à Trip
              </h4>
              {doc.trip_number && (
                <p className="text-xs text-muted-foreground">
                  Trip atual: <span className="font-mono font-medium">{doc.trip_number}</span>
                </p>
              )}
              <div className="flex gap-2">
                <Select
                  value={selectedTripId}
                  onValueChange={setSelectedTripId}
                  disabled={linkOrderToTargetTripMutation.isPending}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecionar Trip (VG-xxx)" />
                  </SelectTrigger>
                  <SelectContent>
                    {linkableTrips.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.trip_number ?? t.id.slice(0, 8)}
                        {t.driver?.name && ` — ${t.driver.name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleLinkToTrip}
                  disabled={!selectedTripId || linkOrderToTargetTripMutation.isPending}
                >
                  {linkOrderToTargetTripMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Vincular'
                  )}
                </Button>
              </div>
            </div>
          )}

          {dueDate && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground">Próximo vencimento</p>
              <p className="font-medium">{formatDate(dueDate)}</p>
            </div>
          )}

          {/* AI Analysis Section */}
          <FinancialAiAnalysis entityId={doc.id} entityType="financial_document" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
