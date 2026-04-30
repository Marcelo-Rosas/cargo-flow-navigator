import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/hooks/useCalculateFreight';
import type { AnttFloorStatusResult } from '@/hooks/useAnttFloorStatus';

interface AnttFloorBannerProps {
  anttStatus: AnttFloorStatusResult;
  onApplyFloor: () => void;
  disabled?: boolean;
}

export function AnttFloorBanner({ anttStatus, onApplyFloor, disabled }: AnttFloorBannerProps) {
  if (anttStatus.status !== 'below_floor' && anttStatus.status !== 'stale') return null;

  const isBelow = anttStatus.status === 'below_floor';

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {isBelow ? 'Valor abaixo do Piso ANTT obrigatório' : 'Memória de cálculo desatualizada'}
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>
          {isBelow ? (
            <>
              Valor atual <strong>{formatCurrency(anttStatus.currentValue)}</strong> está{' '}
              <strong>{formatCurrency(anttStatus.gap)}</strong> abaixo do Piso ANTT (
              {formatCurrency(anttStatus.piso)}). PDF do cliente bloqueado até ajuste.
            </>
          ) : (
            <>
              A tabela ANTT foi atualizada após o último recálculo. Recalcule para verificar
              conformidade com o piso vigente.
            </>
          )}
        </span>
        <Button
          size="sm"
          variant="destructive"
          onClick={onApplyFloor}
          disabled={disabled}
          className="shrink-0"
        >
          {isBelow ? 'Aplicar Piso ANTT' : 'Recalcular'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
