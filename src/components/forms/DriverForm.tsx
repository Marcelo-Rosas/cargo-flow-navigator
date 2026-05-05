import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, User, Truck, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Checkbox } from '@/components/ui/checkbox';
import { useCreateDriver, useUpdateDriver } from '@/hooks/useDrivers';
import { useCreateOwner } from '@/hooks/useOwners';
import { useVehicles } from '@/hooks/useVehicles';
import { useUpdateVehicle } from '@/hooks/useVehicles';
import { useCnhCategories } from '@/hooks/useCnhCategories';
import { toast } from 'sonner';
import type { Driver } from '@/hooks/useDrivers';
import { zodPhone } from '@/lib/validators';

const driverSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(200, 'Nome muito longo'),
  cpf: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{11}$/.test(v.replace(/\D/g, '')),
      'CPF inválido – informe 11 dígitos'
    ),
  phone: zodPhone,
  cnh: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{11}$/.test(v.replace(/\D/g, '')),
      'CNH inválida – informe 11 dígitos'
    ),
  cnh_category: z.string().optional(),
  antt: z.string().optional(),
  contract_type: z.enum(['proprio', 'agregado', 'terceiro']),
  rntrc_registry_type: z.enum(['TAC', 'ETC'], {
    required_error: 'RNTRC é obrigatório',
    invalid_type_error: 'Selecione TAC ou ETC',
  }),
  is_owner: z.boolean(),
  active: z.boolean(),
});

type DriverFormData = z.infer<typeof driverSchema>;

interface DriverFormProps {
  open: boolean;
  onClose: () => void;
  driver?: Driver | null;
}

