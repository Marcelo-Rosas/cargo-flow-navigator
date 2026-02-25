import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Truck } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { useCreateOrder, useUpdateOrder, OrderWithOccurrences } from '@/hooks/useOrders';
import { useClients } from '@/hooks/useClients';
import { useDrivers } from '@/hooks/useDrivers';
import { useVehicles } from '@/hooks/useVehicles';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const orderSchema = z.object({
  client_id: z.string().optional(),
  client_name: z.string().min(2, 'Nome do cliente obrigatório'),
  origin: z.string().min(2, 'Origem obrigatória'),
  destination: z.string().min(2, 'Destino obrigatório'),
  value: z.number().min(0, 'Valor inválido'),
  driver_id: z.string().optional(),
  driver_name: z.string().optional(),
  driver_phone: z.string().optional(),
  vehicle_plate: z.string().optional(),
  owner_name: z.string().optional(),
  owner_phone: z.string().optional(),
  eta: z.string().optional(),
  notes: z.string().max(500, 'Observações muito longas').optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

interface OrderFormProps {
  open: boolean;
  onClose: () => void;
  order?: OrderWithOccurrences | null;
}

export function OrderForm({ open, onClose, order }: OrderFormProps) {
  const { user } = useAuth();
  const { data: clients } = useClients();
  const { data: drivers } = useDrivers();
  const [selectedDriverId, setSelectedDriverId] = useState<string | undefined>(undefined);
  const { data: vehicles } = useVehicles(selectedDriverId);
  const createOrderMutation = useCreateOrder();
  const updateOrderMutation = useUpdateOrder();
  const isEditing = !!order;

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      client_id: '',
      client_name: '',
      origin: '',
      destination: '',
      value: 0,
      driver_id: '',
      driver_name: '',
      driver_phone: '',
      vehicle_plate: '',
      owner_name: '',
      owner_phone: '',
      eta: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (order) {
      setSelectedDriverId(order.driver_id || undefined);
      form.reset({
        client_id: order.client_id || '',
        client_name: order.client_name,
        origin: order.origin,
        destination: order.destination,
        value: Number(order.value) || 0,
        driver_id: order.driver_id || '',
        driver_name: order.driver_name || '',
        driver_phone: order.driver_phone || '',
        vehicle_plate: order.vehicle_plate || '',
        owner_name: order.owner_name || '',
        owner_phone: order.owner_phone || '',
        eta: order.eta ? new Date(order.eta).toISOString().slice(0, 16) : '',
        notes: order.notes || '',
      });
    } else {
      setSelectedDriverId(undefined);
      form.reset({
        client_id: '',
        client_name: '',
        origin: '',
        destination: '',
        value: 0,
        driver_id: '',
        driver_name: '',
        driver_phone: '',
        vehicle_plate: '',
        owner_name: '',
        owner_phone: '',
        eta: '',
        notes: '',
      });
    }
  }, [order, form]);

  const handleClientSelect = (clientId: string) => {
    const selectedClient = clients?.find((c) => c.id === clientId);
    if (selectedClient) {
      form.setValue('client_id', clientId);
      form.setValue('client_name', selectedClient.name);
    }
  };

  const handleDriverSelect = (driverId: string) => {
    const selectedDriver = drivers?.find((d) => d.id === driverId);
    if (selectedDriver) {
      setSelectedDriverId(driverId);
      form.setValue('driver_id', driverId);
      form.setValue('driver_name', selectedDriver.name);
      form.setValue('driver_phone', selectedDriver.phone || '');
      form.setValue('vehicle_plate', '');
      form.setValue('owner_name', '');
      form.setValue('owner_phone', '');
    }
  };

  const handleVehicleSelect = (vehicleId: string) => {
    const selectedVehicle = vehicles?.find((v) => v.id === vehicleId);
    if (selectedVehicle) {
      form.setValue('vehicle_plate', selectedVehicle.plate);
      form.setValue('owner_name', selectedVehicle.owner?.name ?? '');
      form.setValue('owner_phone', selectedVehicle.owner?.phone ?? '');
    }
  };

  const onSubmit = async (data: OrderFormData) => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    try {
      const orderData = {
        client_id: data.client_id || null,
        client_name: data.client_name,
        origin: data.origin,
        destination: data.destination,
        value: data.value,
        // driver_id não existe na tabela orders — o motorista é identificado pelos campos snapshot
        driver_name: data.driver_name || null,
        driver_phone: data.driver_phone || null,
        vehicle_plate: data.vehicle_plate || null,
        owner_name: data.owner_name || null,
        owner_phone: data.owner_phone || null,
        eta: data.eta ? new Date(data.eta).toISOString() : null,
        notes: data.notes || null,
      };

      if (isEditing && order) {
        await updateOrderMutation.mutateAsync({
          id: order.id,
          updates: orderData,
        });
        toast.success('Ordem atualizada com sucesso');
      } else {
        await createOrderMutation.mutateAsync({
          ...orderData,
          created_by: user.id,
        });
        toast.success('Ordem criada com sucesso');
      }
      onClose();
    } catch (error) {
      toast.error(isEditing ? 'Erro ao atualizar ordem' : 'Erro ao criar ordem');
    }
  };

  const isLoading = createOrderMutation.isPending || updateOrderMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Cliente Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Dados do Cliente</h3>

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

            {/* Rota Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Rota</h3>

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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor do Frete (R$)</FormLabel>
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
                  name="eta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Previsão de Entrega</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Motorista Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Dados do Transporte</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="driver_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motorista</FormLabel>
                      <Select
                        onValueChange={(value) => handleDriverSelect(value)}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar motorista..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {drivers?.map((driver) => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.name}
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
                  name="driver_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone do Motorista</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(11) 99999-9999"
                          {...field}
                          readOnly
                          className="bg-muted/50"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormItem>
                <FormLabel>Veículo</FormLabel>
                <Select
                  onValueChange={(value) => handleVehicleSelect(value)}
                  disabled={!selectedDriverId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedDriverId
                          ? 'Selecionar veículo...'
                          : 'Selecione um motorista primeiro'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles?.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.plate}{' '}
                        {vehicle.brand && vehicle.model
                          ? `- ${vehicle.brand} ${vehicle.model}`
                          : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.watch('vehicle_plate') && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Placa selecionada:{' '}
                    <span className="font-mono font-medium">{form.watch('vehicle_plate')}</span>
                  </p>
                )}
              </FormItem>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="owner_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proprietário</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Selecione um veículo"
                        {...field}
                        readOnly
                        className="bg-muted/50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="owner_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone do Proprietário</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(11) 99999-9999"
                        {...field}
                        readOnly
                        className="bg-muted/50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
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
                      placeholder="Instruções especiais, pontos de referência..."
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
                {isEditing ? 'Salvar' : 'Criar OS'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
