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
import { useCreateShipper, useUpdateShipper } from '@/hooks/useShippers';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { zodCpf, zodCnpj, zodPhone, zodCep } from '@/lib/validators';
import { MaskedInput } from '@/components/ui/masked-input';
import { CnpjLookupError, lookupCnpj, pickLegalRepresentative } from '@/lib/cnpjLookup';

type Shipper = Database['public']['Tables']['shippers']['Row'];

const shipperSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(200, 'Nome muito longo'),
  cpf: zodCpf,
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

type ShipperFormData = z.infer<typeof shipperSchema>;

interface ShipperFormProps {
  open: boolean;
  onClose: () => void;
  shipper?: Shipper | null;
}

export function ShipperForm({ open, onClose, shipper }: ShipperFormProps) {
  const { user } = useAuth();
  const createShipperMutation = useCreateShipper();
  const updateShipperMutation = useUpdateShipper();
  const isEditing = !!shipper;
  const [isLookingUp, setIsLookingUp] = useState(false);

  const form = useForm<ShipperFormData>({
    resolver: zodResolver(shipperSchema),
    defaultValues: {
      name: '',
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
    if (shipper) {
      form.reset({
        name: shipper.name,
        cpf: shipper.cpf || '',
        cnpj: shipper.cnpj || '',
        email: shipper.email || '',
        phone: shipper.phone || '',
        address: shipper.address || '',
        city: shipper.city || '',
        state: shipper.state || '',
        zip_code: shipper.zip_code || '',
        notes: shipper.notes || '',
      });
    } else {
      form.reset({
        name: '',
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
  }, [shipper, form]);

  // CNPJ auto-lookup compartilhado em @/lib/cnpjLookup.
  const sanitizeCnpj = (v: string) => v.replace(/\D/g, '');
  const [cnpjResult, setCnpjResult] = useState<Awaited<ReturnType<typeof lookupCnpj>> | null>(null);

  const safeSet = (key: keyof ShipperFormData, value?: unknown) => {
    const str = value != null ? String(value).trim() : '';
    if (!str) return;
    const current = form.getValues(key);
    if (current && current.trim().length > 0) return;
    form.setValue(key, str, { shouldValidate: true, shouldDirty: true });
  };

  const handleCnpjLookup = async (rawValue?: string) => {
    const raw = rawValue ?? form.getValues('cnpj') ?? '';
    if (sanitizeCnpj(raw).length !== 14) return;

    setIsLookingUp(true);
    try {
      const result = await lookupCnpj(raw);
      setCnpjResult(result);

      safeSet('name', result.name ?? result.trade_name);
      safeSet('email', result.email);
      safeSet('phone', result.phone);
      safeSet('address', result.address);
      safeSet('city', result.city);
      safeSet('state', result.state);
      safeSet('zip_code', result.zip_code);

      const partnerCount = result.partners.length;
      toast.success(
        partnerCount > 0
          ? `Dados preenchidos pelo CNPJ (${partnerCount} sócio${partnerCount !== 1 ? 's' : ''} no QSA)`
          : 'Dados preenchidos pelo CNPJ'
      );
    } catch (e) {
      if (e instanceof CnpjLookupError) {
        toast.error(e.message);
      } else {
        toast.error('Falha ao consultar CNPJ — verifique sua conexão');
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  const onSubmit = async (data: ShipperFormData) => {
    if (!user) {
      toast.error('Você precisa estar logado para criar embarcadores');
      return;
    }

    try {
      // Reaproveita resultado do lookup CNPJ feito nesta sessao para popular
      // todos os campos novos da Receita (cartao + QSA) sem precisar de mais
      // chamadas. Tambem nutre representante legal sugerido pelo QSA.
      const rep = cnpjResult ? pickLegalRepresentative(cnpjResult.partners) : null;
      const cnpjFields = cnpjResult
        ? {
            trade_name: cnpjResult.trade_name,
            legal_nature: cnpjResult.legal_nature,
            legal_nature_code: cnpjResult.legal_nature_code,
            company_size: cnpjResult.company_size,
            cnae_main_code: cnpjResult.cnae_main_code,
            cnae_main_description: cnpjResult.cnae_main_description,
            cnaes_secondary: cnpjResult.cnaes_secondary,
            opening_date: cnpjResult.opening_date,
            registration_status: cnpjResult.registration_status,
            registration_status_date: cnpjResult.registration_status_date,
            registration_status_reason: cnpjResult.registration_status_reason,
            efr: cnpjResult.efr,
            share_capital: cnpjResult.share_capital,
            partners: cnpjResult.partners,
            address_number: cnpjResult.address_number,
            address_complement: cnpjResult.address_complement,
            address_neighborhood: cnpjResult.address_neighborhood,
            cnpj_lookup_at: new Date().toISOString(),
            legal_representative_name: rep?.name ?? null,
            legal_representative_role: rep?.role ?? null,
            legal_representative_cpf: rep?.document ?? null,
          }
        : {};

      const baseFields = {
        name: data.name,
        cpf: data.cpf ? data.cpf.replace(/\D/g, '') : null,
        cnpj: data.cnpj ? data.cnpj.replace(/\D/g, '') : null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip_code: data.zip_code || null,
        notes: data.notes || null,
        ...cnpjFields,
      };

      if (isEditing && shipper) {
        await updateShipperMutation.mutateAsync({
          id: shipper.id,
          updates: baseFields,
        });
        toast.success('Embarcador atualizado com sucesso');
      } else {
        await createShipperMutation.mutateAsync({
          ...baseFields,
          created_by: user.id,
        });
        toast.success('Embarcador criado com sucesso');
      }
      onClose();
    } catch (error) {
      toast.error(isEditing ? 'Erro ao atualizar embarcador' : 'Erro ao criar embarcador');
    }
  };

  const isLoading = createShipperMutation.isPending || updateShipperMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Embarcador' : 'Novo Embarcador'}</DialogTitle>
          <DialogDescription className="sr-only">
            Informe os dados cadastrais e de contato do embarcador para salvar o registro.
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
                    <Input placeholder="Empresa LTDA" {...field} />
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
                    <MaskedInput
                      mask="cpf"
                      placeholder="000.000.000-00"
                      value={field.value || ''}
                      onValueChange={(rawValue) => field.onChange(rawValue ?? '')}
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
                      placeholder="Informações adicionais sobre o embarcador..."
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
                {isEditing ? 'Salvar' : 'Criar Embarcador'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
