import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface QuoteWizardFooterProps {
  canPrev: boolean;
  canNext: boolean;
  canSubmit: boolean;
  isLoading: boolean;
  isEditing: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onSubmit: () => void;
  onDelete?: () => void;
  blockedReason?: string | null;
  preserveOriginalPrice?: boolean;
  onPreserveOriginalPriceChange?: (value: boolean) => void;
}

export function QuoteWizardFooter({
  canPrev,
  canNext,
  canSubmit,
  isLoading,
  isEditing,
  onPrev,
  onNext,
  onClose,
  onSubmit,
  onDelete,
  blockedReason,
  preserveOriginalPrice = false,
  onPreserveOriginalPriceChange,
}: QuoteWizardFooterProps) {
  return (
    <footer className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-1 pt-4 mt-2">
      {!canNext && blockedReason ? (
        <p
          role="status"
          aria-live="polite"
          data-testid="wizard-blocked-reason"
          className={cn(
            'mb-3 rounded-md border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-900',
            'dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100'
          )}
        >
          {blockedReason}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-h-9">
          {isEditing && onDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" aria-hidden />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir cotação?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir esta cotação? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {canNext
                ? 'Avance quando os campos obrigatórios estiverem ok.'
                : 'Revise e salve a cotação.'}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          {isEditing && onPreserveOriginalPriceChange ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer sm:max-w-[220px]">
              <Checkbox
                checked={preserveOriginalPrice}
                onCheckedChange={(c) => onPreserveOriginalPriceChange(!!c)}
              />
              Manter valor negociado (atualiza DRE e memória)
            </label>
          ) : null}

          <div className="flex gap-2 sm:gap-3 justify-end">
            {canPrev ? (
              <Button type="button" variant="outline" onClick={onPrev} className="min-w-[100px]">
                <ChevronLeft className="w-4 h-4 mr-1" aria-hidden />
                Voltar
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={onClose} className="min-w-[100px]">
                Cancelar
              </Button>
            )}
            {canNext ? (
              <>
                {isEditing && canSubmit ? (
                  <Button
                    type="button"
                    variant="secondary"
                    data-testid="wizard-save-draft"
                    onClick={onSubmit}
                    disabled={isLoading}
                    className="min-w-[120px]"
                  >
                    {isLoading ? 'Salvando...' : 'Salvar'}
                  </Button>
                ) : null}
                <Button type="button" onClick={onNext} className="min-w-[120px]">
                  Continuar
                  <ChevronRight className="w-4 h-4 ml-1" aria-hidden />
                </Button>
              </>
            ) : (
              <Button
                type="button"
                data-testid="wizard-submit"
                onClick={onSubmit}
                disabled={!canSubmit}
                className="min-w-[140px]"
              >
                {isLoading ? 'Salvando...' : isEditing ? 'Salvar cotação' : 'Criar cotação'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
