import type { QuoteWizardStepConfig } from './quote-wizard-steps';

interface QuoteWizardStepHeaderProps {
  step: QuoteWizardStepConfig;
  routeHint?: string | null;
}

export function QuoteWizardStepHeader({ step, routeHint }: QuoteWizardStepHeaderProps) {
  const Icon = step.icon;

  return (
    <header className="mb-5 space-y-2">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-base font-semibold leading-tight text-foreground">{step.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
        </div>
      </div>
      {routeHint ? (
        <p className="text-xs rounded-md border border-dashed bg-muted/40 px-3 py-2 text-muted-foreground">
          <span className="font-medium text-foreground">Rota em andamento:</span> {routeHint}
        </p>
      ) : null}
    </header>
  );
}
