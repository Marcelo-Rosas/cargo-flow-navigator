import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SectionBlock } from '@/components/ui/section-block';
import type { FinancialKanbanRow } from '@/types/financial';
import { FREIGHT_CONSTANTS } from '@/lib/freightCalculator';
import { FinancialAiAnalysis } from '@/components/financial/FinancialAiAnalysis';
import { FinancialCargoDetails } from '@/components/financial/modal-sections/FinancialCargoDetails';
import { FinancialCostBreakdown } from '@/components/financial/modal-sections/FinancialCostBreakdown';
import { FinancialPricingDetails } from '@/components/financial/modal-sections/FinancialPricingDetails';
import { FinancialQuoteReconciliation } from '@/components/financial/modal-sections/FinancialQuoteReconciliation';
import { FinancialOrderReconciliation } from '@/components/financial/modal-sections/FinancialOrderReconciliation';
import { FinancialRouteInfo } from '@/components/financial/modal-sections/FinancialRouteInfo';
import { FinancialTripLink } from '@/components/financial/modal-sections/FinancialTripLink';
import { useTrips, useLinkOrderToTargetTrip } from '@/hooks/useTrips';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { toast } from 'sonner';

interface FinancialDetailModalProps {
  open: boolean;
  onClose: () => void;
  doc: FinancialKanbanRow | null;
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

  const margemPercent = breakdownProfitability?.margemPercent ?? null;
  const hasBreakdown =
    breakdownComponents != null || breakdownTotals != null || breakdownProfitability != null;
  const hasCargo = doc.cargo_type != null || doc.weight != null || doc.volume != null;
  const hasRoute = !!(doc.origin || doc.destination);
  const hasOperacao =
    hasCargo ||
    tollValue > 0 ||
    doc.km_distance != null ||
    doc.vehicle_type_name != null ||
    doc.payment_term_name != null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[96vh] p-0 flex flex-col overflow-hidden gap-0">
        {/* ── Header fixo ──────────────────────────────────── */}
        <div className="shrink-0 bg-background border-b px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-base font-bold text-foreground">
                  {doc.code ?? doc.id?.slice(0, 8)}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold uppercase tracking-wide"
                >
                  {doc.type}
                </Badge>
                <Badge variant={doc.is_overdue ? 'destructive' : 'secondary'} className="text-xs">
                  {doc.status}
                  {doc.is_overdue && ' · Atrasado'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {name}
                {doc.origin && doc.destination && (
                  <span className="text-muted-foreground/60">
                    {' '}
                    · {doc.origin} → {doc.destination}
                  </span>
                )}
              </p>
            </div>
            {dueDate && (
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                  Vencimento
                </p>
                <p className="text-sm font-semibold tabular-nums">{formatDate(dueDate)}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Corpo scrollável ─────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* VALOR PRINCIPAL */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/70 mb-1">
                  {doc.type === 'FAT' ? 'Valor a Receber' : 'Valor a Pagar'}
                </p>
                <p className="text-3xl font-bold text-primary tabular-nums">
                  {formatCurrency(amount)}
                </p>
              </div>
              <div className="text-right space-y-1.5">
                {doc.payment_term_name && (
                  <p className="text-xs text-muted-foreground">{String(doc.payment_term_name)}</p>
                )}
                {margemPercent != null && (
                  <Badge
                    variant={margemPercent < FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT ? 'destructive' : 'default'}
                    className={
                      margemPercent >= FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : ''
                    }
                  >
                    Margem Op. {margemPercent.toFixed(1)}%
                  </Badge>
                )}
              </div>
            </div>

            {/* Carreteiro (PAG) inline no card de valor */}
            {(doc.carreteiro_antt != null || doc.carreteiro_real != null) && (
              <div className="mt-3 pt-3 border-t border-primary/10 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-primary/60 mb-0.5">Carreteiro ANTT</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {doc.carreteiro_antt != null
                      ? formatCurrency(Number(doc.carreteiro_antt))
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-primary/60 mb-0.5">Carreteiro Real</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {doc.carreteiro_real != null
                      ? formatCurrency(Number(doc.carreteiro_real))
                      : '—'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ROTA */}
          {hasRoute && (
            <SectionBlock label="Rota">
              <FinancialRouteInfo
                origin={doc.origin as string}
                destination={doc.destination as string}
                originCep={doc.origin_cep as string}
                destinationCep={doc.destination_cep as string}
              />
            </SectionBlock>
          )}

          {/* OPERAÇÃO */}
          {hasOperacao && (
            <SectionBlock label="Operação">
              <div className="space-y-2">
                {hasCargo && (
                  <FinancialCargoDetails
                    cargoType={doc.cargo_type as string | null}
                    weight={doc.weight as number | null}
                    volume={doc.volume as number | null}
                  />
                )}
                <FinancialPricingDetails
                  vehicleTypeName={doc.vehicle_type_name as string | null}
                  vehicleTypeCode={doc.vehicle_type_code as string | null}
                  paymentTermName={doc.payment_term_name as string | null}
                  kmDistance={doc.km_distance as number | null}
                  tollValue={tollValue}
                />
              </div>
            </SectionBlock>
          )}

          {/* CUSTOS */}
          {hasBreakdown && (
            <>
              <Separator />
              <SectionBlock label="Custos da Operação">
                <FinancialCostBreakdown
                  components={breakdownComponents}
                  totals={breakdownTotals}
                  profitability={breakdownProfitability}
                />
              </SectionBlock>
            </>
          )}

          <Separator />

          {/* COMPROVANTES DE PAGAMENTO — FAT */}
          {doc.type === 'FAT' && doc.source_type === 'quote' && doc.source_id && (
            <SectionBlock label="Comprovantes de Pagamento">
              <FinancialQuoteReconciliation quoteId={doc.source_id as string} />
            </SectionBlock>
          )}

          {/* COMPROVANTES DE PAGAMENTO — PAG */}
          {doc.type === 'PAG' && orderId && (
            <>
              <Separator />
              <SectionBlock label="Comprovantes de Pagamento">
                <FinancialOrderReconciliation orderId={orderId} />
              </SectionBlock>
            </>
          )}

          {/* VINCULAR VIAGEM — PAG */}
          {canLinkToTrip && (
            <FinancialTripLink
              currentTripNumber={doc.trip_number as string | null}
              linkableTrips={linkableTrips}
              selectedTripId={selectedTripId}
              onSelectedChange={setSelectedTripId}
              onLink={handleLinkToTrip}
              isPending={linkOrderToTargetTripMutation.isPending}
            />
          )}

          {/* IA */}
          <FinancialAiAnalysis entityId={doc.id} entityType="financial_document" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
