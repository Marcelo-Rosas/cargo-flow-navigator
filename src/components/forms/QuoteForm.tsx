import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Calculator, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { MaskedInput } from '@/components/ui/masked-input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCreateQuote, useUpdateQuote, useDeleteQuote } from '@/hooks/useQuotes';
import { useClients } from '@/hooks/useClients';
import { useShippers } from '@/hooks/useShippers';
import { usePriceTables } from '@/hooks/usePriceTables';
import {
  useVehicleTypes,
  usePaymentTerms,
  usePricingParameter,
  useConditionalFees,
} from '@/hooks/usePricingRules';
import { usePriceTableRowByKmRange, usePriceTableRows } from '@/hooks/usePriceTableRows';
import {
  AdditionalFeesSection,
  AdditionalFeesSelection,
  defaultAdditionalFeesSelection,
} from '@/components/quotes/AdditionalFeesSection';
import {
  UnloadingCostSection,
  type UnloadingCostItem,
} from '@/components/quotes/UnloadingCostSection';
import {
  EquipmentRentalSection,
  type EquipmentRentalItem,
} from '@/components/quotes/EquipmentRentalSection';
import { useIcmsRateForPricing } from '@/hooks/useIcmsRates';
import { useAnttFloorRate, calculateAnttMinimum } from '@/hooks/useAnttFloorRate';
import { useAuth } from '@/hooks/useAuth';
import { invokeEdgeFunction } from '@/lib/supabase-invoke';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import {
  calculateFreight,
  buildStoredBreakdown,
  formatRouteUf,
  extractUf,
  StoredPricingBreakdown,
  TollPlaza,
} from '@/lib/freightCalculator';
import { zodPhone } from '@/lib/validators';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { QuoteFormWizard } from '@/components/forms/quote-form/QuoteFormWizard';

type Quote = Database['public']['Tables']['quotes']['Row'];

const USE_WIZARD = true;

// Select/Combobox podem passar number; coerce para string
const idString = z
  .union([z.string(), z.number()])
  .transform((v) => (v == null || v === '' ? undefined : String(v)))
  .optional();

const quoteSchema = z
  .object({
    client_id: idString,
    client_name: z.string().min(2, 'Nome do cliente obrigatório'),
    client_email: z.string().email('E-mail inválido').optional().or(z.literal('')),
    shipper_id: idString,
    shipper_name: z.string().optional(),
    shipper_email: z.string().email('E-mail inválido').optional().or(z.literal('')),
    freight_type: z.enum(['CIF', 'FOB']).default('FOB'),
    freight_modality: z.enum(['lotacao', 'fracionado']).optional(),
    // MaskedInput pode devolver number; coerce para string pra evitar erro do Zod.
    origin_cep: z
      .union([z.string(), z.number()])
      .transform((v) => (v == null ? '' : String(v)))
      .optional(),
    destination_cep: z
      .union([z.string(), z.number()])
      .transform((v) => (v == null ? '' : String(v)))
      .optional(),
    origin: z.string().min(2, 'Origem obrigatória'),
    destination: z.string().min(2, 'Destino obrigatório'),
    cargo_type: z.string().optional(),
    weight: z
      .number()
      .min(0, 'Peso inválido')
      .max(99_999_999, 'Peso excede o limite (99.999.999)')
      .optional()
      .default(0),
    volume: z
      .number()
      .min(0, 'Volume inválido')
      .max(99_999_999, 'Volume excede o limite (99.999.999)')
      .optional()
      .default(0),
    // Pricing selectors
    price_table_id: idString,
    vehicle_type_id: idString,
    payment_term_id: idString,
    km_distance: z.number().min(0, 'Distância inválida').optional(),
    // Pricing components
    cargo_value: z.number().min(0, 'Valor inválido').optional().default(0),
    toll: z.number().min(0, 'Valor inválido').optional().default(0),
    aluguel_maquinas: z.number().min(0, 'Valor inválido').optional().default(0),
    descarga: z.number().min(0, 'Valor inválido').optional().default(0),
    // NTC flags
    tde_enabled: z.boolean().optional().default(false),
    tear_enabled: z.boolean().optional().default(false),
    notes: z.string().max(500, 'Observações muito longas').optional(),
    // Condição financeira: datas manuais (adiantamento, à vista, saldo)
    advance_due_date: z.string().optional(),
    balance_due_date: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Validação cross-field: se ambas as datas estiverem preenchidas,
    // a data de saldo não pode ser anterior à data de adiantamento.
    if (data.advance_due_date && data.balance_due_date) {
      const adv = new Date(data.advance_due_date);
      const bal = new Date(data.balance_due_date);
      if (!isNaN(adv.getTime()) && !isNaN(bal.getTime()) && bal < adv) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Data do saldo não pode ser anterior à data do adiantamento',
          path: ['balance_due_date'],
        });
      }
    }
  });

export type QuoteFormData = z.infer<typeof quoteSchema>;

interface QuoteFormProps {
  open: boolean;
  onClose: () => void;
  quote?: Quote | null;
}

// Utility: sanitize CEP to 8 digits
const sanitizeCep = (value: string) => value.replace(/\D/g, '').slice(0, 8);

const kgToUnit = (kg: number, unit: 'kg' | 'ton') => (unit === 'ton' ? kg / 1000 : kg);
const unitToKg = (value: number, unit: 'kg' | 'ton') => (unit === 'ton' ? value * 1000 : value);

