import { Loader2 } from 'lucide-react';
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
  return (
    <div className="space-y-6">
      <SectionBlock label="Dados do Cliente">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