export function DriverForm({ open, onClose, driver }: DriverFormProps) {
  const createDriverMutation = useCreateDriver();
  const updateDriverMutation = useUpdateDriver();
  const createOwnerMutation = useCreateOwner();
  const updateVehicleMutation = useUpdateVehicle();
  const isEditing = !!driver;

  // Busca veículo(s) vinculado ao motorista (apenas em modo edição)
  const { data: allVehicles } = useVehicles(driver?.id ?? null);
  const linkedVehicles = useMemo(
    () => allVehicles?.filter((v) => v.driver_id === driver?.id) ?? [],
    [allVehicles, driver?.id]
  );

  // Verifica se o motorista já é proprietário de algum veículo vinculado
  const [initialIsOwner, setInitialIsOwner] = useState(false);
  useEffect(() => {
    if (isEditing && linkedVehicles.length > 0) {
      const hasOwnership = linkedVehicles.some((v) => v.owner?.name === driver?.name);
      setInitialIsOwner(hasOwnership);
    }
  }, [isEditing, linkedVehicles, driver?.name]);

  const form = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      name: '',
      cpf: '',
      phone: '',
      cnh: '',
      cnh_category: '',
      antt: '',
      contract_type: 'proprio',
      rntrc_registry_type: undefined as unknown as 'TAC' | 'ETC',
      is_owner: false,
      active: true,
    },
  });

  useEffect(() => {
    if (driver) {
      form.reset({
        name: driver.name,
        cpf: driver.cpf || '',
        phone: driver.phone || '',
        cnh: driver.cnh || '',
        cnh_category: (driver.cnh_category as DriverFormData['cnh_category']) || '',
        antt: driver.antt || '',
        contract_type: driver.contract_type ?? 'proprio',
        rntrc_registry_type: (driver.rntrc_registry_type ?? undefined) as 'TAC' | 'ETC',
        is_owner: initialIsOwner,
        active: driver.active,
      });
    } else {
      form.reset({
        name: '',
        cpf: '',
        phone: '',
        cnh: '',
        cnh_category: '',
        antt: '',
        contract_type: 'proprio',
        rntrc_registry_type: undefined as unknown as 'TAC' | 'ETC',
        is_owner: false,
        active: true,
      });
    }
  }, [driver, form, initialIsOwner]);

  const onSubmit = async (data: DriverFormData) => {
    try {
      if (isEditing && driver) {
        await updateDriverMutation.mutateAsync({
          id: driver.id,
          updates: {
            name: data.name,
            cpf: data.cpf || null,
            phone: data.phone || null,
            cnh: data.cnh || null,
            cnh_category: data.cnh_category || null,
            antt: data.antt || null,
            contract_type: data.contract_type,
            rntrc_registry_type: data.rntrc_registry_type,
            active: data.active,
          },
        });

        // Se marcou "é proprietário" e tem veículos vinculados, criar/vincular owner
        if (data.is_owner && linkedVehicles.length > 0) {
          try {
            const ownerData = await createOwnerMutation.mutateAsync({
              name: data.name,
              phone: data.phone || null,
            });
            // Vincular o owner aos veículos do motorista
            for (const v of linkedVehicles) {
              if (!v.owner_id) {
                await updateVehicleMutation.mutateAsync({
                  id: v.id,
                  updates: { owner_id: ownerData.id },
                });
              }
            }
          } catch {
            // Owner pode já existir com mesmo nome — não é erro crítico
          }
        }

        toast.success('Motorista atualizado com sucesso');
      } else {
        await createDriverMutation.mutateAsync({
          name: data.name,
          cpf: data.cpf || null,
          phone: data.phone || null,
          cnh: data.cnh || null,
          cnh_category: data.cnh_category || null,
          antt: data.antt || null,
          contract_type: data.contract_type,
          rntrc_registry_type: data.rntrc_registry_type,
          active: data.active,
        });
        toast.success('Motorista criado com sucesso');
      }
      onClose();
    } catch {
      toast.error(isEditing ? 'Erro ao atualizar motorista' : 'Erro ao criar motorista');
    }
  };

  const isLoading = createDriverMutation.isPending || updateDriverMutation.isPending;

  const { data: cnhCategories = [] } = useCnhCategories();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[460px] max-h-[96vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            {isEditing ? 'Editar Motorista' : 'Novo Motorista'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Cadastre ou atualize dados pessoais, habilitação e status do motorista.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* ── Dados pessoais ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dados pessoais
              </p>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do motorista" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="000.000.000-00"
                        maxLength={14}
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.replace(/\D/g, '').slice(0, 11))
                        }
                        value={
                          field.value
                            ? field.value
                                .replace(/\D/g, '')
                                .replace(/(\d{3})(\d)/, '$1.$2')
                                .replace(/(\d{3})(\d)/, '$1.$2')
                                .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
                            : ''
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone / WhatsApp</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Habilitação + ANTT ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Habilitação (CNH) e ANTT
              </p>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="cnh"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número da CNH</FormLabel>
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
                <FormField
                  control={form.control}
                  name="cnh_category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          {...field}
                        >
                          <option value="">Selecionar...</option>
                          {cnhCategories.map((cat) => (
                            <option key={cat.code} value={cat.code}>
                              {`${cat.code} — ${cat.description}`}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="antt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registro ANTT (RNTRC)</FormLabel>
                    <FormControl>
                      <Input placeholder="Número do RNTRC" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contract_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de vínculo operacional *</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                      >
                        <option value="proprio">Frota</option>
                        <option value="agregado">Agregado</option>
                        <option value="terceiro">Terceiro</option>
                      </select>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Esta definição será usada na consulta ANTT do Step 1 do risco.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rntrc_registry_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registro RNTRC (TAC/ETC) *</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value || undefined)}
                      >
                        <option value="">Selecione…</option>
                        <option value="TAC">TAC</option>
                        <option value="ETC">ETC</option>
                      </select>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Obrigatório. Define se o motorista é Transportador Autônomo (TAC) ou vinculado
                      a Empresa de Transporte (ETC) — usado para regra de CIOT.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Proprietário ── */}
            {isEditing && linkedVehicles.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Proprietário
                </p>
                <FormField
                  control={form.control}
                  name="is_owner"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0 rounded-md border border-input p-3 bg-muted/30">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="leading-none">
                        <FormLabel className="font-normal cursor-pointer">
                          Motorista é proprietário do veículo
                        </FormLabel>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Ao salvar, cria um registro de proprietário com os dados do motorista e
                          vincula aos veículos
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* ── Veículos vinculados (só em edição) ── */}
            {isEditing && linkedVehicles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  Veículos vinculados
                </p>
                <div className="flex flex-wrap gap-2">
                  {linkedVehicles.map((v) => (
                    <Badge key={v.id} variant="secondary" className="font-mono text-sm gap-1.5">
                      <Truck className="w-3 h-3" />
                      {v.plate}
                      {v.brand && v.model ? ` · ${v.brand} ${v.model}` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* ── Status ── */}
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0 rounded-md border border-input p-3 bg-muted/30">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="leading-none">
                    <FormLabel className="font-normal cursor-pointer">Motorista ativo</FormLabel>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Motoristas inativos não aparecem nas seleções de cotação e OS
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? 'Salvar alterações' : 'Criar Motorista'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
