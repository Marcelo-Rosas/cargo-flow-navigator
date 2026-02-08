import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Calculator } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { MaskedInput } from '@/components/ui/masked-input';
import { useCreateQuote, useUpdateQuote } from '@/hooks/useQuotes';
import { useClients } from '@/hooks/useClients';
import { useShippers } from '@/hooks/useShippers';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type Quote = Database['public']['Tables']['quotes']['Row'];

const quoteSchema = z.object({
  client_id: z.string().optional(),
  client_name: z.string().min(2, 'Nome do cliente obrigatório'),
  client_email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  shipper_id: z.string().optional(),
  shipper_name: z.string().optional(),
  shipper_email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  freight_type: z.enum(['CIF', 'FOB']).default('CIF'),
  origin_cep: z.string().optional(),
  destination_cep: z.string().optional(),
  origin: z.string().min(2, 'Origem obrigatória'),
  destination: z.string().min(2, 'Destino obrigatório'),
  cargo_type: z.string().optional(),
  weight: z.number().min(0, 'Peso inválido').optional().default(0),
  volume: z.number().min(0, 'Volume inválido').optional().default(0),
  // Pricing components - all optional with defaults
  base_freight: z.number().min(0, 'Valor inválido').optional().default(0),
  toll: z.number().min(0, 'Valor inválido').optional().default(0),
  gris_percent: z.number().min(0).max(100, 'Percentual inválido').optional().default(0.3),
  ad_valorem_percent: z.number().min(0).max(100, 'Percentual inválido').optional().default(0.1),
  icms_percent: z.number().min(0).max(100, 'Percentual inválido').optional().default(12),
  cargo_value: z.number().min(0, 'Valor inválido').optional().default(0),
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
  const createQuoteMutation = useCreateQuote();
  const updateQuoteMutation = useUpdateQuote();
  const isEditing = !!quote;

  // Track if user manually edited origin/destination
  const userEditedOrigin = useRef(false);
  const userEditedDestination = useRef(false);
  
  // Loading states for CEP lookups
  const [isLoadingOriginCep, setIsLoadingOriginCep] = useState(false);
  const [isLoadingDestinationCep, setIsLoadingDestinationCep] = useState(false);

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      client_id: '',
      client_name: '',
      client_email: '',
      shipper_id: '',
      shipper_name: '',
      shipper_email: '',
      freight_type: 'CIF',
      origin_cep: '',
      destination_cep: '',
      origin: '',
      destination: '',
      cargo_type: '',
      weight: 0,
      volume: 0,
      base_freight: 0,
      toll: 0,
      gris_percent: 0.3,
      ad_valorem_percent: 0.1,
      icms_percent: 12,
      cargo_value: 0,
      notes: '',
    },
  });

  const watchedValues = form.watch(['base_freight', 'toll', 'gris_percent', 'ad_valorem_percent', 'icms_percent', 'cargo_value']);

  const calculatedValue = useMemo(() => {
    const [baseFreight, toll, grisPercent, adValoremPercent, icmsPercent, cargoValue] = watchedValues;
    
    const gris = (cargoValue * (grisPercent / 100));
    const adValorem = (cargoValue * (adValoremPercent / 100));
    const subtotal = baseFreight + toll + gris + adValorem;
    const icms = subtotal * (icmsPercent / 100);
    const total = subtotal + icms;
    
    return {
      gris,
      adValorem,
      subtotal,
      icms,
      total,
    };
  }, [watchedValues]);

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
        freight_type: (quote.freight_type as 'CIF' | 'FOB') || 'CIF',
        origin_cep: quote.origin_cep || '',
        destination_cep: quote.destination_cep || '',
        origin: quote.origin,
        destination: quote.destination,
        cargo_type: quote.cargo_type || '',
        weight: Number(quote.weight) || 0,
        volume: Number(quote.volume) || 0,
        base_freight: Number(quote.value) || 0,
        toll: 0,
        gris_percent: 0.3,
        ad_valorem_percent: 0.1,
        icms_percent: 12,
        cargo_value: Number(quote.cargo_value) || 0,
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
        freight_type: 'CIF',
        origin_cep: '',
        destination_cep: '',
        origin: '',
        destination: '',
        cargo_type: '',
        weight: 0,
        volume: 0,
        base_freight: 0,
        toll: 0,
        gris_percent: 0.3,
        ad_valorem_percent: 0.1,
        icms_percent: 12,
        cargo_value: 0,
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

  const onSubmit = async (data: QuoteFormData) => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    try {
      const quoteData = {
        client_id: data.client_id || null,
        client_name: data.client_name,
        client_email: data.client_email || null,
        shipper_id: data.shipper_id || null,
        shipper_name: data.shipper_name || null,
        shipper_email: data.shipper_email || null,
        freight_type: data.freight_type,
        origin_cep: sanitizeCep(data.origin_cep || '') || null,
        destination_cep: sanitizeCep(data.destination_cep || '') || null,
        origin: data.origin,
        destination: data.destination,
        cargo_type: data.cargo_type || null,
        weight: data.weight || null,
        volume: data.volume || null,
        cargo_value: data.cargo_value || null,
        value: calculatedValue.total,
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

  const isLoading = createQuoteMutation.isPending || updateQuoteMutation.isPending;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Cotação' : 'Nova Cotação'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                          <SelectItem value="CIF">CIF (Frete por conta do remetente)</SelectItem>
                          <SelectItem value="FOB">FOB (Frete por conta do destinatário)</SelectItem>
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
            </div>

            <Separator />

            {/* Precificação Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Precificação</h3>
              </div>
              
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
                  name="base_freight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frete Base (R$) *</FormLabel>
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

              <div className="grid grid-cols-4 gap-4">
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

                <FormField
                  control={form.control}
                  name="gris_percent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GRIS (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0,30"
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
                  name="ad_valorem_percent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ad Valorem (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0,10"
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
                  name="icms_percent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ICMS (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="12"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Calculated Values */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GRIS ({form.watch('gris_percent')}%)</span>
                  <span className="text-foreground">{formatCurrency(calculatedValue.gris)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ad Valorem ({form.watch('ad_valorem_percent')}%)</span>
                  <span className="text-foreground">{formatCurrency(calculatedValue.adValorem)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">{formatCurrency(calculatedValue.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ICMS ({form.watch('icms_percent')}%)</span>
                  <span className="text-foreground">{formatCurrency(calculatedValue.icms)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary text-lg">{formatCurrency(calculatedValue.total)}</span>
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

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? 'Salvar' : 'Criar Cotação'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
