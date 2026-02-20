import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { toast } from 'sonner';
import type { Driver } from '@/hooks/useDrivers';
import { zodPhone } from '@/lib/validators';

const driverSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(200, 'Nome muito longo'),
  phone: zodPhone,
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
  const isEditing = !!driver;

  const form = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: { name: '', phone: '', active: true },
  });

  useEffect(() => {
    if (driver) {
      form.reset({ name: driver.name, phone: driver.phone || '', active: driver.active });
    } else {
      form.reset({ name: '', phone: '', active: true });
    }
  }, [driver, form]);

  const onSubmit = async (data: DriverFormData) => {
    try {
      if (isEditing && driver) {
        await updateDriverMutation.mutateAsync({
          id: driver.id,
          updates: { name: data.name, phone: data.phone || null, active: data.active },
        });
        toast.success('Motorista atualizado com sucesso');
      } else {
        await createDriverMutation.mutateAsync({
          name: data.name,
          phone: data.phone || null,
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Motorista' : 'Novo Motorista'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do motorista" {...field} />
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
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="leading-none">
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
                {isEditing ? 'Salvar' : 'Criar Motorista'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
