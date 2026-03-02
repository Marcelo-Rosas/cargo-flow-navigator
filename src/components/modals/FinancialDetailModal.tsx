import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { FinancialKanbanRow } from '@/types/financial';
import { FinancialAiAnalysis } from '@/components/financial/FinancialAiAnalysis';
import { FinancialCargoDetails } from '@/components/financial/modal-sections/FinancialCargoDetails';
import { FinancialClientHeader } from '@/components/financial/modal-sections/FinancialClientHeader';
import { FinancialCostBreakdown } from '@/components/financial/modal-sections/FinancialCostBreakdown';
import { FinancialPricingDetails } from '@/components/financial/modal-sections/FinancialPricingDetails';
import { FinancialQuoteReconciliation } from '@/components/financial/modal-sections/FinancialQuoteReconciliation';
import { FinancialDueDate } from '@/components/financial/modal-sections/FinancialDueDate';
import { FinancialRouteInfo } from '@/components/financial/modal-sections/FinancialRouteInfo';
import { FinancialTripLink } from '@/components/financial/modal-sections/FinancialTripLink';
import { FinancialValuesBlock } from '@/components/financial/modal-sections/FinancialValuesBlock';
import { useTrips, useLinkOrderToTargetTrip } from '@/hooks/useTrips';
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
          <FinancialClientHeader name={name} shipperName={doc.shipper_name as string} />

          {/* Route */}
          <FinancialRouteInfo
            origin={doc.origin as string}
            destination={doc.destination as string}
            originCep={doc.origin_cep as string}
            destinationCep={doc.destination_cep as string}
          />

          {/* Cargo Data */}
          <FinancialCargoDetails
            cargoType={doc.cargo_type as string | null}
            weight={doc.weight as number | null}
            volume={doc.volume as number | null}
          />

          {/* Pricing Details */}
          <FinancialPricingDetails
            vehicleTypeName={doc.vehicle_type_name as string | null}
            vehicleTypeCode={doc.vehicle_type_code as string | null}
            paymentTermName={doc.payment_term_name as string | null}
            kmDistance={doc.km_distance as number | null}
            tollValue={tollValue}
          />

          <Separator />

          {/* Custos detalhados do breakdown */}
          <FinancialCostBreakdown
            components={breakdownComponents}
            totals={breakdownTotals}
            profitability={breakdownProfitability}
          />

          <Separator />

          {/* Financial Values & Carreteiro */}
          <FinancialValuesBlock
            amount={amount}
            totals={breakdownTotals}
            profitability={breakdownProfitability}
            carreteiroAntt={doc.carreteiro_antt as number | null}
            carreteiroReal={doc.carreteiro_real as number | null}
          />

          {/* PAG: Vincular à Trip */}
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

          {/* FAT: Conciliação de Recebimento */}
          {doc.type === 'FAT' && doc.source_type === 'quote' && doc.source_id && (
            <FinancialQuoteReconciliation quoteId={doc.source_id as string} />
          )}

          {/* Próximo Vencimento */}
          {dueDate && <FinancialDueDate dueDate={dueDate} />}

          {/* AI Analysis Section */}
          <FinancialAiAnalysis entityId={doc.id} entityType="financial_document" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
