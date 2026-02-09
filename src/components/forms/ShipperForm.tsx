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

type Shipper = Database['public']['Tables']['shippers']['Row'];

const shipperSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(200, 'Nome muito longo'),
  cnpj: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2, 'Use a sigla do estado (ex: SP)').optional(),
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
      cnpj: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (shipper) {
      form.reset({
        name: shipper.name,
        cnpj: shipper.cnpj || '',
        email: shipper.email || '',
        phone: shipper.phone || '',
        address: shipper.address || '',
        city: shipper.city || '',
        state: shipper.state || '',
        notes: shipper.notes || '',
      });
    } else {
      form.reset({
        name: '',
        cnpj: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        notes: '',
      });
    }
  }, [shipper, form]);

  // CNPJ auto-lookup functions
  const sanitizeCnpj = (v: string) => v.replace(/\D/g, '');

  const safeSet = (key: keyof ShipperFormData, value?: string | null) => {
    if (!value) return;
    const current = form.getValues(key);
    if (current && current.trim().length > 0) return;
    form.setValue(key, value, { shouldValidate: true, shouldDirty: true });
  };

  const handleCnpjLookup = async () => {
    const raw = form.getValues('cnpj') || '';
    const cnpj = sanitizeCnpj(raw);
    if (cnpj.length !== 14) return;

    setIsLookingUp(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!res.ok) {
        setIsLookingUp(false);
        return;
      }
      const data: any = await res.json();

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

      toast.success('Dados preenchidos automaticamente pelo CNPJ');
    } catch {
      // Silently fail - API might be unavailable
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
      if (isEditing && shipper) {
        await updateShipperMutation.mutateAsync({
          id: shipper.id,
          updates: {
            name: data.name,
            cnpj: data.cnpj || null,
            email: data.email || null,
            phone: data.phone || null,
            address: data.address || null,
            city: data.city || null,
            state: data.state || null,
            notes: data.notes || null,
          },
        });
        toast.success('Embarcador atualizado com sucesso');
      } else {
        await createShipperMutation.mutateAsync({
          name: data.name,
          cnpj: data.cnpj || null,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          notes: data.notes || null,
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
              name="cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="00.000.000/0000-00"
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

            <div className="grid grid-cols-2 gap-4">
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
