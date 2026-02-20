import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Truck, User, Building2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useCreateVehicle, useUpdateVehicle } from '@/hooks/useVehicles';
import { useDrivers } from '@/hooks/useDrivers';
import { useOwners } from '@/hooks/useOwners';
import { toast } from 'sonner';
import type { VehicleWithRelations } from '@/hooks/useVehicles';
import { zodPlate } from '@/lib/validators';

const vehicleSchema = z.object({
  plate: zodPlate,
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}$/.test(v.trim()), 'Ano inválido – informe 4 dígitos (ex: 2020)'),
  color: z.string().optional(),
  renavam: z.string().optional(),
  driver_id: z.string().optional(),
  owner_id: z.string().optional(),
  active: z.boolean(),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

interface VehicleFormProps {
  open: boolean;
  onClose: () => void;
  vehicle?: VehicleWithRelations | null;
}

export function VehicleForm({ open, onClose, vehicle }: VehicleFormProps) {
  const createVehicleMutation = useCreateVehicle();
  const updateVehicleMutation = useUpdateVehicle();
  const { data: drivers, isLoading: driversLoading } = useDrivers(true, { enabled: open });
  const { data: owners, isLoading: ownersLoading } = useOwners(undefined, { enabled: open });
  const isEditing = !!vehicle;

  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      plate: '',
      brand: '',
      model: '',
      year: '',
      color: '',
      renavam: '',
      driver_id: '',
      owner_id: '',
      active: true,
    },
  });

  useEffect(() => {
    if (vehicle) {
      form.reset({
        plate: vehicle.plate,
        brand: vehicle.brand || '',
        model: vehicle.model || '',
        year: vehicle.year ? String(vehicle.year) : '',
        color: vehicle.color || '',
        renavam: vehicle.renavam || '',
        driver_id: vehicle.driver_id || '',
        owner_id: vehicle.owner_id || '',
        active: vehicle.active,
      });
    } else {
      form.reset({
        plate: '',
        brand: '',
        model: '',
        year: '',
        color: '',
        renavam: '',
        driver_id: '',
        owner_id: '',
        active: true,
      });
    }
  }, [vehicle, form]);

  const onSubmit = async (data: VehicleFormData) => {
    try {
      const plate = data.plate.trim().toUpperCase().replace(/[-\s]/g, '');
      if (isEditing && vehicle) {
        await updateVehicleMutation.mutateAsync({
          id: vehicle.id,
          updates: {
            plate,
            brand: data.brand || null,
            model: data.model || null,
            year: data.year ? parseInt(data.year, 10) : null,
            color: data.color || null,
            renavam: data.renavam || null,
            driver_id: data.driver_id || null,
            owner_id: data.owner_id || null,
            active: data.active,
          },
        });
        toast.success('Veículo atualizado com sucesso');
      } else {
        await createVehicleMutation.mutateAsync({
          plate,
          brand: data.brand || null,
          model: data.model || null,
          year: data.year ? parseInt(data.year, 10) : null,
          color: data.color || null,
          renavam: data.renavam || null,
          driver_id: data.driver_id || null,
          owner_id: data.owner_id || null,
          active: data.active,
        });
        toast.success('Veículo criado com sucesso');
      }
      onClose();
    } catch {
      toast.error(isEditing ? 'Erro ao atualizar veículo' : 'Erro ao criar veículo');
    }
  };

  const isLoading = createVehicleMutation.isPending || updateVehicleMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            {isEditing ? 'Editar Veículo' : 'Novo Veículo'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* ── Identificação do Veículo ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Identificação
              </p>

              {/* Placa + Ano */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="plate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placa *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ABC1D23"
                          {...field}
                          className="font-mono uppercase tracking-widest"
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                .toUpperCase()
                                .replace(/[^A-Z0-9]/g, '')
                                .slice(0, 7)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: 2022"
                          maxLength={4}
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Marca + Modelo */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Mercedes" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Actros 2651" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Cor + RENAVAM */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Branco" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="renavam"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RENAVAM</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="11 dígitos"
                          maxLength={11}
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.replace(/\D/g, '').slice(0, 11))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0 pt-1">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer">Veículo ativo</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* ── Motorista ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Motorista
              </p>
              <FormField
                control={form.control}
                name="driver_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motorista vinculado</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                      disabled={driversLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              driversLoading ? 'Carregando...' : 'Selecionar motorista...'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">
                          <span className="text-muted-foreground">Nenhum</span>
                        </SelectItem>
                        {drivers?.map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            <div className="flex flex-col gap-0.5">
                              <span>{driver.name}</span>
                              {driver.phone && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {driver.phone}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* ── Proprietário ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Proprietário
              </p>
              <FormField
                control={form.control}
                name="owner_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proprietário vinculado</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                      disabled={ownersLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              ownersLoading ? 'Carregando...' : 'Selecionar proprietário...'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">
                          <span className="text-muted-foreground">Nenhum</span>
                        </SelectItem>
                        {owners?.map((owner) => (
                          <SelectItem key={owner.id} value={owner.id}>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span>{owner.name}</span>
                                {!owner.active && (
                                  <Badge variant="secondary" className="text-[10px] py-0 px-1">
                                    Inativo
                                  </Badge>
                                )}
                              </div>
                              {owner.cpf_cnpj && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  {owner.cpf_cnpj}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? 'Salvar alterações' : 'Criar Veículo'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