export function QuoteForm({ open, onClose, quote }: QuoteFormProps) {
  const { user } = useAuth();
  const { data: clients } = useClients();
  const { data: shippers } = useShippers();
  const { data: priceTables } = usePriceTables();
  const { data: vehicleTypes } = useVehicleTypes();
  const { data: paymentTerms } = usePaymentTerms();
  const { data: conditionalFeesData } = useConditionalFees(true);
  const createQuoteMutation = useCreateQuote();
  const updateQuoteMutation = useUpdateQuote();
  const deleteQuoteMutation = useDeleteQuote();
  const isEditing = !!quote;

  // Track if user manually edited origin/destination
  const userEditedOrigin = useRef(false);
  const userEditedDestination = useRef(false);

  // Loading states for CEP lookups
  const [isLoadingOriginCep, setIsLoadingOriginCep] = useState(false);
  const [isLoadingDestinationCep, setIsLoadingDestinationCep] = useState(false);
  const [isCalculatingKm, setIsCalculatingKm] = useState(false);

  // Toll plazas from WebRouter
  const [tollPlazas, setTollPlazas] = useState<TollPlaza[]>([]);

  // Weight unit toggle: kg or ton
  const [weightUnit, setWeightUnit] = useState<'kg' | 'ton'>('ton');

  // Taxas adicionais (conditional fees + estadia)
  const [additionalFeesSelection, setAdditionalFeesSelection] = useState<AdditionalFeesSelection>(
    defaultAdditionalFeesSelection
  );
  const [unloadingCostItems, setUnloadingCostItems] = useState<UnloadingCostItem[]>([]);
  const [equipmentRentalItems, setEquipmentRentalItems] = useState<EquipmentRentalItem[]>([]);

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      client_id: '',
      client_name: '',
      client_email: '',
      shipper_id: '',
      shipper_name: '',
      shipper_email: '',
      freight_type: 'FOB',
      freight_modality: undefined,
      origin_cep: '',
      destination_cep: '',
      origin: '',
      destination: '',
      cargo_type: '',
      weight: 0,
      volume: 0,
      price_table_id: '',
      vehicle_type_id: '',
      payment_term_id: '',
      km_distance: undefined,
      cargo_value: 0,
      toll: 0,
      aluguel_maquinas: 0,
      descarga: 0,
      tde_enabled: false,
      tear_enabled: false,
      notes: '',
      advance_due_date: '',
      balance_due_date: '',
    },
  });

  const watchedFreightModality = form.watch('freight_modality');
  const watchedPriceTableId = form.watch('price_table_id');
  const watchedKmDistance = form.watch('km_distance');
  const watchedVehicleTypeId = form.watch('vehicle_type_id');

  // Filtrar tabelas pela modalidade (lotação → só lotação; fracionado → só fracionado)
  const priceTablesFiltered =
    priceTables?.filter((t) => !watchedFreightModality || t.modality === watchedFreightModality) ??
    [];
  const watchedOrigin = form.watch('origin');
  const watchedDestination = form.watch('destination');
  const watchedWeight = form.watch('weight');
  const watchedVolume = form.watch('volume');
  const watchedCargoValue = form.watch('cargo_value');
  const watchedToll = form.watch('toll');
  const watchedAluguelMaquinas = form.watch('aluguel_maquinas');
  const watchedDescarga = form.watch('descarga');
  const watchedTdeEnabled = form.watch('tde_enabled');
  const watchedTearEnabled = form.watch('tear_enabled');

  // Serialização estável para debounce (evita reexecução a cada tecla)
  const calcSnapshot = JSON.stringify([
    watchedOrigin,
    watchedDestination,
    watchedWeight,
    watchedVolume,
    watchedCargoValue,
    watchedToll,
    watchedAluguelMaquinas,
    watchedDescarga,
    watchedKmDistance,
    watchedPriceTableId,
    watchedTdeEnabled,
    watchedTearEnabled,
  ]);
  const debouncedSnapshot = useDebouncedValue(calcSnapshot, 400);
  const debounced = useMemo(() => {
    try {
      const arr = JSON.parse(debouncedSnapshot || '[]') as unknown[];
      return {
        origin: (arr[0] as string) ?? '',
        destination: (arr[1] as string) ?? '',
        weight: (arr[2] as number) ?? 0,
        volume: (arr[3] as number) ?? 0,
        cargoValue: (arr[4] as number) ?? 0,
        toll: (arr[5] as number) ?? 0,
        aluguelMaquinas: (arr[6] as number) ?? 0,
        descarga: (arr[7] as number) ?? 0,
        kmDistance: (arr[8] as number | undefined) ?? undefined,
        priceTableId: (arr[9] as string) ?? '',
        tdeEnabled: (arr[10] as boolean) ?? false,
        tearEnabled: (arr[11] as boolean) ?? false,
      };
    } catch {
      return {
        origin: '',
        destination: '',
        weight: 0,
        volume: 0,
        cargoValue: 0,
        toll: 0,
        aluguelMaquinas: 0,
        descarga: 0,
        kmDistance: undefined as number | undefined,
        priceTableId: '',
        tdeEnabled: false,
        tearEnabled: false,
      };
    }
  }, [debouncedSnapshot]);
  const isCalculationStale = calcSnapshot !== debouncedSnapshot;
  const watchedPaymentTermId = form.watch('payment_term_id');
  const selectedPaymentTerm = paymentTerms?.find((t) => t.id === watchedPaymentTermId);

  // Busca faixas via REST (price_table_rows) e seleciona a faixa do km via query (lte/gte)
  const kmForBand = Number(watchedKmDistance || 0);
  const kmBand = Math.ceil(kmForBand);
  const debouncedKmBand = Math.ceil(Number(debounced.kmDistance || 0));

  // Lista de faixas (usada só para exibir no alerta de OUT_OF_RANGE)
  const { data: priceTableRows } = usePriceTableRows(watchedPriceTableId || '');

  // Busca a faixa correta (1 row) via REST; usa valores debounced para alinhar aos cálculos
  const {
    data: priceTableRow,
    isLoading: isLoadingPriceRow,
    error: priceRowError,
  } = usePriceTableRowByKmRange(debounced.priceTableId || '', debouncedKmBand);

  const kmRounded = kmBand;

  // Label da faixa de km (a partir do km_distance + price_table_rows) para o badge
  const faixaLabel =
    priceTableRow != null
      ? `${priceTableRow.km_from}-${priceTableRow.km_to}`
      : priceTableRows?.length && kmBand > 0
        ? (() => {
            const r = priceTableRows.find((r) => r.km_from <= kmBand && r.km_to >= kmBand);
            return r ? `${r.km_from}-${r.km_to}` : null;
          })()
        : null;

  // Get ICMS rate for origin/destination states
  const originUf = extractUf(watchedOrigin || '');
  const destUf = extractUf(watchedDestination || '');
  const { data: icmsRateData } = useIcmsRateForPricing(originUf || '', destUf || '');
  const icmsRate = icmsRateData?.rate_percent ?? 12;

  // Regime tributário global (1 = Simples → ICMS 0%; 0 = Normal)
  const { data: taxRegimeParam } = usePricingParameter('tax_regime_simples');
  const taxRegimeSimples = taxRegimeParam?.value != null ? Number(taxRegimeParam.value) : 1;

  // ANTT floor rate (Piso mínimo carreteiro) - Tabela A / Carga Geral
  const selectedVehicle = vehicleTypes?.find((v) => v.id === watchedVehicleTypeId) ?? null;
  // Fallback: quando vehicleTypes ainda está carregando, usa o axesCount salvo no breakdown
  const savedAxesCount =
    (quote?.pricing_breakdown as unknown as StoredPricingBreakdown | null)?.meta?.antt?.axesCount ??
    null;
  const axesCountForAntt = selectedVehicle?.axes_count ?? savedAxesCount;
  const kmDistanceForAntt = Number(watchedKmDistance || 0);

  const { data: anttRate } = useAnttFloorRate({
    operationTable: 'A',
    cargoType: 'carga_geral',
    axesCount: axesCountForAntt ?? undefined,
  });

  // Normalize weight to kg; clamp to DECIMAL(10,2) max (99.999.999,99)
  const effectiveWeightKg = Math.min(unitToKg(watchedWeight || 0, weightUnit), 99_999_999.99);
  const debouncedEffectiveWeightKg = Math.min(
    unitToKg(debounced.weight || 0, weightUnit),
    99_999_999.99
  );

  // R$/KM — custo ANTT por km (referência ao vivo)
  // Prioridade: 1) rate do banco (mais atualizado) 2) coeficientes salvos no breakdown
  const savedAnttMeta =
    (quote?.pricing_breakdown as unknown as StoredPricingBreakdown | null)?.meta?.antt ?? null;
  const anttRsKm = useMemo(() => {
    const km = Number(watchedKmDistance || 0);
    if (km <= 0) return null;
    if (anttRate) {
      const anttTotal = km * Number(anttRate.ccd) + Number(anttRate.cc);
      return anttTotal / km;
    }
    // Fallback: usar ccd/cc do breakdown salvo quando anttRate ainda não carregou
    if (savedAnttMeta?.ccd != null && savedAnttMeta?.cc != null) {
      const anttTotal = km * Number(savedAnttMeta.ccd) + Number(savedAnttMeta.cc);
      return anttTotal / km;
    }
    return null;
  }, [anttRate, watchedKmDistance, savedAnttMeta]);

  // Passo 1: calcular frete sem taxas condicionais (usa valores debounced)
  const baseCalculationResult = useMemo(() => {
    return calculateFreight({
      originCity: debounced.origin || '',
      destinationCity: debounced.destination || '',
      weightKg: debouncedEffectiveWeightKg,
      volumeM3: debounced.volume || 0,
      cargoValue: debounced.cargoValue || 0,
      tollValue: debounced.toll || 0,
      aluguelMaquinasValue: debounced.aluguelMaquinas || 0,
      descargaValue: debounced.descarga ?? 0,
      kmDistance: debouncedKmBand,
      priceTableRow: priceTableRow || null,
      priceTableId: debounced.priceTableId || undefined,
      icmsRatePercent: icmsRate,
      tdeEnabled: debounced.tdeEnabled || false,
      tearEnabled: debounced.tearEnabled || false,
      pricingParams: { taxRegimeSimples },
    });
  }, [
    debounced.origin,
    debounced.destination,
    debouncedEffectiveWeightKg,
    debounced.volume,
    debounced.cargoValue,
    debounced.toll,
    debounced.aluguelMaquinas,
    debounced.descarga,
    debounced.kmDistance,
    debounced.priceTableId,
    debounced.tdeEnabled,
    debounced.tearEnabled,
    debouncedKmBand,
    priceTableRow,
    icmsRate,
    taxRegimeSimples,
  ]);

  // Passo 2: calcular o total das taxas condicionais usando o baseFreight intermediário
  const computedConditionalFees = useMemo(() => {
    const baseFreight = baseCalculationResult.components.baseFreight;
    const cargoValue = debounced.cargoValue || 0;
    const selectedIds = additionalFeesSelection.conditionalFees;

    if (!conditionalFeesData || selectedIds.length === 0) {
      return {
        ids: [] as string[],
        total: additionalFeesSelection.waitingTimeCost,
        breakdown: {} as Record<string, number>,
      };
    }

    const breakdown: Record<string, number> = {};
    let total = 0;
    for (const feeId of selectedIds) {
      const fee = conditionalFeesData.find((f) => f.id === feeId);
      if (!fee) continue;
      let val = 0;
      if (fee.fee_type === 'percentage') {
        if (fee.applies_to === 'freight') val = baseFreight * (fee.fee_value / 100);
        else if (fee.applies_to === 'cargo_value') val = cargoValue * (fee.fee_value / 100);
        else val = (baseFreight + cargoValue) * (fee.fee_value / 100);
      } else if (fee.fee_type === 'fixed') {
        val = fee.fee_value;
      } else if (fee.fee_type === 'per_kg') {
        val = fee.fee_value;
      }
      breakdown[feeId] = val;
      total += val;
    }
    total += additionalFeesSelection.waitingTimeCost;
    return { ids: selectedIds, total, breakdown };
  }, [
    conditionalFeesData,
    additionalFeesSelection,
    baseCalculationResult.components.baseFreight,
    debounced.cargoValue,
  ]);

  // Passo 3: calcular frete final com as taxas condicionais (valores debounced)
  const calculationResult = useMemo(() => {
    return calculateFreight({
      originCity: debounced.origin || '',
      destinationCity: debounced.destination || '',
      weightKg: debouncedEffectiveWeightKg,
      volumeM3: debounced.volume || 0,
      cargoValue: debounced.cargoValue || 0,
      tollValue: debounced.toll || 0,
      aluguelMaquinasValue: debounced.aluguelMaquinas || 0,
      descargaValue: debounced.descarga ?? 0,
      kmDistance: debouncedKmBand,
      priceTableRow: priceTableRow || null,
      priceTableId: debounced.priceTableId || undefined,
      icmsRatePercent: icmsRate,
      tdeEnabled: debounced.tdeEnabled || false,
      tearEnabled: debounced.tearEnabled || false,
      pricingParams: { taxRegimeSimples },
      extras: {
        conditionalFees: computedConditionalFees,
        waitingTimeCost: additionalFeesSelection.waitingTimeCost,
        waitingTimeHours: additionalFeesSelection.waitingTimeHours,
        waitingTimeEnabled: additionalFeesSelection.waitingTimeEnabled,
      },
    });
  }, [
    debounced.origin,
    debounced.destination,
    debouncedEffectiveWeightKg,
    debounced.volume,
    debounced.cargoValue,
    debounced.toll,
    debounced.aluguelMaquinas,
    debounced.descarga,
    debounced.kmDistance,
    debounced.priceTableId,
    debounced.tdeEnabled,
    debounced.tearEnabled,
    debouncedKmBand,
    priceTableRow,
    icmsRate,
    taxRegimeSimples,
    computedConditionalFees,
    additionalFeesSelection.waitingTimeCost,
    additionalFeesSelection.waitingTimeHours,
    additionalFeesSelection.waitingTimeEnabled,
  ]);

  useEffect(() => {
    // Reset user edit flags when form opens/closes
    userEditedOrigin.current = false;
    userEditedDestination.current = false;

    if (quote) {
      // Restaurar seleção de taxas condicionais do breakdown salvo
      const bd = quote.pricing_breakdown as unknown as StoredPricingBreakdown | null;
      if (bd?.meta) {
        setAdditionalFeesSelection({
          conditionalFees: bd.meta.selectedConditionalFeeIds ?? [],
          waitingTimeEnabled: bd.meta.waitingTimeEnabled ?? false,
          waitingTimeHours: bd.meta.waitingTimeHours ?? 0,
          waitingTimeCost: bd.components?.waitingTimeCost ?? 0,
        });
        setTollPlazas(bd.meta.tollPlazas ?? []);
        const meta = bd.meta as {
          unloadingCost?: UnloadingCostItem[];
          equipmentRental?: EquipmentRentalItem[];
        };
        setUnloadingCostItems(meta.unloadingCost ?? []);
        setEquipmentRentalItems(meta.equipmentRental ?? []);
      } else {
        setAdditionalFeesSelection(defaultAdditionalFeesSelection);
        setTollPlazas([]);
        setUnloadingCostItems([]);
        setEquipmentRentalItems([]);
      }

      const quoteWeightKg = Number(quote.weight) || 0;
      const weightInUnit = kgToUnit(quoteWeightKg, weightUnit);
      form.reset({
        client_id: quote.client_id || '',
        client_name: quote.client_name,
        client_email: quote.client_email || '',
        shipper_id: quote.shipper_id || '',
        shipper_name: quote.shipper_name || '',
        shipper_email: quote.shipper_email || '',
        freight_type: (quote.freight_type as 'CIF' | 'FOB') || 'FOB',
        freight_modality: (quote.freight_modality as 'lotacao' | 'fracionado') || undefined,
        origin_cep: quote.origin_cep || '',
        destination_cep: quote.destination_cep || '',
        origin: quote.origin,
        destination: quote.destination,
        cargo_type: quote.cargo_type || '',
        weight: Number.isFinite(weightInUnit) ? weightInUnit : 0,
        volume: Number(quote.volume) || 0,
        price_table_id: quote.price_table_id || '',
        vehicle_type_id: quote.vehicle_type_id || '',
        payment_term_id: quote.payment_term_id || '',
        km_distance: quote.km_distance ? Number(quote.km_distance) : undefined,
        cargo_value: Number(quote.cargo_value) || 0,
        toll: Number(quote.toll_value) || 0,
        aluguel_maquinas: Number(bd?.components?.aluguelMaquinas ?? 0),
        descarga:
          (quote.pricing_breakdown as { profitability?: { custosDescarga?: number } } | null)
            ?.profitability?.custosDescarga ?? 0,
        tde_enabled: (bd?.components?.tde ?? 0) > 0,
        tear_enabled: (bd?.components?.tear ?? 0) > 0,
        notes: quote.notes || '',
        advance_due_date: (quote as { advance_due_date?: string | null })?.advance_due_date || '',
        balance_due_date: (quote as { balance_due_date?: string | null })?.balance_due_date || '',
      });
    } else {
      setAdditionalFeesSelection(defaultAdditionalFeesSelection);
      setTollPlazas([]);
      setUnloadingCostItems([]);
      setEquipmentRentalItems([]);
      form.reset({
        client_id: '',
        client_name: '',
        client_email: '',
        shipper_id: '',
        shipper_name: '',
        shipper_email: '',
        freight_type: 'FOB',
        freight_modality: undefined,
        origin_cep: '',
        destination_cep: '',
        origin: '',
        destination: '',
        cargo_type: '',
        weight: 0,
        volume: 0,
        price_table_id: '',
        vehicle_type_id: '',
        payment_term_id: '',
        km_distance: undefined,
        cargo_value: 0,
        toll: 0,
        aluguel_maquinas: 0,
        descarga: 0,
        tde_enabled: false,
        tear_enabled: false,
        notes: '',
        advance_due_date: '',
        balance_due_date: '',
      });
    }
  }, [quote, form, weightUnit, open]);

  const handleClientSelect = (clientId: string) => {
    const selectedClient = clients?.find((c) => c.id === clientId);
    if (selectedClient) {
      form.setValue('client_id', clientId);
      form.setValue('client_name', selectedClient.name);
      form.setValue('client_email', selectedClient.email || '');

      // CEP destino vem do cadastro do Cliente
      if (selectedClient.zip_code) {
        form.setValue('destination_cep', sanitizeCep(selectedClient.zip_code), {
          shouldDirty: true,
        });
        // Atualiza destino (Cidade - UF) via lookup de CEP, respeitando edição manual
        void handleDestinationCepBlur();
      }
    }
  };

  const handleShipperSelect = (shipperId: string) => {
    const selectedShipper = shippers?.find((s) => s.id === shipperId);
    if (selectedShipper) {
      form.setValue('shipper_id', shipperId);
      form.setValue('shipper_name', selectedShipper.name);
      form.setValue('shipper_email', selectedShipper.email || '');

      // CEP origem vem do cadastro do Embarcador
      if (selectedShipper.zip_code) {
        form.setValue('origin_cep', sanitizeCep(selectedShipper.zip_code), { shouldDirty: true });
        // Atualiza origem (Cidade - UF) via lookup de CEP, respeitando edição manual
        void handleOriginCepBlur();
      }
    }
  };

  // CEP Lookup handlers
  const handleOriginCepBlur = async () => {
    const cep = sanitizeCep(form.getValues('origin_cep') || '');
    if (cep.length !== 8) return;

    setIsLoadingOriginCep(true);
    try {
      const data = await invokeEdgeFunction<{
        success: boolean;
        data?: { formatted: string };
        error?: string;
      }>('lookup-cep', { cep });

      if (!data?.success) {
        toast.error('CEP de origem não encontrado');
        return;
      }

      // SafeSet: only update if user hasn't manually edited
      if (!userEditedOrigin.current && data.data?.formatted) {
        form.setValue('origin', data.data.formatted);
      }
    } catch {
      toast.error('Erro ao buscar CEP de origem');
    } finally {
      setIsLoadingOriginCep(false);
    }
  };

  const handleDestinationCepBlur = async () => {
    const cep = sanitizeCep(form.getValues('destination_cep') || '');
    if (cep.length !== 8) return;

    setIsLoadingDestinationCep(true);
    try {
      const data = await invokeEdgeFunction<{
        success: boolean;
        data?: { formatted: string };
        error?: string;
      }>('lookup-cep', { cep });

      if (!data?.success) {
        toast.error('CEP de destino não encontrado');
        return;
      }

      // SafeSet: only update if user hasn't manually edited
      if (!userEditedDestination.current && data.data?.formatted) {
        form.setValue('destination', data.data.formatted);
      }
    } catch {
      toast.error('Erro ao buscar CEP de destino');
    } finally {
      setIsLoadingDestinationCep(false);
    }
  };

  const handleCalculateKm = async () => {
    const originCep = sanitizeCep(form.getValues('origin_cep') || '');
    const destinationCep = sanitizeCep(form.getValues('destination_cep') || '');

    if (originCep.length !== 8 || destinationCep.length !== 8) {
      toast.error('Preencha os CEPs de origem e destino para calcular a distância');
      return;
    }

    setIsCalculatingKm(true);
    try {
      const data = await invokeEdgeFunction<{
        success: boolean;
        data?: { km_distance: number; toll?: number; toll_plazas?: TollPlaza[] };
        error?: string;
      }>('calculate-distance-webrouter', {
        origin_cep: originCep,
        destination_cep: destinationCep,
        axes_count: selectedVehicle?.axes_count ?? undefined,
      });

      if (!data?.success) {
        const errMsg = data?.error || 'Erro ao calcular distância';
        const isFetchError = /failed to send|fetch error|network/i.test(String(errMsg));
        toast.error(
          isFetchError
            ? 'Falha de conexão com o servidor. Verifique sua internet e tente novamente.'
            : errMsg
        );
        return;
      }

      const km = Number(data.data?.km_distance);
      if (!Number.isFinite(km) || km <= 0) {
        toast.error('Distância inválida retornada pela API');
        return;
      }

      form.setValue('km_distance', km, { shouldDirty: true, shouldValidate: true });

      const toll = Number(data.data?.toll) || 0;
      if (toll > 0) {
        form.setValue('toll', toll, { shouldDirty: true, shouldValidate: true });
      }

      // Store toll plazas for persistence in breakdown
      const plazas: TollPlaza[] = Array.isArray(data.data?.toll_plazas)
        ? data.data.toll_plazas
        : [];
      setTollPlazas(plazas);

      const plazaCount = plazas.length;
      if (toll > 0) {
        toast.success(
          `Distância: ${km.toLocaleString('pt-BR')} km | Pedágio: R$ ${toll.toFixed(2)} (${plazaCount} praças)`
        );
      } else {
        toast.success(`Distância calculada: ${km.toLocaleString('pt-BR')} km`);
      }
    } catch (e) {
      const msg = (e as Error)?.message || '';
      const isFetchError = /failed to send|fetch error|network/i.test(msg);
      toast.error(
        isFetchError
          ? 'Falha de conexão com o servidor. Verifique sua internet e tente novamente.'
          : 'Erro ao calcular distância'
      );
    } finally {
      setIsCalculatingKm(false);
    }
  };

  const handleDelete = async () => {
    if (!quote) return;

    try {
      await deleteQuoteMutation.mutateAsync(quote.id);
      toast.success('Cotação excluída com sucesso');
      onClose();
    } catch (error) {
      toast.error('Erro ao excluir cotação');
    }
  };

  const onSubmit = async (data: QuoteFormData) => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    // Block if OUT_OF_RANGE
    if (calculationResult.status === 'OUT_OF_RANGE') {
      toast.error(calculationResult.error || 'Distância fora da faixa de quilometragem');
      return;
    }

    // Block if MISSING_DATA (tabela sem faixas ou não selecionada)
    if (calculationResult.status === 'MISSING_DATA') {
      toast.error(
        calculationResult.error ||
          'Selecione a tabela de preços e verifique se ela possui faixas de km cadastradas'
      );
      return;
    }

    // Block se price_table_rows ainda carregando
    if (isLoadingPriceRow) {
      toast.error('Aguardando carregamento da tabela de preços...');
      return;
    }

    try {
      // Build pricing breakdown for storage
      let pricingBreakdown = buildStoredBreakdown(calculationResult, {
        originCity: data.origin,
        destinationCity: data.destination,
        weightKg: effectiveWeightKg,
        volumeM3: data.volume || 0,
        cargoValue: data.cargo_value || 0,
        tollValue: data.toll || 0,
        aluguelMaquinasValue: data.aluguel_maquinas || 0,
        kmDistance: data.km_distance || 0,
        priceTableRow: priceTableRow || null,
        icmsRatePercent: icmsRate,
        tdeEnabled: data.tde_enabled || false,
        tearEnabled: data.tear_enabled || false,
        extras: {
          conditionalFees: computedConditionalFees,
          waitingTimeCost: additionalFeesSelection.waitingTimeCost,
          waitingTimeHours: additionalFeesSelection.waitingTimeHours,
          waitingTimeEnabled: additionalFeesSelection.waitingTimeEnabled,
          unloadingCostItems: unloadingCostItems.length > 0 ? unloadingCostItems : undefined,
          equipmentRentalItems: equipmentRentalItems.length > 0 ? equipmentRentalItems : undefined,
        },
      });

      // Enriquecer breakdown com Piso ANTT (carreteiro), quando houver dados suficientes
      if (anttRate && axesCountForAntt && data.km_distance && Number(data.km_distance) > 0) {
        const anttCalcForSave = calculateAnttMinimum({
          kmDistance: Number(data.km_distance),
          ccd: Number(anttRate.ccd),
          cc: Number(anttRate.cc),
        });

        pricingBreakdown = {
          ...pricingBreakdown,
          meta: {
            ...pricingBreakdown.meta,
            antt: {
              operationTable: anttRate.operation_table,
              cargoType: anttRate.cargo_type,
              axesCount: axesCountForAntt,
              kmDistance: Number(data.km_distance),
              ccd: Number(anttRate.ccd),
              cc: Number(anttRate.cc),
              ida: anttCalcForSave.ida,
              retornoVazio: 0,
              total: anttCalcForSave.total,
              calculatedAt: new Date().toISOString(),
            },
          },
        };
      }

      // Persist toll plazas from WebRouter in breakdown
      if (tollPlazas.length > 0) {
        pricingBreakdown = {
          ...pricingBreakdown,
          meta: {
            ...pricingBreakdown.meta,
            tollPlazas,
          },
        };
      }

      const quoteData = {
        client_id: data.client_id || null,
        client_name: data.client_name,
        client_email: data.client_email || null,
        shipper_id: data.shipper_id || null,
        shipper_name: data.shipper_name || null,
        shipper_email: data.shipper_email || null,
        freight_type: data.freight_type,
        freight_modality: data.freight_modality || null,
        origin_cep: sanitizeCep(data.origin_cep || '') || null,
        destination_cep: sanitizeCep(data.destination_cep || '') || null,
        origin: data.origin,
        destination: data.destination,
        cargo_type: data.cargo_type || null,
        weight:
          effectiveWeightKg != null && Number.isFinite(effectiveWeightKg)
            ? Math.min(effectiveWeightKg, 99_999_999.99)
            : null,
        volume:
          data.volume != null && Number.isFinite(data.volume)
            ? Math.min(Number(data.volume), 99_999_999.99)
            : null,
        cubage_weight:
          calculationResult.meta.cubageWeightKg != null &&
          Number.isFinite(calculationResult.meta.cubageWeightKg)
            ? calculationResult.meta.cubageWeightKg
            : null,
        billable_weight:
          calculationResult.meta.billableWeightKg != null &&
          Number.isFinite(calculationResult.meta.billableWeightKg)
            ? calculationResult.meta.billableWeightKg
            : null,
        price_table_id: data.price_table_id || null,
        vehicle_type_id: data.vehicle_type_id || null,
        payment_term_id: data.payment_term_id || null,
        km_distance:
          data.km_distance != null && Number.isFinite(Number(data.km_distance))
            ? Math.round(Number(data.km_distance))
            : null,
        toll_value: data.toll || null,
        cargo_value: data.cargo_value || null,
        value: calculationResult.totals.totalCliente,
        pricing_breakdown:
          pricingBreakdown as unknown as Database['public']['Tables']['quotes']['Row']['pricing_breakdown'],
        notes: data.notes || null,
        advance_due_date: data.advance_due_date?.trim() || null,
        balance_due_date: data.balance_due_date?.trim() || null,
      };

      if (isEditing && quote) {
        await updateQuoteMutation.mutateAsync({
          id: quote.id,
          updates: quoteData,
        });
        toast.success('Cotação atualizada com sucesso');
      } else {
        await createQuoteMutation.mutateAsync({
          ...quoteData,
          created_by: user.id,
        });
        toast.success('Cotação criada com sucesso');
      }
      onClose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[QuoteForm] Erro ao salvar cotação:', error);
      toast.error(isEditing ? 'Erro ao atualizar cotação' : 'Erro ao criar cotação', {
        description: msg,
      });
    }
  };

  const isLoading =
    createQuoteMutation.isPending || updateQuoteMutation.isPending || deleteQuoteMutation.isPending;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const routeUfLabel = formatRouteUf(watchedOrigin || '', watchedDestination || '');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{isEditing ? 'Editar Cotação' : 'Nova Cotação'}</DialogTitle>
            {routeUfLabel && (
              <Badge variant="outline" className="text-xs">
                {routeUfLabel}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            {/* OUT_OF_RANGE Alert */}
            {calculationResult.status === 'OUT_OF_RANGE' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="space-y-1">
                  <span className="block">
                    {priceRowError?.message ||
                      calculationResult.error ||
                      'Distância fora da faixa de quilometragem da tabela selecionada'}
                  </span>
                  {priceTableRows && priceTableRows.length > 0 && (
                    <span className="block text-sm mt-2 opacity-90">
                      Faixas disponíveis na tabela:{' '}
                      {priceTableRows.map((r) => `${r.km_from}-${r.km_to} km`).join(', ')}. Adicione
                      uma faixa que inclua {kmRounded} km ou selecione outra tabela.
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* MISSING_DATA Alert — tabela sem faixas ou não selecionada */}
            {calculationResult.status === 'MISSING_DATA' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {calculationResult.error ||
                    'Selecione a tabela de preços e verifique se ela possui faixas de km cadastradas'}
                </AlertDescription>
              </Alert>
            )}

            {/* Margin Alert */}
            {calculationResult.meta.marginStatus === 'BELOW_TARGET' && (
              <Alert className="bg-warning/10 border-warning">
                <AlertTriangle className="h-4 w-4 text-warning-foreground" />
                <AlertDescription className="text-warning-foreground">
                  Margem de {calculationResult.profitability.margemPercent.toFixed(1)}% abaixo da
                  meta de 15%
                </AlertDescription>
              </Alert>
            )}

            {USE_WIZARD ? (
              <QuoteFormWizard
                form={form}
                onSubmit={onSubmit}
                onClose={onClose}
                onDelete={isEditing ? handleDelete : undefined}
                isEditing={isEditing}
                isLoading={isLoading}
                clients={clients ?? []}
                shippers={shippers ?? []}
                onClientSelect={handleClientSelect}
                onShipperSelect={handleShipperSelect}
                onOriginCepBlur={handleOriginCepBlur}
                onDestinationCepBlur={handleDestinationCepBlur}
                onCalculateKm={handleCalculateKm}
                onOriginManualEdit={() => {
                  userEditedOrigin.current = true;
                }}
                onDestinationManualEdit={() => {
                  userEditedDestination.current = true;
                }}
                isLoadingOriginCep={isLoadingOriginCep}
                isLoadingDestinationCep={isLoadingDestinationCep}
                isCalculatingKm={isCalculatingKm}
                priceTablesFiltered={priceTablesFiltered}
                vehicleTypes={vehicleTypes ?? []}
                paymentTerms={paymentTerms ?? []}
                weightUnit={weightUnit}
                setWeightUnit={setWeightUnit}
                isCalculationStale={isCalculationStale}
                formatCurrency={formatCurrency}
                additionalFeesSelection={additionalFeesSelection}
                setAdditionalFeesSelection={setAdditionalFeesSelection}
                equipmentRentalItems={equipmentRentalItems}
                onEquipmentRentalChange={(total, items) => {
                  form.setValue('aluguel_maquinas', total);
                  setEquipmentRentalItems(items);
                }}
                unloadingCostItems={unloadingCostItems}
                onUnloadingCostChange={(total, items) => {
                  form.setValue('descarga', total);
                  setUnloadingCostItems(items);
                }}
                calculationResult={calculationResult}
                vehicleTypeName={
                  vehicleTypes?.find((v) => v.id === form.watch('vehicle_type_id'))?.name ?? '—'
                }
                clientName={
                  form.watch('client_name') ||
                  clients?.find((c) => c.id === form.watch('client_id'))?.name ||
                  '—'
                }
                shipperName={
                  form.watch('shipper_name') ||
                  shippers?.find((s) => s.id === form.watch('shipper_id'))?.name ||
                  '—'
                }
              />
            ) : (
              <>
                {/* Cliente Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground">Dados do Cliente</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="client_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cliente Existente</FormLabel>
                          <Select
                            onValueChange={(value) => handleClientSelect(value)}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecionar cliente..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clients?.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="client_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="cliente@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="client_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Cliente *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome ou razão social" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Embarcador Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground">Embarcador</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="shipper_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Embarcador Existente</FormLabel>
                          <Select
                            onValueChange={(value) => handleShipperSelect(value)}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecionar embarcador..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {shippers?.map((shipper) => (
                                <SelectItem key={shipper.id} value={shipper.id}>
                                  {shipper.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="shipper_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail Embarcador</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="embarcador@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="shipper_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Embarcador</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome ou razão social" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="freight_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Frete *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecionar..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="FOB">
                                FOB (Frete por conta do destinatário)
                              </SelectItem>
                              <SelectItem value="CIF">
                                CIF (Frete por conta do remetente)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Rota e Carga Section */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground">Rota e Carga</h3>

                  {/* CEP Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="origin_cep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP Origem</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <MaskedInput
                                mask="cep"
                                placeholder="00000-000"
                                value={field.value || ''}
                                onValueChange={(rawValue) => field.onChange(String(rawValue ?? ''))}
                                onBlur={() => {
                                  field.onBlur();
                                  handleOriginCepBlur();
                                }}
                                disabled={isLoadingOriginCep}
                              />
                              {isLoadingOriginCep && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="destination_cep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP Destino</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <MaskedInput
                                mask="cep"
                                placeholder="00000-000"
                                value={field.value || ''}
                                onValueChange={(rawValue) => field.onChange(String(rawValue ?? ''))}
                                onBlur={() => {
                                  field.onBlur();
                                  handleDestinationCepBlur();
                                }}
                                disabled={isLoadingDestinationCep}
                              />
                              {isLoadingDestinationCep && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCalculateKm}
                      disabled={isCalculatingKm || isLoadingOriginCep || isLoadingDestinationCep}
                    >
                      {isCalculatingKm && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Calcular KM
                    </Button>
                  </div>

                  {/* City/State Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="origin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Origem *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Cidade - UF"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                userEditedOrigin.current = true;
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="destination"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Destino *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Cidade - UF"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                userEditedDestination.current = true;
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="cargo_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Carga</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Eletrônicos" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="weight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Peso ({weightUnit})</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0"
                                min={0}
                                max={weightUnit === 'ton' ? 99_999 : 99_999_999}
                                step={weightUnit === 'ton' ? 0.001 : 1}
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <ToggleGroup
                              type="single"
                              value={weightUnit}
                              onValueChange={(v) => {
                                if (!v) return;
                                const nextUnit = v as 'kg' | 'ton';
                                const currentUnit = weightUnit;
                                const currentValue = Number(form.getValues('weight') || 0);
                                const kg = unitToKg(currentValue, currentUnit);
                                const nextValue = kgToUnit(kg, nextUnit);
                                setWeightUnit(nextUnit);
                                form.setValue(
                                  'weight',
                                  Number.isFinite(nextValue) ? nextValue : 0,
                                  {
                                    shouldDirty: true,
                                  }
                                );
                              }}
                              size="sm"
                              className="shrink-0"
                            >
                              <ToggleGroupItem value="kg" className="text-xs px-2">
                                kg
                              </ToggleGroupItem>
                              <ToggleGroupItem value="ton" className="text-xs px-2">
                                ton
                              </ToggleGroupItem>
                            </ToggleGroup>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="volume"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Volume (m³)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Peso Faturável Info */}
                  {(watchedWeight > 0 || watchedVolume > 0) && (
                    <div className="p-3 rounded-lg bg-muted/50 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Peso Cubado (x 300 kg/m³)</span>
                        <span>
                          {calculationResult.meta.cubageWeightKg.toLocaleString('pt-BR')} kg
                        </span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Peso Faturável</span>
                        <span>
                          {calculationResult.meta.billableWeightKg.toLocaleString('pt-BR')} kg
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Precificação Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Precificação</h3>
                  </div>

                  {/* Pricing Selectors Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="freight_modality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Modalidade de Frete</FormLabel>
                          <Select
                            onValueChange={(v) => {
                              field.onChange(v);
                              // Limpar tabela ao mudar modalidade (tabela pode ser de outra modalidade)
                              form.setValue('price_table_id', '');
                            }}
                            value={field.value || ''}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecionar modalidade..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="lotacao">Lotação</SelectItem>
                              <SelectItem value="fracionado">Fracionado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="price_table_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tabela de Preços</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecionar tabela..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {priceTablesFiltered.map((table) => (
                                <SelectItem key={table.id} value={table.id}>
                                  {table.name} (
                                  {table.modality === 'lotacao' ? 'Lotação' : 'Fracionado'})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="vehicle_type_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Veículo</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecionar veículo..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {vehicleTypes?.map((vehicle) => (
                                <SelectItem key={vehicle.id} value={vehicle.id}>
                                  {vehicle.name} ({vehicle.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payment_term_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prazo de Pagamento</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecionar prazo..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {paymentTerms?.map((term) => (
                                <SelectItem key={term.id} value={term.id}>
                                  {term.name}{' '}
                                  {term.adjustment_percent !== 0 &&
                                    `(${term.adjustment_percent > 0 ? '+' : ''}${term.adjustment_percent}%)`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Condição Financeira: datas manuais para adiantamento e saldo */}
                    {selectedPaymentTerm && (
                      <div className="col-span-3 space-y-3 rounded-lg border border-dashed p-3">
                        <h4 className="text-sm font-medium">Condição Financeira</h4>
                        {(() => {
                          const adv = selectedPaymentTerm.advance_percent ?? 0;
                          const days = selectedPaymentTerm.days ?? 0;
                          const total =
                            calculationResult.status === 'OK'
                              ? calculationResult.totals.totalCliente
                              : 0;
                          if (adv > 0) {
                            const advanceValue = (total * adv) / 100;
                            const balanceValue = total - advanceValue;
                            return (
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                  <span className="text-xs text-muted-foreground">
                                    Adiantamento {adv}% = {formatCurrency(advanceValue)}
                                  </span>
                                  <FormField
                                    control={form.control}
                                    name="advance_due_date"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">Data adiantamento</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="date"
                                            value={field.value || ''}
                                            onChange={(e) => field.onChange(e.target.value)}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <span className="text-xs text-muted-foreground">
                                    Saldo {100 - adv}% = {formatCurrency(balanceValue)}
                                  </span>
                                  <FormField
                                    control={form.control}
                                    name="balance_due_date"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">Data saldo</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="date"
                                            value={field.value || ''}
                                            onChange={(e) => field.onChange(e.target.value)}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>
                            );
                          }
                          if (adv === 0 && days === 0) {
                            return (
                              <FormField
                                control={form.control}
                                name="advance_due_date"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">
                                      Data do pagamento (à vista)
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        type="date"
                                        value={field.value || ''}
                                        onChange={(e) => field.onChange(e.target.value)}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            );
                          }
                          // adv === 0 && days > 0: prazo normal (D15, D30, etc.)
                          return (
                            <FormField
                              control={form.control}
                              name="balance_due_date"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Data de vencimento</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      value={field.value || ''}
                                      onChange={(e) => field.onChange(e.target.value)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          );
                        })()}
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="km_distance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Distância (km) *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0"
                              value={field.value ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                field.onChange(val === '' ? undefined : parseFloat(val));
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Km Band Info: faixa derivada do km_distance (WebRouter/manual) + price_table_rows */}
                  {isLoadingPriceRow && kmBand > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Buscando faixa...
                    </Badge>
                  )}
                  {!isLoadingPriceRow && faixaLabel && (
                    <Badge variant="outline" className="text-xs">
                      Faixa: {faixaLabel} km
                    </Badge>
                  )}

                  {/* Mini card R$/KM — Custo ANTT por km */}
                  {anttRsKm !== null && (
                    <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-primary">Custo ANTT/km</span>
                        <span className="text-[10px] text-muted-foreground">
                          (referência carreteiro)
                        </span>
                      </div>
                      <span className="font-bold text-primary text-sm">
                        R$ {anttRsKm.toFixed(2)}/km
                      </span>
                    </div>
                  )}

                  <Separator className="my-2" />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cargo_value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor da Mercadoria</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                R$
                              </span>
                              <MaskedInput
                                mask="currency"
                                placeholder="0,00"
                                className="pl-10"
                                value={String(Math.round((field.value || 0) * 100))}
                                onValueChange={(rawValue) =>
                                  field.onChange(parseInt(rawValue || '0', 10) / 100)
                                }
                                onBlur={field.onBlur}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="toll"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pedágio</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                R$
                              </span>
                              <MaskedInput
                                mask="currency"
                                placeholder="0,00"
                                className="pl-10"
                                value={String(Math.round((field.value || 0) * 100))}
                                onValueChange={(rawValue) =>
                                  field.onChange(parseInt(rawValue || '0', 10) / 100)
                                }
                                onBlur={field.onBlur}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="col-span-2">
                      <EquipmentRentalSection
                        value={watchedAluguelMaquinas ?? 0}
                        onChange={(total, items) => {
                          form.setValue('aluguel_maquinas', total);
                          setEquipmentRentalItems(items);
                        }}
                        initialItems={equipmentRentalItems}
                      />
                    </div>
                    <div className="col-span-2">
                      <UnloadingCostSection
                        value={watchedDescarga ?? 0}
                        onChange={(total, items) => {
                          form.setValue('descarga', total);
                          setUnloadingCostItems(items);
                        }}
                        initialItems={unloadingCostItems}
                      />
                    </div>
                  </div>

                  {/* NTC Taxes */}
                  <div className="flex gap-6">
                    <FormField
                      control={form.control}
                      name="tde_enabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0 text-sm font-normal">TDE (20%)</FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="tear_enabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0 text-sm font-normal">TEAR (20%)</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Calculated Values */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <Tabs defaultValue="memoria" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 h-8">
                        <TabsTrigger value="memoria" className="text-xs">
                          Memória
                        </TabsTrigger>
                        <TabsTrigger value="rentabilidade" className="text-xs">
                          Rentabilidade
                        </TabsTrigger>
                      </TabsList>

                      {/* ── Aba Memória ── */}
                      <TabsContent value="memoria" className="mt-2 space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frete Base</span>
                          <span className="text-foreground">
                            {formatCurrency(calculationResult.components.baseFreight)}
                          </span>
                        </div>
                        {calculationResult.components.toll > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pedágio</span>
                            <span className="text-foreground">
                              {formatCurrency(calculationResult.components.toll)}
                            </span>
                          </div>
                        )}
                        {calculationResult.components.aluguelMaquinas > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Aluguel de Máquinas</span>
                            <span className="text-foreground">
                              {formatCurrency(calculationResult.components.aluguelMaquinas)}
                            </span>
                          </div>
                        )}
                        {calculationResult.components.gris > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              GRIS ({calculationResult.rates.grisPercent.toFixed(2)}%)
                            </span>
                            <span className="text-foreground">
                              {formatCurrency(calculationResult.components.gris)}
                            </span>
                          </div>
                        )}
                        {calculationResult.components.tso > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              TSO ({calculationResult.rates.tsoPercent.toFixed(2)}%)
                            </span>
                            <span className="text-foreground">
                              {formatCurrency(calculationResult.components.tso)}
                            </span>
                          </div>
                        )}
                        {calculationResult.components.rctrc > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              RCTR-C ({calculationResult.rates.costValuePercent.toFixed(2)}%)
                            </span>
                            <span className="text-foreground">
                              {formatCurrency(calculationResult.components.rctrc)}
                            </span>
                          </div>
                        )}
                        {calculationResult.components.tde > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">TDE (NTC)</span>
                            <span className="text-foreground">
                              {formatCurrency(calculationResult.components.tde)}
                            </span>
                          </div>
                        )}
                        {calculationResult.components.tear > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">TEAR (NTC)</span>
                            <span className="text-foreground">
                              {formatCurrency(calculationResult.components.tear)}
                            </span>
                          </div>
                        )}
                        {/* Taxas Condicionais */}
                        {computedConditionalFees.ids.length > 0 &&
                          computedConditionalFees.ids.map((feeId) => {
                            const fee = conditionalFeesData?.find((f) => f.id === feeId);
                            const val = computedConditionalFees.breakdown[feeId] ?? 0;
                            if (val === 0) return null;
                            return (
                              <div key={feeId} className="flex justify-between">
                                <span className="text-muted-foreground">
                                  {fee ? fee.name : feeId}
                                  {fee && (
                                    <Badge variant="outline" className="ml-1 text-[10px] py-0">
                                      {fee.code}
                                    </Badge>
                                  )}
                                </span>
                                <span className="text-foreground">{formatCurrency(val)}</span>
                              </div>
                            );
                          })}
                        {additionalFeesSelection.waitingTimeCost > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Estadia / Hora Parada</span>
                            <span className="text-foreground">
                              {formatCurrency(additionalFeesSelection.waitingTimeCost)}
                            </span>
                          </div>
                        )}

                        <Separator className="my-1" />

                        <div className="flex justify-between font-medium">
                          <span className="text-foreground">Receita Bruta</span>
                          <span className="text-foreground">
                            {formatCurrency(calculationResult.totals.receitaBruta)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            DAS ({calculationResult.rates.dasPercent.toFixed(2)}%)
                          </span>
                          <span className="text-foreground">
                            {formatCurrency(calculationResult.totals.das)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            ICMS (
                            {taxRegimeSimples === 1
                              ? '0.00'
                              : calculationResult.rates.icmsPercent.toFixed(2)}
                            %)
                          </span>
                          <span className="text-foreground">
                            {formatCurrency(
                              taxRegimeSimples === 1 ? 0 : calculationResult.totals.icms
                            )}
                          </span>
                        </div>

                        <Separator className="my-1" />

                        <div className="flex justify-between font-semibold">
                          <span className="text-foreground">Total Cliente</span>
                          <span className="text-primary text-base">
                            {formatCurrency(
                              taxRegimeSimples === 1
                                ? calculationResult.totals.receitaBruta +
                                    calculationResult.totals.das
                                : calculationResult.totals.totalCliente
                            )}
                          </span>
                        </div>
                      </TabsContent>

                      {/* ── Aba Rentabilidade ── */}
                      <TabsContent value="rentabilidade" className="mt-2">
                        <div
                          className={cn(
                            'rounded-lg p-3 border space-y-2 text-sm',
                            calculationResult.meta.marginStatus === 'BELOW_TARGET'
                              ? 'bg-destructive/5 border-destructive/20'
                              : 'bg-success/5 border-success/20'
                          )}
                        >
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Margem Bruta</span>
                            <span className="text-foreground">
                              {formatCurrency(calculationResult.profitability.margemBruta)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Overhead</span>
                            <span className="text-foreground">
                              {formatCurrency(calculationResult.profitability.overhead)}
                            </span>
                          </div>
                          <div className="flex justify-between font-medium items-center gap-2">
                            <span className="text-foreground">Resultado Líquido</span>
                            <Badge
                              variant={
                                calculationResult.profitability.resultadoLiquido >= 0
                                  ? 'default'
                                  : 'destructive'
                              }
                              className={
                                calculationResult.profitability.resultadoLiquido >= 0
                                  ? 'bg-success text-success-foreground'
                                  : ''
                              }
                            >
                              {formatCurrency(calculationResult.profitability.resultadoLiquido)}
                            </Badge>
                          </div>
                          <div className="flex justify-between font-semibold items-center gap-2">
                            <span className="text-foreground">Margem %</span>
                            <Badge
                              variant={
                                calculationResult.meta.marginStatus === 'BELOW_TARGET'
                                  ? 'destructive'
                                  : 'default'
                              }
                              className={
                                calculationResult.meta.marginStatus !== 'BELOW_TARGET'
                                  ? 'bg-success text-success-foreground'
                                  : ''
                              }
                            >
                              {calculationResult.profitability.margemPercent.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>

                <Separator />

                {/* Taxas Adicionais */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground">Taxas Adicionais</h3>
                  <AdditionalFeesSection
                    selection={additionalFeesSelection}
                    onChange={setAdditionalFeesSelection}
                    baseFreight={calculationResult.components.baseFreight}
                    cargoValue={watchedCargoValue ?? 0}
                    vehicleTypeId={watchedVehicleTypeId || undefined}
                  />
                </div>

                <Separator />

                {/* Observações */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Condições especiais, requisitos do cliente..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-between pt-4">
                  {/* Delete Button - only when editing */}
                  {isEditing && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir cotação?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir esta cotação? Esta ação não pode ser
                            desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  <div className="flex gap-3 ml-auto">
                    <Button type="button" variant="outline" onClick={onClose}>
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        isLoading ||
                        isLoadingPriceRow ||
                        calculationResult.status === 'OUT_OF_RANGE' ||
                        calculationResult.status === 'MISSING_DATA'
                      }
                    >
                      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {isEditing ? 'Salvar' : 'Criar Cotação'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
