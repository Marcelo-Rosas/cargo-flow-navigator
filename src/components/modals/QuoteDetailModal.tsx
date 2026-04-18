import { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  Receipt,
  FileText,
  Landmark,
  Truck,
  Scale,
  Box,
  Package,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { SectionBlock } from '@/components/ui/section-block';
import { DataCard } from '@/components/ui/data-card';
import { FinancialRouteInfo } from '@/components/financial/modal-sections/FinancialRouteInfo';
import { QuoteForm } from '@/components/forms/QuoteForm';
import { ConvertQuoteModal } from '@/components/modals/ConvertQuoteModal';
import type { Database, Json } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { usePriceTable } from '@/hooks/usePriceTables';
import { usePricingParameter, useConditionalFees, usePaymentTerms } from '@/hooks/usePricingRules';
import { useUpdateQuote } from '@/hooks/useQuotes';
import { useQuoteRouteStops } from '@/hooks/useQuoteRouteStops';
import {
  useCalculateFreight,
  buildStoredBreakdownFromEdgeResponse,
} from '@/hooks/useCalculateFreight';
import type { CalculateFreightInput } from '@/types/freight';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAnttFloorRate, calculateAnttMinimum } from '@/hooks/useAnttFloorRate';
import { supabase } from '@/integrations/supabase/client';
import { asDb, asInsert, filterSupabaseRows, filterSupabaseSingle } from '@/lib/supabase-utils';
import {
  formatRouteUf,
  StoredPricingBreakdown,
  TollPlaza,
  FREIGHT_CONSTANTS,
} from '@/lib/freightCalculator';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { DocFatUploadedList } from '@/components/documents/DocFatUploadedList';
import { useProcessQuotePaymentProof } from '@/hooks/useQuotePaymentProofs';
import {
  QuoteModalHeader,
  QuoteModalFinancialSummary,
  QuoteModalCostCompositionTab,
  QuoteModalEquipmentItemsTab,
  QuoteModalHistoryTab,
} from '@/components/modals/quote-detail';
import { formatCurrency } from '@/lib/formatters';
import { usePdfDownload } from '@/hooks/usePdfDownload';

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

const TARGET_MARGIN_PERCENT = FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT;

