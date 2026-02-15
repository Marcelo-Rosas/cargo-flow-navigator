import { useState } from 'react';
import { Loader2, ArrowRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useConvertQuoteToOrder } from '@/hooks/useOrders';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { useNavigate } from 'react-router-dom';

type Quote = Database['public']['Tables']['quotes']['Row'];

interface ConvertQuoteModalProps {
  open: boolean;
  onClose: () => void;
  quote: Quote | null;
}

export function ConvertQuoteModal({ open, onClose, quote }: ConvertQuoteModalProps) {
  const navigate = useNavigate();
  const convertMutation = useConvertQuoteToOrder();
  const [isLoading, setIsLoading] = useState(false);

  const handleConvert = async () => {
    if (!quote) return;

    setIsLoading(true);
    try {
      await convertMutation.mutateAsync(quote.id);
      toast.success('Cotação convertida em Ordem de Serviço com sucesso!');
      onClose();
      // Navigate to operations board
      navigate('/operacional');
    } catch (error) {
      toast.error('Erro ao converter cotação');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Converter Cotação em OS
          </DialogTitle>
          <DialogDescription>
            Esta ação irá criar uma nova Ordem de Serviço com os dados da cotação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quote Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium text-foreground">{quote.client_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rota</span>
              <span className="text-foreground">
                {quote.origin} → {quote.destination}
              </span>
            </div>
            {quote.cargo_type && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo de Carga</span>
                <span className="text-foreground">{quote.cargo_type}</span>
              </div>
            )}
            {quote.weight && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Peso</span>
                <span className="text-foreground">
                  {Number(quote.weight).toLocaleString('pt-BR')} kg
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="font-medium text-foreground">Valor Total</span>
              <span className="font-semibold text-primary text-lg">
                {formatCurrency(Number(quote.value))}
              </span>
            </div>
          </div>

          {/* What happens */}
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">Ao converter:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Uma nova OS será criada com status "Ordem Criada"</li>
              <li>Esta cotação será marcada como "Ganha"</li>
              <li>Você será redirecionado para o Board Operacional</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConvert} disabled={isLoading} className="gap-2">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            Converter para OS
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
