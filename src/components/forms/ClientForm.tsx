import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Search } from 'lucide-react';
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
import { useCreateClient, useUpdateClient } from '@/hooks/useClients';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { zodCnpj, zodPhone, zodCep, validateCpf } from '@/lib/validators';
import { MaskedInput } from '@/components/ui/masked-input';

type Client = Database['public']['Tables']['clients']['Row'];

const digits = (v: string) => v.replace(/\D/g, '');

const clientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(200, 'Nome muito longo'),
  contact_name: z.string().max(200, 'Nome muito longo').optional(),
  cpf: z
    .string()
    .optional()
    .refine((v) => !v || digits(v).length === 0 || validateCpf(v), 'CPF inválido'),
  cnpj: zodCnpj,
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: zodPhone,
  address: z.string().optional(),
  city: z.string().optional(),
  state: z
    .string()
    .max(2, 'Use a sigla do estado (ex: SP)')
    .optional()
    .transform((v) => v?.toUpperCase()),
  zip_code: zodCep,
  notes: z.string().max(500, 'Observações muito longas').optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientFormProps {
  open: boolean;
  onClose: () => void;
  client?: Client | null;
}

export function ClientForm({ open, onClose, client }: ClientFormProps) {
  const { user } = useAuth();
  const createClientMutation = useCreateClient();
  const updateClientMutation = useUpdateClient();
  const isEditing = !!client;
  const [isLookingUp, setIsLookingUp] = useState(false);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      contact_name: '',
      cpf: '',
      cnpj: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name,
        contact_name: client.contact_name || '',
        cpf: client.cpf ? String(client.cpf) : '',
        cnpj: client.cnpj || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        city: client.city || '',
        state: client.state || '',
        zip_code: client.zip_code || '',
        notes: client.notes || '',
      });
    } else {
      form.reset({
        name: '',
        contact_name: '',
        cpf: '',
        cnpj: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        notes: '',
      });
    }
  }, [client, form]);

  // CNPJ auto-lookup functions
  const sanitizeCnpj = (v: string) => v.replace(/\D/g, '');

  const safeSet = (key: keyof ClientFormData, value?: unknown) => {
    const str = value != null ? String(value).trim() : '';
    if (!str) return;
    const current = form.getValues(key);
    if (current && current.trim().length > 0) return; // não sobrescreve se usuário já preencheu
    form.setValue(key, str, { shouldValidate: true, shouldDirty: true });
  };

  const handleCnpjLookup = async (rawValue?: string) => {
    const raw = rawValue ?? form.getValues('cnpj') ?? '';
    const cnpj = sanitizeCnpj(raw);
    if (cnpj.length !== 14) return;

    setIsLookingUp(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error('CNPJ não encontrado na base da Receita Federal');
        } else {
          toast.error(`Erro ao consultar CNPJ (status ${res.status})`);
        }
        setIsLookingUp(false);
        return;
      }
      const data = (await res.json()) as Record<string, unknown>;

      // Mapeamento "tolerante" a variações de chave
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
      toast.error('Falha ao consultar CNPJ — verifique sua conexão');
    } finally {
      setIsLookingUp(false);
    }
  };

  const onSubmit = async (data: ClientFormData) => {
    if (!user) {
      toast.error('Você precisa estar logado para criar clientes');
      return;
    }

    try {
      if (isEditing && client) {
        const cpfNum = data.cpf ? Number(digits(data.cpf)) : null;
        await updateClientMutation.mutateAsync({
          id: client.id,
          updates: {
            name: data.name,
            contact_name: data.contact_name || null,
            cpf: cpfNum,
            cnpj: data.cnpj ? data.cnpj.replace(/\D/g, '') : null,
            email: data.email || null,
            phone: data.phone || null,
            address: data.address || null,
            city: data.city || null,
            state: data.state || null,
            zip_code: data.zip_code || null,
            notes: data.notes || null,
          },
        });
        toast.success('Cliente atualizado com sucesso');
      } else {
        const cpfNum = data.cpf ? Number(digits(data.cpf)) : null;
        await createClientMutation.mutateAsync({
          name: data.name,
          contact_name: data.contact_name || null,
          cpf: cpfNum,
          cnpj: data.cnpj ? data.cnpj.replace(/\D/g, '') : null,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          zip_code: data.zip_code || null,
          notes: data.notes || null,
          created_by: user.id,
        });
        toast.success('Cliente criado com sucesso');
      }
      onClose();
    } catch (error) {
      toast.error(isEditing ? 'Erro ao atualizar cliente' : 'Erro ao criar cliente');
    }
  };

  const isLoading = createClientMutation.isPending || updateClientMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
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
                    <Input placeholder="Empresa LTDA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do responsável" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <MaskedInput
                        mask="cpf"
                        placeholder="000.000.000-00"
                        value={field.value || ''}
                        onValueChange={(raw) => field.onChange(raw ?? '')}
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <MaskedInput
                          mask="cnpj"
                          placeholder="00.000.000/0000-00"
                          value={field.value || ''}
                          onValueChange={(raw) => field.onChange(raw ?? '')}
                          onBlur={async () => {
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
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-primary transition-colors"
                            onClick={handleCnpjLookup}
                            title="Consultar CNPJ"
                          >
                            <Search className="w-4 h-4 text-muted-foreground hover:text-primary" />
                          </button>
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
                      <Input type="email" placeholder="contato@empresa.com" {...field} />
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
                      <Input placeholder="São Paulo" {...field} />
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
                    <FormLabel>Estado</FormLabel>
                    <FormControl>
                      <Input placeholder="SP" maxLength={2} {...field} />
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
                      placeholder="Informações adicionais sobre o cliente..."
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
                {isEditing ? 'Salvar' : 'Criar Cliente'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
