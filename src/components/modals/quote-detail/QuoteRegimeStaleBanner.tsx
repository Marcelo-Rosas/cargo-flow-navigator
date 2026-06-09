import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface QuoteRegimeStaleBannerProps {
  storedRegime: string;
  expectedLabel: string;
  onRecalculate: () => void;
  isRecalculating?: boolean;
  disabled?: boolean;
}

export function QuoteRegimeStaleBanner({
  storedRegime,
  expectedLabel,
  onRecalculate,
  isRecalculating = false,
  disabled = false,
}: QuoteRegimeStaleBannerProps) {
  return (
    <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
      <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        Memória de cálculo desatualizada
      </AlertTitle>
      <AlertDescription className="space-y-3 text-sm">
        <p>
          O DRE salvo usa regime <strong>{storedRegime}</strong>, mas as regras atuais exigem{' '}
          <strong>{expectedLabel}</strong>. O valor negociado da cotação não muda ao atualizar.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-amber-600/40"
          onClick={onRecalculate}
          disabled={disabled || isRecalculating}
          aria-label="Atualizar memória de cálculo com regime tributário atual"
        >
          {isRecalculating ? 'Atualizando…' : 'Atualizar memória agora'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
