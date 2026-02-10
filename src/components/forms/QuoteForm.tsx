import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Calculator, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { MaskedInput } from '@/components/ui/masked-input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCreateQuote, useUpdateQuote, useDeleteQuote } from '@/hooks/useQuotes';
import { useClients } from '@/hooks/useClients';
import { useShippers } from '@/hooks/useShippers';
import { usePriceTables } from '@/hooks/usePriceTables';
import { useVehicleTypes, usePaymentTerms } from '@/hooks/usePricingRules';
import { usePriceTableRowByKmRange } from '@/hooks/usePriceTableRows';
import { useIcmsRateForPricing } from '@/hooks/useIcmsRates';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { 
  calculateFreight, 
  buildStoredBreakdown, 
  formatRouteUf,
  extractUf
} from '@/lib/freightCalculator';

type Quote = Database['public']['Tables']['quotes']['Row'];

const quoteSchema = z.object({
  client_id: z.string().optional(),
  client_name: z.string().min(2, 'Nome do cliente obrigatório'),
  client_email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  shipper_id: z.string().optional(),
  shipper_name: z.string().optional(),
  shipper_email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  freight_type: z.enum(['CIF', 'FOB']).default('FOB'),
  freight_modality: z.enum(['lotacao', 'fracionado']).optional(),
  origin_cep: z.string().optional(),
  destination_cep: z.string().optional(),
  origin: z.string().min(2, 'Origem obrigatória'),
  destination: z.string().min(2, 'Destino obrigatório'),
  cargo_type: z.string().optional(),
  weight: z.number().min(0, 'Peso inválido').optional().default(0),
  volume: z.number().min(0, 'Volume inválido').optional().default(0),
  // Pricing selectors
  price_table_id: z.string().optional(),
  vehicle_type_id: z.string().optional(),
  payment_term_id: z.string().optional(),
  km_distance: z.number().min(0, 'Distância inválida').optional(),
  // Pricing components
  cargo_value: z.number().min(0, 'Valor inválido').optional().default(0),
  toll: z.number().min(0, 'Valor inválido').optional().default(0),
  // NTC flags
  tde_enabled: z.boolean().optional().default(false),
  tear_enabled: z.boolean().optional().default(false),
  notes: z.string().max(500, 'Observações muito longas').optional(),
});

type QuoteFormData = z.infer<typeof quoteSchema>;

interface QuoteFormProps {
  open: boolean;
  onClose: () => void;
  quote?: Quote | null;
}

// Utility: sanitize CEP to 8 digits
const sanitizeCep = (value: string) => value.replace(/\D/g, '').slice(0, 8);

