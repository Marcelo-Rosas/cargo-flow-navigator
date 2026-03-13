import { useEffect } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MaskedInput } from '@/components/ui/masked-input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFieldArray } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import type { QuoteFormData } from '../types';
import { SectionBlock } from '@/components/ui/section-block';

interface VehicleType {
  id: string;
  name: string;
  code: string;
}

interface IdentificationStepProps {
  form: UseFormReturn<QuoteFormData>;
  clients: { id: string; name: string; email?: string | null; zip_code?: string | null }[];
  shippers: { id: string; name: string; email?: string | null; zip_code?: string | null }[];
  vehicleTypes: VehicleType[];
  isLegacy?: boolean;
  onClientSelect: (clientId: string) => void;
  onShipperSelect: (shipperId: string) => void;
  onOriginCepBlur: () => Promise<void>;
  onDestinationCepBlur: () => Promise<void>;
  onCalculateKm: () => Promise<void>;
  onOriginManualEdit?: () => void;
  onDestinationManualEdit?: () => void;
  isLoadingOriginCep: boolean;
  isLoadingDestinationCep: boolean;
  isCalculatingKm: boolean;
}

export function IdentificationStep({
  form,
  clients,
  shippers,
  vehicleTypes,
  isLegacy = false,
  onClientSelect,
  onShipperSelect,
  onOriginCepBlur,
  onDestinationCepBlur,
  onCalculateKm,
  onOriginManualEdit,
  onDestinationManualEdit,
  isLoadingOriginCep,
  isLoadingDestinationCep,
  isCalculatingKm,
}: IdentificationStepProps) {
  const {
    fields: recipientFields,
    append: appendRecipient,
    remove: removeRecipient,
  } = useFieldArray({
    control: form.control,
    name: 'additional_recipients',
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'route_stops',
  });

  const clientCount = 1 + recipientFields.length;
  const showParadas = clientCount > 1;

  useEffect(() => {
    if (!showParadas) {
      const stops = form.getValues('route_stops') ?? [];
      if (stops.length > 0) {
        form.setValue('route_stops', [], { shouldDirty: true });
      }
    }
  }, [showParadas, form]);

  return (
    <div className="space-y-6">
      <SectionBlock label="Dados do Cliente">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente Existente</FormLabel>
                  <Select onValueChange={(value) => onClientSelect(value)} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar cliente..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Destinatários adicionais
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendRecipient({ client_id: '', name: '' })}
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar cliente
              </Button>
            </div>
            {recipientFields.map((rf, idx) => {
              const mainClientId = form.watch('client_id');
              const otherRecipientIds = (form.watch('additional_recipients') ?? [])
                .map((r) => (r as { client_id?: string }).client_id)
                .filter((id, i) => i !== idx && !!id);
              const excludedIds = new Set([mainClientId, ...otherRecipientIds].filter(Boolean));
              const availableClients = clients.filter((c) => !excludedIds.has(c.id));
              return (
                <div
                  key={rf.id}
                  className="flex items-center gap-2 rounded-lg border border-border p-3 bg-muted/20"
                >
                  <FormField
                    control={form.control}
                    name={`additional_recipients.${idx}.client_id`}
                    render={({ field: f }) => (
                      <FormItem className="flex-1 min-w-0">
                        <FormLabel className="text-xs text-muted-foreground">Cliente</FormLabel>
                        <Select
                          value={f.value || ''}
                          onValueChange={(value) => {
                            f.onChange(value);
                            const selected = clients.find((c) => c.id === value);
                            if (selected) {
                              form.setValue(`additional_recipients.${idx}.name`, selected.name, {
                                shouldDirty: true,
                              });
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Selecionar cliente..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableClients.map((client) => (
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive self-end"
                    onClick={() => removeRecipient(idx)}
                    title="Remover destinatário"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </SectionBlock>

      <SectionBlock label="Embarcador">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="shipper_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Embarcador Existente</FormLabel>
                  <Select onValueChange={(value) => onShipperSelect(value)} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar embarcador..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {shippers.map((shipper) => (
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <SelectItem value="FOB" title="Frete por conta do destinatário">
                        FOB
                      </SelectItem>
                      <SelectItem value="CIF" title="Frete por conta do remetente">
                        CIF
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </SectionBlock>

      <SectionBlock label="Rota">
        <div className="space-y-4">
          {!isLegacy && (
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
                      {vehicleTypes.map((vehicle) => (
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
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
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
                          onOriginCepBlur();
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
                          onDestinationCepBlur();
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
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
                        onOriginManualEdit?.();
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
                        onDestinationManualEdit?.();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Paradas intermediárias — só exibe quando há 2+ clientes/destinatários */}
          {showParadas && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Paradas intermediárias
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ sequence: fields.length + 1, cep: '', city_uf: '' })}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar parada
                </Button>
              </div>
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 bg-muted/30"
                >
                  <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                  <FormField
                    control={form.control}
                    name={`route_stops.${index}.cep`}
                    render={({ field: f }) => (
                      <FormItem className="flex-1 min-w-[100px]">
                        <FormControl>
                          <MaskedInput
                            mask="cep"
                            placeholder="CEP"
                            value={f.value || ''}
                            onValueChange={(rawValue) => f.onChange(String(rawValue ?? ''))}
                            onBlur={f.onBlur}
                            className="h-9"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`route_stops.${index}.city_uf`}
                    render={({ field: f }) => (
                      <FormItem className="flex-1 min-w-[140px]">
                        <FormControl>
                          <Input placeholder="Cidade - UF" {...f} className="h-9" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(index)}
                    title="Remover parada"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCalculateKm}
              disabled={
                isCalculatingKm ||
                isLoadingOriginCep ||
                isLoadingDestinationCep ||
                !form.watch('origin')?.trim() ||
                !form.watch('destination')?.trim() ||
                (!isLegacy && !form.watch('vehicle_type_id'))
              }
            >
              {isCalculatingKm && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Calcular KM
            </Button>
          </div>
        </div>
      </SectionBlock>
    </div>
  );
}
