import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { useCreateOwner, useUpdateOwner } from '@/hooks/useOwners';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { zodCpfOrCnpj, zodPhone, zodCep } from '@/lib/validators';

type Owner = Database['public']['Tables']['owners']['Row'];

const ownerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(200, 'Nome muito longo'),
  cpf_cnpj: zodCpfOrCnpj,
  rg: z.string().optional(),
  rg_emitter: z.string().optional(),
  phone: zodPhone,
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z
    .string()
    .max(2, 'Use a sigla do estado (ex: SP)')
    .optional()
    .transform((v) => v?.toUpperCase()),
  zip_code: zodCep,
  notes: z.string().max(500, 'Observações muito longas').optional(),
  active: z.boolean(),
});

type OwnerFormData = z.infer<typeof ownerSchema>;

/** Form keys that hold string values (excludes `active`), for safeSet from CNPJ lookup. */
type OwnerFormStringKey = Exclude<keyof OwnerFormData, 'active'>;

interface OwnerFormProps {
  open: boolean;
  onClose: () => void;
  owner?: Owner | null;
}

export function OwnerForm({ open, onClose, owner }: OwnerFormProps) {
  const createOwnerMutation = useCreateOwner();
  const updateOwnerMutation = useUpdateOwner();
  const isEditing = !!owner;
  const [isLookingUp, setIsLookingUp] = useState(false);

  const form = useForm<OwnerFormData>({
    resolver: zodResolver(ownerSchema),
    defaultValues: {
      name: '',
      cpf_cnpj: '',
      rg: '',
      rg_emitter: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      notes: '',
      active: true,
    },
  });

  useEffect(() => {
    if (owner) {
      form.reset({
        name: owner.name,
        cpf_cnpj: owner.cpf_cnpj || '',
        rg: owner.rg || '',
        rg_emitter: owner.rg_emitter || '',
        phone: owner.phone || '',
        email: owner.email || '',
        address: owner.address || '',
        city: owner.city || '',
        state: owner.state || '',
        zip_code: owner.zip_code || '',
        notes: owner.notes || '',
        active: owner.active,
      });
    } else {
      form.reset({
        name: '',
        cpf_cnpj: '',
        rg: '',
        rg_emitter: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        notes: '',
        active: true,
      });
    }
  }, [owner, form]);

  const sanitizeCnpj = (v: string) => v.replace(/\D/g, '');

  const safeSet = (key: OwnerFormStringKey, value?: unknown) => {
    const str = value != null ? String(value).trim() : '';
    if (!str) return;
    const current = form.getValues(key);
    if (typeof current === 'string' && current.trim().length > 0) return;
    form.setValue(key, str, { shouldValidate: true, shouldDirty: true });
  };

  const handleCnpjLookup = async (rawValue?: string) => {
    const raw = rawValue ?? form.getValues('cpf_cnpj') ?? '';
    const cnpj = sanitizeCnpj(raw);
    if (cnpj.length !== 14) return;

    setIsLookingUp(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!res.ok) {
        setIsLookingUp(false);
        return;
      }
      const data = (await res.json()) as Record<string, unknown>;

      safeSet('name', data.razao_social || data.nome_fantasia || data.name);
      safeSet('email', data.email || data.email_contato);
      safeSet('phone', data.ddd_telefone_1 || data.telefone || data.phone);

      const street = data.logradouro || data.endereco || data.street;
      const number = data.numero || data.number;
      const district = data.bairro || data.distrito || data.neighborhood;
      const composedAddress = [street, number, district].filter(Boolean).join(', ');
      safeSet('address', composedAddress);

      safeSet('city', data.municipio || data.cidade || data.city);

      const uf = (data.uf || data.estado || data.state || '').toString().toUpperCase();
      safeSet('state', uf?.slice(0, 2));

      const cep = (data.cep || data.codigo_postal || data.zip_code || '').toString();
      safeSet('zip_code', cep);

      toast.success('Dados preenchidos automaticamente pelo CNPJ');
    } catch {
      // API pode estar indisponível
    } finally {
      setIsLookingUp(false);
    }
  };

  const onSubmit = async (data: OwnerFormData) => {
    try {
      if (isEditing && owner) {
        await updateOwnerMutation.mutateAsync({
          id: owner.id,
          updates: {
            name: data.name,
            cpf_cnpj: data.cpf_cnpj ? data.cpf_cnpj.replace(/\D/g, '') : null,
            rg: data.rg || null,
            rg_emitter: data.rg_emitter || null,
            phone: data.phone || null,
            email: data.email || null,
            address: data.address || null,
            city: data.city || null,
            state: data.state || null,
            zip_code: data.zip_code || null,
            notes: data.notes || null,
            active: data.active,
          },
        });
        toast.success('Proprietário atualizado com sucesso');
      } else {
        await createOwnerMutation.mutateAsync({
          name: data.name,
          cpf_cnpj: data.cpf_cnpj ? data.cpf_cnpj.replace(/\D/g, '') : null,
          rg: data.rg || null,
          rg_emitter: data.rg_emitter || null,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          zip_code: data.zip_code || null,
          notes: data.notes || null,
          active: data.active,
        });
        toast.success('Proprietário criado com sucesso');
      }
      onClose();
    } catch {
      toast.error(isEditing ? 'Erro ao atualizar proprietário' : 'Erro ao criar proprietário');
    }
  };

  const isLoading = createOwnerMutation.isPending || updateOwnerMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[96vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Proprietário' : 'Novo Proprietário'}</DialogTitle>
          <DialogDescription className="sr-only">
            Cadastre ou edite dados pessoais e de contato do proprietário do veículo.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome / Razão Social *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome ou empresa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cpf_cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF/CNPJ</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="00.000.000/0000-00 ou CPF"
                          {...field}
                          onBlur={async (e) => {
                            field.onBlur();
                            await handleCnpjLookup();
                          }}
                          className="pr-10"
                        />
                        {isLookingUp && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        {!isLookingUp && field.value && sanitizeCnpj(field.value).length === 14 && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Search className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RG</FormLabel>
                    <FormControl>
                      <Input placeholder="RG" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="rg_emitter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Órgão emissor do RG</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: SSP/SP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input placeholder="Rua, número, bairro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input placeholder="Cidade" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <FormControl>
                      <Input placeholder="SC" maxLength={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="zip_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <Input placeholder="00000-000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Informações adicionais..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Ativo</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? 'Salvar' : 'Criar Proprietário'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