export function QuoteDetailModal({
  open,
  onClose,
  quote,
  canManage = true,
}: QuoteDetailModalProps) {
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isConvertingToFat, setIsConvertingToFat] = useState(false);
  const [selectedAdvancePercent, setSelectedAdvancePercent] = useState<string>('0');
  const [activePaymentTermId, setActivePaymentTermId] = useState<string | null>(
    quote?.payment_term_id ?? null
  );
  const advanceRequestId = useRef(0);
  const [isAdvanceChanging, setIsAdvanceChanging] = useState(false);

  // Sync activePaymentTermId when quote prop changes (e.g. modal opens with different quote)
  useEffect(() => {
    setActivePaymentTermId(quote?.payment_term_id ?? null);
  }, [quote?.id, quote?.payment_term_id]);
  const queryClient = useQueryClient();
  const updateQuoteMutation = useUpdateQuote();
  const calculateFreightMutation = useCalculateFreight();
  const processQuotePaymentProofMutation = useProcessQuotePaymentProof();

  // All hooks MUST be called before any conditional returns
  const { data: priceTable } = usePriceTable(quote?.price_table_id || '');
  const { data: routeStops } = useQuoteRouteStops(open && quote ? quote.id : null);
  const { data: taxRegimeParam } = usePricingParameter('tax_regime_simples');
  const { data: taxRegimeLPParam } = usePricingParameter('tax_regime_lucro_presumido');
  const { data: conditionalFeesData } = useConditionalFees(true);
  const { data: paymentTermsList } = usePaymentTerms(true);

  /** Opções dinâmicas de adiantamento baseadas nos prazos de pagamento cadastrados */
  const advanceOptions = useMemo(() => {
    if (!paymentTermsList || paymentTermsList.length === 0)
      return [{ value: '0', label: 'À vista' }];
    const seen = new Set<number>();
    const opts: { value: string; label: string }[] = [];
    for (const t of paymentTermsList) {
      const adv = t.advance_percent ?? 0;
      if (seen.has(adv)) continue;
      seen.add(adv);
      opts.push({
        value: String(adv),
        label: adv === 0 ? 'À vista' : `${adv}% Adiantamento / ${100 - adv}% Saldo`,
      });
    }
    return opts.sort((a, b) => Number(a.value) - Number(b.value));
  }, [paymentTermsList]);
  const isLucroPresumido =
    taxRegimeLPParam?.value != null ? Number(taxRegimeLPParam.value) === 1 : false;
  const isSimplesNacional =
    !isLucroPresumido &&
    (taxRegimeParam?.value != null ? Number(taxRegimeParam.value) === 1 : true);

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
    queryKey: ['payment-term', activePaymentTermId],
    queryFn: async () => {
      if (!activePaymentTermId) return null;
      const { data } = await supabase
        .from('payment_terms')
        .select('name, code, adjustment_percent, advance_percent, days')
        .eq('id', asDb(activePaymentTermId))
        .maybeSingle();
      return filterSupabaseSingle<{
        name: string;
        code: string;
        adjustment_percent: number;
        advance_percent?: number | null;
        days?: number | null;
      }>(data);
    },
    enabled: !!activePaymentTermId,
  });

  // Sync advance percent when paymentTerm loads (after paymentTerm declaration)
  useEffect(() => {
    if (!paymentTerm) return;
    const p = paymentTerm.advance_percent;
    setSelectedAdvancePercent(String(p ?? 0));
  }, [paymentTerm]);

  const { downloadQuotePdf, loading: pdfLoading } = usePdfDownload();

  // Early return AFTER all hooks
  if (!quote) return null;

  const stageInfo = STAGE_LABELS[quote.stage];

  // REGRA: Converter para OS só quando stage === 'ganho'
  const canConvert = quote.stage === 'ganho';
  const showDocFatTab = quote.stage === 'ganho';

  // Parse pricing breakdown - using new StoredPricingBreakdown type
  const breakdown = quote.pricing_breakdown as unknown as StoredPricingBreakdown | null;
  const tollPlazas: TollPlaza[] = breakdown?.meta?.tollPlazas ?? [];
  const routeUfLabel =
    breakdown?.meta?.routeUfLabel || formatRouteUf(quote.origin, quote.destination);
  const kmBandLabel = breakdown?.meta?.kmBandLabel;
  const kmStatus = breakdown?.meta?.kmStatus || 'OK';

  // Cálculo original de margem (meta) ainda usado para alertas gerais
  const originalMarginPercent =
    breakdown?.meta?.marginPercent ?? breakdown?.profitability?.margemPercent;
  const marginStatus = breakdown?.meta?.marginStatus || 'UNKNOWN';

  // Visão contábil (DRE Asset-Light):
  // Total Cliente = Faturamento Bruto - Desconto | Receita Líquida = Total - Impostos
  // Resultado Líquido e Margem % vêm do breakdown quando disponível
  const discountView = breakdown?.totals?.discount ?? 0;
  const totalClienteBruto = breakdown?.totals?.totalCliente ?? 0;
  const totalClienteView = Math.max(0, totalClienteBruto - discountView);
  const receitaLiquidaView =
    (breakdown?.profitability as { receitaLiquida?: number } | undefined)?.receitaLiquida ?? null;

  const pisoAnttView = Number(breakdown?.meta?.antt?.total ?? anttCalc?.total ?? 0);
  const custosCarreteiroView =
    breakdown?.profitability?.custosCarreteiro ??
    (breakdown?.profitability as { custos_carreteiro?: number } | undefined)?.custos_carreteiro ??
    null;
  const custoMotoristaView =
    (breakdown?.profitability as { custoMotorista?: number } | undefined)?.custoMotorista ??
    custosCarreteiroView;
  const custoCarreteiroParaMargem =
    (custoMotoristaView ?? custosCarreteiroView) != null &&
    Number(custoMotoristaView ?? custosCarreteiroView) > 0
      ? Number(custoMotoristaView ?? custosCarreteiroView)
      : pisoAnttView;
  const cargaDescargaView = breakdown?.profitability?.custosDescarga ?? 0;
  const provisaoDasView = breakdown?.totals?.das ?? 0;
  const margemBrutaView =
    totalClienteView -
    custoCarreteiroParaMargem -
    cargaDescargaView -
    provisaoDasView -
    (breakdown?.totals?.icms ?? 0);

  const overheadView = breakdown?.profitability?.overhead ?? 0;
  const resultadoLiquidoView = (
    breakdown?.profitability?.resultadoLiquido != null
      ? breakdown.profitability.resultadoLiquido
      : margemBrutaView - overheadView
  ) as number;
  const margemPercentView = (
    breakdown?.profitability?.margemPercent != null
      ? breakdown.profitability.margemPercent
      : totalClienteView > 0
        ? (resultadoLiquidoView / totalClienteView) * 100
        : 0
  ) as number;
  const targetMargin =
    (breakdown?.profitability as { profitMarginTarget?: number; profit_margin_target?: number })
      ?.profitMarginTarget ??
    (breakdown?.profitability as { profit_margin_target?: number })?.profit_margin_target ??
    TARGET_MARGIN_PERCENT;
  const isBelowTargetView = margemPercentView < targetMargin;

  // Mantém compatibilidade com o alerta de margem existente
  const marginPercent = originalMarginPercent;
  const isBelowTarget =
    marginStatus === 'BELOW_TARGET' ||
    (originalMarginPercent !== undefined && originalMarginPercent < targetMargin);

  const handleAdvancePercentChange = async (value: string) => {
    if (!quote) return;
    const prev = selectedAdvancePercent;
    setSelectedAdvancePercent(value);
    setIsAdvanceChanging(true);
    const currentRequest = ++advanceRequestId.current;
    const isLatest = () => advanceRequestId.current === currentRequest;

    try {
      const targetPercent = Number(value); // 0, 50, ou 70
      const localCandidates =
        paymentTermsList?.filter((term) => Number(term.advance_percent ?? 0) === targetPercent) ??
        [];
      let targetTermId: string | undefined =
        localCandidates.length === 1 ? localCandidates[0].id : undefined;

      if (!targetTermId) {
        const { data, error } = await supabase
          .from('payment_terms')
          .select('id, code, advance_percent')
          .eq('advance_percent', targetPercent)
          .eq('active', true)
          .limit(2);
        if (error) throw error;
        if (!isLatest()) return;
        const rows = (
          filterSupabaseRows<{ id: string; code: string | null }>(data ?? []) || []
        ).slice(0, 2);
        if (rows.length === 1) {
          targetTermId = rows[0].id;
        } else if (rows.length > 1) {
          if (!isLatest()) return;
          toast.error(
            'Há mais de uma condição de pagamento com este percentual. Revise a configuração antes de atualizar.'
          );
          setSelectedAdvancePercent(prev);
          return;
        } else {
          if (!isLatest()) return;
          toast.error('Condição de pagamento não encontrada');
          setSelectedAdvancePercent(prev);
          return;
        }
      }
      if (!targetTermId) {
        if (!isLatest()) return;
        toast.error('Condição de pagamento não encontrada');
        setSelectedAdvancePercent(prev);
        return;
      }

      if (!isLatest()) return;
      await updateQuoteMutation.mutateAsync({
        id: quote.id,
        updates: { payment_term_id: targetTermId },
      });
      if (!isLatest()) return;
      setActivePaymentTermId(targetTermId);
      toast.success('Adiantamento atualizado');
    } catch {
      if (isLatest()) {
        toast.error('Erro ao salvar adiantamento');
        setSelectedAdvancePercent(prev);
      }
    } finally {
      if (advanceRequestId.current === currentRequest) {
        setIsAdvanceChanging(false);
      }
    }
  };

  const handleRecalcular = async () => {
    if (!quote) return;
    const bd = quote.pricing_breakdown as unknown as StoredPricingBreakdown | null;
    const weightKg = Number(quote.weight) || 0;
    const volumeM3 = Number(quote.volume) || 0;
    if (weightKg <= 0 && volumeM3 <= 0) {
      toast.error('Peso ou volume obrigatório para recalcular');
      return;
    }
    const payload: CalculateFreightInput = {
      origin: quote.origin,
      destination: quote.destination,
      km_distance: Number(quote.km_distance) || 0,
      weight_kg: weightKg > 0 ? weightKg : 1,
      volume_m3: volumeM3,
      cargo_value: Number(quote.cargo_value) || 0,
      toll_value: Number(quote.toll_value ?? bd?.components?.toll ?? 0),
      price_table_id: quote.price_table_id ?? undefined,
      vehicle_type_code: (vehicleType as { code?: string } | null)?.code,
      payment_term_code: (paymentTerm as { code?: string } | null)?.code ?? 'D30',
      descarga_value: bd?.profitability?.custosDescarga ?? 0,
      aluguel_maquinas_value: bd?.components?.aluguelMaquinas ?? 0,
      // v5: conditional_fees handled locally, not sent to Edge function
      waiting_hours: bd?.meta?.waitingTimeHours ?? undefined,
    };
    try {
      const response = await calculateFreightMutation.mutateAsync(payload);
      const newBreakdown = buildStoredBreakdownFromEdgeResponse(response, bd);
      // Apenas atualiza pricing_breakdown (memória de cálculo / ANTT / margem).
      // NÃO sobrescreve value — o preço negociado com o cliente é preservado.
      // Para alterar o value, o comercial deve passar pelo Wizard.
      await updateQuoteMutation.mutateAsync({
        id: quote.id,
        updates: {
          pricing_breakdown: newBreakdown as unknown as Json,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      const currentValue = Number(quote.value) || 0;
      const newCalcValue = response.totals.total_cliente;
      if (newCalcValue > currentValue && currentValue > 0) {
        toast.warning(
          `Memória recalculada. Valor sugerido (R$ ${newCalcValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) é maior que o valor atual. Avalie reajuste.`,
          { duration: 8000 }
        );
      } else {
        toast.success('Memória de cálculo recalculada com sucesso');
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Erro ao recalcular. Verifique os dados da cotação.'
      );
    }
  };

  const handleConvertToFAT = async () => {
    if (!quote) return;
    setIsConvertingToFat(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let token = sessionData?.session?.access_token;
      if (!token) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        token = refreshData?.session?.access_token ?? undefined;
      }
      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }
      const { data, error } = await supabase.functions.invoke('ensure-financial-document', {
        body: {
          docType: 'FAT',
          sourceId: quote.id,
          totalAmount: totalClienteView || Number(quote.value) || null,
        },
        headers: { Authorization: `Bearer ${token}` },
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

      // --- Create financial_installments for the FAT (mirrors CarreteiroTab logic) ---
      if (res?.data?.id) {
        const finDocId = res.data.id;
        const { data: existingInstallments } = await supabase
          .from('financial_installments')
          .select('id')
          .eq('financial_document_id', asDb(finDocId));

        if (!existingInstallments || existingInstallments.length === 0) {
          const fatTotal = totalClienteView || Number(quote.value) || 0;
          const advPercent =
            (paymentTerm as { advance_percent?: number | null } | null)?.advance_percent ?? 0;
          const advDate =
            (quote as { advance_due_date?: string | null }).advance_due_date ||
            new Date().toISOString().slice(0, 10);
          const balDate =
            (quote as { balance_due_date?: string | null }).balance_due_date ||
            new Date().toISOString().slice(0, 10);

          // --- Validate payment proofs before creating installments ---
          const { data: proofs, error: proofsError } = await supabase
            .from('quote_payment_proofs' as never)
            .select('proof_type, amount, expected_amount')
            .eq('quote_id', asDb(quote.id));

          if (proofsError) {
            console.error('[handleConvertToFAT] Falha ao buscar payment proofs:', proofsError);
            toast.warning(
              'Não foi possível buscar comprovantes de pagamento. Parcelas criadas com valor estimado.'
            );
          } else if (
            !proofs ||
            (
              proofs as {
                proof_type: string;
                amount: number | null;
                expected_amount: number | null;
              }[]
            ).length === 0
          ) {
            console.warn(
              '[handleConvertToFAT] Nenhum payment proof encontrado para quote',
              quote.id
            );
            toast.warning(
              'Nenhum comprovante de pagamento encontrado para esta cotação. Verifique a seção de documentos.'
            );
          } else {
            const proofRows = proofs as {
              proof_type: string;
              amount: number | null;
              expected_amount: number | null;
            }[];
            const nullAmounts = proofRows.filter((p) => p.amount == null);
            if (nullAmounts.length > 0) {
              console.error(
                '[handleConvertToFAT] Payment proofs sem valor confirmado:',
                nullAmounts.map((p) => p.proof_type)
              );
              toast.warning(
                `Comprovante(s) sem valor confirmado: ${nullAmounts.map((p) => p.proof_type).join(', ')}. Valor esperado usado como referência.`
              );
            }
          }
          // --- End validation ---

          if (advPercent > 0 && fatTotal > 0) {
            const advAmount = Math.round(fatTotal * (advPercent / 100) * 100) / 100;
            const balAmount = Math.round((fatTotal - advAmount) * 100) / 100;
            const installments = [
              {
                financial_document_id: finDocId,
                amount: advAmount,
                due_date: advDate,
                payment_method: `Adiantamento ${advPercent}%`,
                status: 'pendente' as const,
              },
              {
                financial_document_id: finDocId,
                amount: balAmount,
                due_date: balDate,
                payment_method: `Saldo ${100 - advPercent}%`,
                status: 'pendente' as const,
              },
            ];
            const { error: insError } = await supabase
              .from('financial_installments')
              .insert(installments.map(asInsert));
            if (insError) {
              console.error('Error inserting FAT installments:', insError);
              toast.error('FAT criado, mas erro ao criar parcelas: ' + insError.message);
            }
          } else if (fatTotal > 0) {
            const { error: insError } = await supabase.from('financial_installments').insert(
              asInsert({
                financial_document_id: finDocId,
                amount: fatTotal,
                due_date: advDate,
                payment_method: paymentTerm?.name || 'Pagamento Único',
                status: 'pendente' as const,
              })
            );
            if (insError) {
              console.error('Error inserting FAT installment:', insError);
              toast.error('FAT criado, mas erro ao criar parcela: ' + insError.message);
            }
          }
        }
      }

      toast.success(res?.data?.created ? 'FAT criado com sucesso' : 'FAT já existente');
      queryClient.invalidateQueries({ queryKey: ['financial-documents'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow-summary'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao converter para FAT';
      toast.error(msg);
    } finally {
      setIsConvertingToFat(false);
    }
  };

  const handleQuotePaymentDocCreated = async (documentId: string) => {
    try {
      await processQuotePaymentProofMutation.mutateAsync(documentId);
    } catch (e) {
      console.error('Erro ao processar comprovante Doc Fat:', e);
      toast.error('Arquivo enviado, mas erro ao processar conciliação Doc Fat');
    }
  };

  const handleSaveAntt = async () => {
    if (!quote || !anttCalc || !anttRate) return;
    const current = quote.pricing_breakdown as unknown as StoredPricingBreakdown | null;
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
          ccd: Number(anttRate.ccd || 0),
          cc: Number(anttRate.cc || 0),
          ida: Number(anttCalc.ida),
          retornoVazio: 0,
          total: Number(anttCalc.total),
          calculatedAt: new Date().toISOString(),
        },
      },
      weights: current?.weights || { cubageWeight: 0, billableWeight: 0, tonBillable: 0 },
      components: current?.components || {
        baseCost: 0,
        baseFreight: 0,
        toll: 0,
        aluguelMaquinas: 0,
        gris: 0,
        tso: 0,
        rctrc: 0,
        adValorem: 0,
        tde: 0,
        tear: 0,
        dispatchFee: 0,
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
          pricing_breakdown: updated as unknown as typeof quote.pricing_breakdown,
        })
      )
      .eq('id', asDb(quote.id));
    if (error) {
      toast.error('Erro ao salvar piso ANTT');
      return;
    }
    toast.success('Piso ANTT salvo na memória de cálculo');
    queryClient.invalidateQueries({ queryKey: ['quotes'] });
  };

  const vehicleName = (vehicleType as { name?: string } | null)?.name ?? null;
  const vehicleCode = (vehicleType as { code?: string } | null)?.code ?? null;
  const hasOperacao =
    vehicleType ||
    quote.cargo_type ||
    (quote.weight != null && Number(quote.weight) > 0) ||
    (quote.volume != null && Number(quote.volume) > 0) ||
    (quote.km_distance != null && Number(quote.km_distance) > 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[900px] max-h-[96vh] p-0 flex flex-col overflow-hidden gap-0">
          <DialogTitle className="sr-only">
            Detalhes da cotação {quote.quote_code ?? ''}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Visualize resumo financeiro, rota, operação e abas de composição da cotação.
          </DialogDescription>
          {/* ── Header fixo ──────────────────────────────────── */}
          <div className="shrink-0 bg-background border-b px-6 pt-5 pb-4">
            <QuoteModalHeader
              quoteCode={quote.quote_code ?? 'Cotação'}
              clientName={quote.client_name}
              stageLabel={stageInfo.label}
              stageColor={stageInfo.color}
              routeUfLabel={routeUfLabel || null}
              kmBandLabel={kmBandLabel ?? null}
              canManage={canManage}
              canConvert={canConvert}
              isConvertingToFat={isConvertingToFat}
              isRecalculating={calculateFreightMutation.isPending || updateQuoteMutation.isPending}
              onConvertToOS={() => setIsConvertModalOpen(true)}
              onConvertToFAT={handleConvertToFAT}
              onRecalcular={handleRecalcular}
              onEdit={() => setIsEditFormOpen(true)}
              showRecalcular={!!(breakdown && quote?.price_table_id && quote?.km_distance)}
            />
          </div>

          {/* ── Corpo scrollável ─────────────────────────────── */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-sm"
                aria-label="Baixar PDF simplificado para cliente"
                disabled={pdfLoading === 'quote:simplified'}
                onClick={() => downloadQuotePdf(quote.id, 'simplified')}
              >
                {pdfLoading === 'quote:simplified' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                PDF Simplificado (Cliente)
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-sm"
                aria-label="Baixar PDF detalhado interno"
                disabled={pdfLoading === 'quote:detailed'}
                onClick={() => downloadQuotePdf(quote.id, 'detailed')}
              >
                {pdfLoading === 'quote:detailed' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                PDF Detalhado (Interno)
              </Button>
            </div>
            {kmStatus === 'OUT_OF_RANGE' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Distância fora da faixa de quilometragem da tabela de preços selecionada
                </AlertDescription>
              </Alert>
            )}

            {/* RESUMO FINANCEIRO */}
            <QuoteModalFinancialSummary
              totalCliente={totalClienteView}
              discount={discountView}
              receitaLiquida={receitaLiquidaView != null ? receitaLiquidaView : undefined}
              resultadoLiquido={resultadoLiquidoView}
              margemPercent={margemPercentView}
              isBelowTarget={isBelowTarget}
              targetMarginPercent={targetMargin}
              marginPercentForAlert={marginPercent}
              regimeFiscal={
                (breakdown?.profitability as { regimeFiscal?: string } | undefined)?.regimeFiscal
              }
            />

            {/* ROTA */}
            {(quote.origin || quote.destination) && (
              <SectionBlock label="Rota">
                <FinancialRouteInfo
                  origin={quote.origin}
                  destination={quote.destination}
                  originCep={quote.origin_cep}
                  destinationCep={quote.destination_cep}
                  routeStops={(routeStops ?? [])
                    .filter((s) => s.stop_type === 'stop')
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((s) => ({ city_uf: s.city_uf, cep: s.cep, name: s.name }))}
                />
              </SectionBlock>
            )}

            {/* OPERAÇÃO */}
            {hasOperacao && (
              <SectionBlock label="Operação">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {vehicleName && (
                    <DataCard
                      label="Veículo"
                      value={vehicleName + (vehicleCode ? ` (${vehicleCode})` : '')}
                      icon={Truck}
                    />
                  )}
                  {quote.cargo_type && (
                    <DataCard label="Tipo de Carga" value={quote.cargo_type} icon={Package} />
                  )}
                  {quote.weight != null && Number(quote.weight) > 0 && (
                    <DataCard
                      label="Peso"
                      value={
                        Number(quote.weight) >= 1000
                          ? `${(Number(quote.weight) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t`
                          : `${Number(quote.weight).toLocaleString('pt-BR')} kg`
                      }
                      icon={Scale}
                    />
                  )}
                  {quote.volume != null && Number(quote.volume) > 0 && (
                    <DataCard
                      label="Volume"
                      value={`${Number(quote.volume).toLocaleString('pt-BR')} m³`}
                      icon={Box}
                    />
                  )}
                  {quote.km_distance != null && Number(quote.km_distance) > 0 && (
                    <DataCard
                      label="Distância"
                      value={`${Number(quote.km_distance).toLocaleString('pt-BR')} km`}
                      icon={Package}
                    />
                  )}
                  {custoMotoristaView != null && (
                    <DataCard
                      label="Custo Motorista"
                      value={formatCurrency(Number(custoMotoristaView))}
                      icon={Truck}
                      variant="warning"
                    />
                  )}
                </div>

                {/* Spread R$/KM */}
                {quote.km_distance != null &&
                  Number(quote.km_distance) > 0 &&
                  custoMotoristaView != null &&
                  totalClienteView > 0 &&
                  (() => {
                    const km = Number(quote.km_distance);
                    const custo = Number(custoMotoristaView);
                    const spread = (totalClienteView - custo) / km;
                    return (
                      <div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-0.5">
                              Spread (Venda — Custo)
                            </p>
                            <p className="text-lg font-bold text-primary tabular-nums">
                              R${' '}
                              {spread.toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                              /km
                            </p>
                          </div>
                          <div className="text-right space-y-0.5">
                            <p className="text-xs text-destructive tabular-nums font-medium">
                              Custo: R${' '}
                              {(custo / km).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                              /km
                            </p>
                            <p className="text-xs text-success tabular-nums font-medium">
                              Venda: R${' '}
                              {(totalClienteView / km).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                              /km
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
              </SectionBlock>
            )}

            <Separator />

            {/* ABAS */}
            <Tabs defaultValue="composicao">
              <TabsList
                className={cn('grid w-full', showDocFatTab ? 'grid-cols-5' : 'grid-cols-4')}
              >
                <TabsTrigger value="composicao" className="gap-1.5 text-xs">
                  <Receipt className="w-3.5 h-3.5" />
                  Composição
                </TabsTrigger>
                <TabsTrigger value="itens" className="gap-1.5 text-xs">
                  Itens
                </TabsTrigger>
                <TabsTrigger value="historico" className="gap-1.5 text-xs">
                  Histórico
                </TabsTrigger>
                <TabsTrigger value="pedagios" className="gap-1.5 text-xs">
                  <Landmark className="w-3.5 h-3.5" />
                  Pedágios
                  {tollPlazas.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] ml-1 px-1">
                      {tollPlazas.length}
                    </Badge>
                  )}
                </TabsTrigger>
                {showDocFatTab && (
                  <TabsTrigger value="doc_fat" className="gap-1.5 text-xs">
                    <FileText className="w-3.5 h-3.5" />
                    Doc Fat
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="composicao" className="space-y-4 mt-4 m-0">
                <QuoteModalCostCompositionTab
                  breakdown={breakdown}
                  isSimplesNacional={isSimplesNacional}
                  pisoAnttTotal={pisoAnttView}
                  custosDescarga={cargaDescargaView}
                  conditionalFeesData={conditionalFeesData ?? undefined}
                  margemBruta={margemBrutaView}
                  overhead={overheadView}
                  resultadoLiquido={resultadoLiquidoView}
                  margemPercent={margemPercentView}
                  isBelowTarget={isBelowTarget}
                  targetMarginPercent={targetMargin}
                  canManage={!!canManage}
                  axesCount={axesCount}
                  kmDistance={kmDistance}
                  anttRateCcd={anttRate?.ccd}
                  anttRateCc={anttRate?.cc}
                  hasAnttCalc={!!anttCalc}
                  onSaveAntt={handleSaveAntt}
                  cargoValue={Number(quote?.cargo_value) || 0}
                  onRecalculate={handleRecalcular}
                  isRecalculating={
                    calculateFreightMutation.isPending || updateQuoteMutation.isPending
                  }
                />
              </TabsContent>

              <TabsContent value="itens" className="space-y-4 mt-4 m-0">
                <QuoteModalEquipmentItemsTab breakdown={breakdown} />
              </TabsContent>

              <TabsContent value="historico" className="space-y-4 mt-4 m-0">
                <QuoteModalHistoryTab
                  createdAt={quote.created_at}
                  updatedAt={quote.updated_at}
                  advanceDueDate={
                    (quote as { advance_due_date?: string | null })?.advance_due_date ?? null
                  }
                  balanceDueDate={
                    (quote as { balance_due_date?: string | null })?.balance_due_date ?? null
                  }
                  advancePercent={
                    Number(
                      (paymentTerm as { advance_percent?: number | null } | null)
                        ?.advance_percent ?? 0
                    ) || 0
                  }
                  totalCliente={totalClienteView}
                />
              </TabsContent>

              <TabsContent value="pedagios" className="space-y-4 mt-4 m-0">
                {tollPlazas.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Landmark className="h-4 w-4" />
                        Praças de Pedágio da Rota
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {tollPlazas.length} praça{tollPlazas.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="rounded-md border overflow-auto max-h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10 text-center">#</TableHead>
                            <TableHead>Praça</TableHead>
                            <TableHead>Cidade/UF</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">TAG</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tollPlazas.map((plaza, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-center text-muted-foreground text-xs">
                                {plaza.ordemPassagem || idx + 1}
                              </TableCell>
                              <TableCell className="text-sm font-medium">{plaza.nome}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {plaza.cidade}
                                {plaza.uf ? ` - ${plaza.uf}` : ''}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {plaza.valor.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                  minimumFractionDigits: 2,
                                })}
                              </TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground">
                                {plaza.valorTag.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                  minimumFractionDigits: 2,
                                })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow className="font-semibold">
                            <TableCell colSpan={3} className="text-right">
                              Total ({tollPlazas.length} praça{tollPlazas.length !== 1 ? 's' : ''})
                            </TableCell>
                            <TableCell className="text-right">
                              {tollPlazas
                                .reduce((sum, p) => sum + p.valor, 0)
                                .toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {tollPlazas
                                .reduce((sum, p) => sum + p.valorTag, 0)
                                .toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Landmark className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma praça de pedágio registrada.
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Edite a cotação e clique &quot;Calcular KM&quot; para carregar as praças da
                      rota.
                    </p>
                  </div>
                )}
              </TabsContent>

              {showDocFatTab && (
                <TabsContent value="doc_fat" className="space-y-6 mt-4 m-0">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Condição de recebimento
                      </label>
                      <Select
                        value={selectedAdvancePercent}
                        onValueChange={handleAdvancePercentChange}
                        disabled={!canManage || updateQuoteMutation.isPending || isAdvanceChanging}
                      >
                        <SelectTrigger
                          className="w-full max-w-[260px]"
                          data-testid="advance-select-trigger"
                        >
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent data-testid="advance-select-content">
                          {advanceOptions.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={opt.value}
                              data-testid={`advance-option-${opt.value}`}
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {canManage && (
                      <DocumentUpload
                        quoteId={quote.id}
                        financialContext="quote_receivable"
                        onQuotePaymentDocCreated={handleQuotePaymentDocCreated}
                        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['documents'] })}
                      />
                    )}
                    {/* Leitura apenas — conciliação é executada pelo financeiro */}
                    <DocFatUploadedList quoteId={quote.id} />
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
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
