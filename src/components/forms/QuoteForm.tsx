import { useEffect, useMemo } from 'react';
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
import { useCreateQuote, useUpdateQuote } from '@/hooks/useQuotes';
import { useClients } from '@/hooks/useClients';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type Quote = Database['public']['Tables']['quotes']['Row'];

const quoteSchema = z.object({
  client_id: z.string().optional(),
  client_name: z.string().min(2, 'Nome do cliente obrigatório'),
  client_email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  origin: z.string().min(2, 'Origem obrigatória'),
  destination: z.string().min(2, 'Destino obrigatório'),
  cargo_type: z.string().optional(),
  weight: z.number().min(0, 'Peso inválido').optional(),
  volume: z.number().min(0, 'Volume inválido').optional(),
  // Pricing components
  base_freight: z.number().min(0, 'Valor inválido'),
  toll: z.number().min(0, 'Valor inválido'),
  gris_percent: z.number().min(0).max(100, 'Percentual inválido'),
  ad_valorem_percent: z.number().min(0).max(100, 'Percentual inválido'),
  icms_percent: z.number().min(0).max(100, 'Percentual inválido'),
  cargo_value: z.number().min(0, 'Valor inválido'),
  notes: z.string().max(500, 'Observações muito longas').optional(),
});

type QuoteFormData = z.infer<typeof quoteSchema>;

interface QuoteFormProps {
  open: boolean;
  onClose: () => void;
  quote?: Quote | null;
}

export function QuoteForm({ open, onClose, quote }: QuoteFormProps) {
  const { user } = useAuth();
  const { data: clients } = useClients();
  const createQuoteMutation = useCreateQuote();
  const updateQuoteMutation = useUpdateQuote();
  const isEditing = !!quote;

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      client_id: '',
      client_name: '',
      client_email: '',
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
    if (quote) {
      form.reset({
        client_id: quote.client_id || '',
        client_name: quote.client_name,
        client_email: quote.client_email || '',
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
        cargo_value: 0,
        notes: quote.notes || '',
      });
    } else {
      form.reset({
        client_id: '',
        client_name: '',
        client_email: '',
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
        origin: data.origin,
        destination: data.destination,
        cargo_type: data.cargo_type || null,
        weight: data.weight || null,
        volume: data.volume || null,
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

            {/* Rota e Carga Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Rota e Carga</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="origin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origem *</FormLabel>
                      <FormControl>
                        <Input placeholder="Cidade - UF" {...field} />
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
                        <Input placeholder="Cidade - UF" {...field} />
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
