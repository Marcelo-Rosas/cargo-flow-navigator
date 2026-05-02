import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/hooks/useCalculateFreight';

interface AnttFloorAlertDialogProps {
  open: boolean;
  currentValue: number;
  piso: number;
  suggestedValue: number;
  isApplying: boolean;
  onApply: () => void;
  onCancel: () => void;
}

export function AnttFloorAlertDialog({
  open,
  currentValue,
  piso,
  suggestedValue,
  isApplying,
  onApply,
  onCancel,
}: AnttFloorAlertDialogProps) {
  const gap = piso - currentValue;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">Valor abaixo do Piso ANTT</DialogTitle>
          <DialogDescription>
            MP 1.343/2026 — Piso Mínimo de Frete Rodoviário de Cargas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
            <span className="text-muted-foreground">Valor atual</span>
            <span className="text-right font-medium text-destructive">
              {formatCurrency(currentValue)}
            </span>
            <span className="text-muted-foreground">Piso ANTT</span>
            <span className="text-right font-medium">{formatCurrency(piso)}</span>
            <span className="text-muted-foreground">Diferença</span>
            <span className="text-right font-medium text-orange-600">{formatCurrency(gap)}</span>
            <span className="text-muted-foreground">Sugestão (com piso)</span>
            <span className="text-right font-semibold text-green-700">
              {formatCurrency(suggestedValue)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Ao confirmar, o valor da cotação será atualizado para{' '}
            <strong>{formatCurrency(suggestedValue)}</strong> e a memória de cálculo será
            recalculada com o piso obrigatório como base de custo. A ação será registrada no
            histórico.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isApplying}>
            Cancelar
          </Button>
          <Button variant="default" onClick={onApply} disabled={isApplying}>
            {isApplying ? 'Aplicando…' : 'Aplicar Piso ANTT'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
