import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuoteWizardStepConfig } from './quote-wizard-steps';

interface QuoteWizardStepperProps {
  steps: QuoteWizardStepConfig[];
  currentStep: number;
  onStepClick?: (index: number) => void;
}

export function QuoteWizardStepper({ steps, currentStep, onStepClick }: QuoteWizardStepperProps) {
  const progressPct = ((currentStep + 1) / steps.length) * 100;

  return (
    <nav className="shrink-0 space-y-3" aria-label="Etapas da cotação">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          Etapa <span className="font-semibold text-foreground">{currentStep + 1}</span> de{' '}
          {steps.length}
        </span>
        <span className="tabular-nums">{Math.round(progressPct)}% concluído</span>
      </div>

      <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
          role="progressbar"
          aria-valuenow={currentStep + 1}
          aria-valuemin={1}
          aria-valuemax={steps.length}
        />
      </div>

      <ol className="flex gap-0 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin">
        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = index < currentStep && !!onStepClick;
          const Icon = step.icon;

          return (
            <li
              key={step.id}
              className={cn(
                'flex min-w-0 flex-1 snap-start',
                index < steps.length - 1 && 'pr-1 sm:pr-2'
              )}
            >
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick?.(index)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'group flex w-full min-w-[4.5rem] sm:min-w-0 flex-col items-center gap-1.5 rounded-lg px-1 py-2 transition-colors',
                  isClickable && 'cursor-pointer hover:bg-muted/60',
                  !isClickable && !isCurrent && 'cursor-default',
                  isCurrent && 'bg-primary/5'
                )}
              >
                <span className="relative flex w-full items-center justify-center">
                  {index > 0 && (
                    <span
                      className={cn(
                        'absolute right-1/2 top-1/2 hidden h-0.5 w-full -translate-y-1/2 sm:block',
                        isComplete || isCurrent ? 'bg-primary/40' : 'bg-border'
                      )}
                      aria-hidden
                    />
                  )}
                  <span
                    className={cn(
                      'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all',
                      isComplete && 'border-primary bg-primary text-primary-foreground',
                      isCurrent &&
                        'border-primary bg-background text-primary shadow-sm ring-2 ring-primary/20',
                      !isComplete &&
                        !isCurrent &&
                        'border-muted-foreground/25 bg-muted/40 text-muted-foreground'
                    )}
                  >
                    {isComplete ? (
                      <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                    ) : (
                      <Icon className="h-4 w-4" aria-hidden />
                    )}
                  </span>
                </span>
                <span className="w-full text-center leading-tight">
                  <span
                    className={cn(
                      'block text-[10px] sm:text-xs font-medium truncate px-0.5',
                      isCurrent ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="hidden sm:block text-[10px] text-muted-foreground truncate px-0.5">
                    {step.shortLabel}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
