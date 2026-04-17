import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateOccurrence } from '@/hooks/useOccurrences';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type OccurrenceSeverity = Database['public']['Enums']['occurrence_severity'];

const occurrenceSchema = z.object({
  description: z
    .string()
    .min(10, 'Descrição deve ter no mínimo 10 caracteres')
    .max(1000, 'Descrição muito longa'),
  severity: z.enum(['baixa', 'media', 'alta', 'critica']),
});

type OccurrenceFormData = z.infer<typeof occurrenceSchema>;

interface OccurrenceFormProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  osNumber: string;
}

const SEVERITY_OPTIONS: { value: OccurrenceSeverity; label: string; color: string }[] = [
  { value: 'baixa', label: 'Baixa', color: 'bg-muted text-muted-foreground' },
  { value: 'media', label: 'Média', color: 'bg-warning/10 text-warning-foreground' },
  { value: 'alta', label: 'Alta', color: 'bg-destructive/20 text-destructive' },
  { value: 'critica', label: 'Crítica', color: 'bg-destructive text-destructive-foreground' },
];

export function OccurrenceForm({ open, onClose, orderId, osNumber }: OccurrenceFormProps) {
  const { user } = useAuth();
  const createOccurrenceMutation = useCreateOccurrence();

  const form = useForm<OccurrenceFormData>({
    resolver: zodResolver(occurrenceSchema),
    defaultValues: {
      description: '',
      severity: 'baixa',
    },
  });

  const onSubmit = async (data: OccurrenceFormData) => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    try {
      await createOccurrenceMutation.mutateAsync({
        order_id: orderId,
        description: data.description,
        severity: data.severity,
        created_by: user.id,
      });
      toast.success('Ocorrência registrada com sucesso');
      form.reset();
      onClose();
    } catch (error) {
      toast.error('Erro ao registrar ocorrência');
    }
  };

  const selectedSeverity = SEVERITY_OPTIONS.find((s) => s.value === form.watch('severity'));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Registrar Ocorrência
          </DialogTitle>
          <DialogDescription className="sr-only">
            Registre uma ocorrência operacional informando a gravidade e a descrição detalhada.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 p-3 rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Ordem de Serviço: <span className="font-semibold text-foreground">{osNumber}</span>
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gravidade *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a gravidade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SEVERITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <div
                              className={cn('w-2 h-2 rounded-full', option.color.split(' ')[0])}
                            />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedSeverity && (
              <div className={cn('p-3 rounded-lg text-sm', selectedSeverity.color)}>
                {selectedSeverity.value === 'baixa' && 'Problema menor que não afeta a operação.'}
                {selectedSeverity.value === 'media' &&
                  'Problema que pode causar atrasos moderados.'}
                {selectedSeverity.value === 'alta' && 'Problema sério que requer atenção imediata.'}
                {selectedSeverity.value === 'critica' &&
                  'Problema crítico que paralisa a operação!'}
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição da Ocorrência *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva detalhadamente o que aconteceu, quando e quais ações foram tomadas..."
                      className="resize-none min-h-[120px]"
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
              <Button
                type="submit"
                disabled={createOccurrenceMutation.isPending}
                className="bg-warning text-warning-foreground hover:bg-warning/90"
              >
                {createOccurrenceMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Registrar Ocorrência
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