export function QuoteForm({ open, onClose, quote }: QuoteFormProps) {
  const { user } = useAuth();
  const { data: clients } = useClients();
  const { data: shippers } = useShippers();
  const { data: priceTables } = usePriceTables();
  const { data: vehicleTypes } = useVehicleTypes();
  const { data: paymentTerms } = usePaymentTerms();
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
  
  // Weight unit toggle: kg or ton
  const [weightUnit, setWeightUnit] = useState<'kg' | 'ton'>('ton');

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
      tde_enabled: false,
      tear_enabled: false,
      notes: '',
    },
  });

  const watchedPriceTableId = form.watch('price_table_id');
  const watchedKmDistance = form.watch('km_distance');
  const watchedOrigin = form.watch('origin');
  const watchedDestination = form.watch('destination');
  const watchedWeight = form.watch('weight');
  const watchedVolume = form.watch('volume');
  const watchedCargoValue = form.watch('cargo_value');
  const watchedToll = form.watch('toll');
  const watchedTdeEnabled = form.watch('tde_enabled');
  const watchedTearEnabled = form.watch('tear_enabled');

  // Get price table row for the km distance
  const { data: priceTableRow, isLoading: isLoadingPriceRow } = usePriceTableRowByKmRange(
    watchedPriceTableId || '',
    watchedKmDistance || 0
  );

  // Get ICMS rate for origin/destination states
  const originUf = extractUf(watchedOrigin || '');
  const destUf = extractUf(watchedDestination || '');
  const { data: icmsRateData } = useIcmsRateForPricing(originUf || '', destUf || '');
  const icmsRate = icmsRateData?.rate_percent ?? 12;

  // Normalize weight to kg based on selected unit
  const effectiveWeightKg = weightUnit === 'ton' 
    ? (watchedWeight || 0) * 1000 
    : (watchedWeight || 0);

  // Calculate freight using the pure function
  const calculationResult = useMemo(() => {
    return calculateFreight({
      originCity: watchedOrigin || '',
      destinationCity: watchedDestination || '',
      weightKg: effectiveWeightKg,
      volumeM3: watchedVolume || 0,
      cargoValue: watchedCargoValue || 0,
      tollValue: watchedToll || 0,
      kmDistance: watchedKmDistance || 0,
      priceTableRow: priceTableRow || null,
      icmsRatePercent: icmsRate,
      tdeEnabled: watchedTdeEnabled || false,
      tearEnabled: watchedTearEnabled || false,
    });
  }, [
    watchedOrigin,
    watchedDestination,
    watchedWeight, 
    watchedVolume, 
    watchedCargoValue, 
    watchedToll,
    watchedKmDistance, 
    priceTableRow, 
    icmsRate,
    watchedTdeEnabled,
    watchedTearEnabled
  ]);


  useEffect(() => {
    // Reset user edit flags when form opens/closes
    userEditedOrigin.current = false;
    userEditedDestination.current = false;
    
    if (quote) {
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
        weight: Number(quote.weight) || 0,
        volume: Number(quote.volume) || 0,
        price_table_id: quote.price_table_id || '',
        vehicle_type_id: quote.vehicle_type_id || '',
        payment_term_id: quote.payment_term_id || '',
        km_distance: quote.km_distance ? Number(quote.km_distance) : undefined,
        cargo_value: Number(quote.cargo_value) || 0,
        toll: Number(quote.toll_value) || 0,
        tde_enabled: false,
        tear_enabled: false,
        notes: quote.notes || '',
      });
    } else {
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
        tde_enabled: false,
        tear_enabled: false,
        notes: '',
      });
    }
  }, [quote, form]);

  const handleClientSelect = (clientId: string) => {
    const selectedClient = clients?.find(c => c.id === clientId);
    if (selectedClient) {
      form.setValue('client_id', clientId);
      form.setValue('client_name', selectedClient.name);
      form.setValue('client_email', selectedClient.email || '');
    }
  };

  const handleShipperSelect = (shipperId: string) => {
    const selectedShipper = shippers?.find(s => s.id === shipperId);
    if (selectedShipper) {
      form.setValue('shipper_id', shipperId);
      form.setValue('shipper_name', selectedShipper.name);
      form.setValue('shipper_email', selectedShipper.email || '');
    }
  };

  // CEP Lookup handlers
  const handleOriginCepBlur = async () => {
    const cep = sanitizeCep(form.getValues('origin_cep') || '');
    if (cep.length !== 8) return;

    setIsLoadingOriginCep(true);
    try {
      const { data, error } = await supabase.functions.invoke('lookup-cep', {
        body: { cep },
      });

      if (error || !data?.success) {
        toast.error('CEP de origem não encontrado');
        return;
      }

      // SafeSet: only update if user hasn't manually edited
      if (!userEditedOrigin.current) {
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
      const { data, error } = await supabase.functions.invoke('lookup-cep', {
        body: { cep },
      });

      if (error || !data?.success) {
        toast.error('CEP de destino não encontrado');
        return;
      }

      // SafeSet: only update if user hasn't manually edited
      if (!userEditedDestination.current) {
        form.setValue('destination', data.data.formatted);
      }
    } catch {
      toast.error('Erro ao buscar CEP de destino');
    } finally {
      setIsLoadingDestinationCep(false);
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

    try {
      // Build pricing breakdown for storage
      const pricingBreakdown = buildStoredBreakdown(calculationResult, {
        originCity: data.origin,
        destinationCity: data.destination,
        weightKg: data.weight || 0,
        volumeM3: data.volume || 0,
        cargoValue: data.cargo_value || 0,
        tollValue: data.toll || 0,
        kmDistance: data.km_distance || 0,
        priceTableRow: priceTableRow || null,
        icmsRatePercent: icmsRate,
        tdeEnabled: data.tde_enabled || false,
        tearEnabled: data.tear_enabled || false,
      });

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
        weight: data.weight || null,
        volume: data.volume || null,
        cubage_weight: calculationResult.meta.cubageWeightKg || null,
        billable_weight: calculationResult.meta.billableWeightKg || null,
        price_table_id: data.price_table_id || null,
        vehicle_type_id: data.vehicle_type_id || null,
        payment_term_id: data.payment_term_id || null,
        km_distance: data.km_distance || null,
        toll_value: data.toll || null,
        cargo_value: data.cargo_value || null,
        value: calculationResult.totals.totalCliente,
        pricing_breakdown: pricingBreakdown as unknown as Database['public']['Tables']['quotes']['Row']['pricing_breakdown'],
        notes: data.notes || null,
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
      toast.error(isEditing ? 'Erro ao atualizar cotação' : 'Erro ao criar cotação');
    }
  };

  const isLoading = createQuoteMutation.isPending || updateQuoteMutation.isPending || deleteQuoteMutation.isPending;

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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* OUT_OF_RANGE Alert */}
            {calculationResult.status === 'OUT_OF_RANGE' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {calculationResult.error || 'Distância fora da faixa de quilometragem da tabela selecionada'}
                </AlertDescription>
              </Alert>
            )}

            {/* Margin Alert */}
            {calculationResult.meta.marginStatus === 'BELOW_TARGET' && (
              <Alert className="bg-warning/10 border-warning">
                <AlertTriangle className="h-4 w-4 text-warning-foreground" />
                <AlertDescription className="text-warning-foreground">
                  Margem de {calculationResult.profitability.margemPercent.toFixed(1)}% abaixo da meta de 15%
                </AlertDescription>
              </Alert>
            )}

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
                          <SelectItem value="FOB">FOB (Frete por conta do destinatário)</SelectItem>
                          <SelectItem value="CIF">CIF (Frete por conta do remetente)</SelectItem>
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
                            onValueChange={(rawValue) => field.onChange(rawValue)}
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
                            onValueChange={(rawValue) => field.onChange(rawValue)}
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
                      <FormLabel>Peso (kg)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
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
                    <span>{calculationResult.meta.cubageWeightKg.toLocaleString('pt-BR')} kg</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Peso Faturável</span>
                    <span>{calculationResult.meta.billableWeightKg.toLocaleString('pt-BR')} kg</span>
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
                        onValueChange={field.onChange} 
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
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar tabela..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {priceTables?.map((table) => (
                            <SelectItem key={table.id} value={table.id}>
                              {table.name} ({table.modality === 'lotacao' ? 'Lotação' : 'Fracionado'})
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
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ''}
                      >
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
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar prazo..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {paymentTerms?.map((term) => (
                            <SelectItem key={term.id} value={term.id}>
                              {term.name} {term.adjustment_percent !== 0 && `(${term.adjustment_percent > 0 ? '+' : ''}${term.adjustment_percent}%)`}
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

              {/* Km Band Info */}
              {calculationResult.meta.kmBandLabel && calculationResult.status === 'OK' && (
                <Badge variant="outline" className="text-xs">
                  Faixa: {calculationResult.meta.kmBandLabel} km
                </Badge>
              )}

              <Separator className="my-2" />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cargo_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor da Mercadoria (R$)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0,00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
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
                      <FormLabel>Pedágio (R$)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0,00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* NTC Taxes */}
              <div className="flex gap-6">
                <FormField
                  control={form.control}
                  name="tde_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0 text-sm font-normal">
                        TDE (20%)
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tear_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0 text-sm font-normal">
                        TEAR (20%)
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              {/* Calculated Values */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Frete Base</span>
                  <span className="text-foreground">{formatCurrency(calculationResult.components.baseFreight)}</span>
                </div>
                {calculationResult.components.toll > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pedágio</span>
                    <span className="text-foreground">{formatCurrency(calculationResult.components.toll)}</span>
                  </div>
                )}
                {calculationResult.components.gris > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">GRIS ({calculationResult.rates.grisPercent.toFixed(2)}%)</span>
                    <span className="text-foreground">{formatCurrency(calculationResult.components.gris)}</span>
                  </div>
                )}
                {calculationResult.components.tso > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TSO ({calculationResult.rates.tsoPercent.toFixed(2)}%)</span>
                    <span className="text-foreground">{formatCurrency(calculationResult.components.tso)}</span>
                  </div>
                )}
                {calculationResult.components.rctrc > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">RCTR-C ({calculationResult.rates.costValuePercent.toFixed(2)}%)</span>
                    <span className="text-foreground">{formatCurrency(calculationResult.components.rctrc)}</span>
                  </div>
                )}
                {calculationResult.components.tde > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TDE (NTC)</span>
                    <span className="text-foreground">{formatCurrency(calculationResult.components.tde)}</span>
                  </div>
                )}
                {calculationResult.components.tear > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TEAR (NTC)</span>
                    <span className="text-foreground">{formatCurrency(calculationResult.components.tear)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-foreground">Receita Bruta</span>
                  <span className="text-foreground">{formatCurrency(calculationResult.totals.receitaBruta)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">DAS ({calculationResult.rates.dasPercent.toFixed(2)}%)</span>
                  <span className="text-foreground">{formatCurrency(calculationResult.totals.das)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ICMS ({calculationResult.rates.icmsPercent.toFixed(2)}%)</span>
                  <span className="text-foreground">{formatCurrency(calculationResult.totals.icms)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span className="text-foreground">Total Cliente</span>
                  <span className="text-primary text-lg">{formatCurrency(calculationResult.totals.totalCliente)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Resultado Líquido</span>
                  <span className={cn(
                    calculationResult.profitability.resultadoLiquido >= 0 ? 'text-success' : 'text-destructive'
                  )}>
                    {formatCurrency(calculationResult.profitability.resultadoLiquido)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-foreground">Margem</span>
                  <span className={cn(
                    calculationResult.meta.marginStatus === 'BELOW_TARGET' ? 'text-warning-foreground' : 'text-success'
                  )}>
                    {calculationResult.profitability.margemPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
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
                        Tem certeza que deseja excluir esta cotação? Esta ação não pode ser desfeita.
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
                  disabled={isLoading || calculationResult.status === 'OUT_OF_RANGE'}
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isEditing ? 'Salvar' : 'Criar Cotação'}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
