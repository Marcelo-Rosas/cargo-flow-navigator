import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface SectionBlockProps {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Ação no cabeçalho (ex.: botão Adicionar). */
  action?: React.ReactNode;
  /** `card` agrupa campos em painel (wizard de cotação). */
  variant?: 'plain' | 'card';
  /** When true, section is collapsible. */
  collapsible?: boolean;
  /** Default open state when collapsible. */
  defaultOpen?: boolean;
}

export function SectionBlock({
  label,
  children,
  className,
  action,
  variant = 'plain',
  collapsible = false,
  defaultOpen = true,
}: SectionBlockProps) {
  const labelEl = (
    <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
      <span
        className={cn(
          'font-semibold text-muted-foreground',
          variant === 'card' ? 'text-sm text-foreground' : 'text-xs uppercase tracking-wider'
        )}
      >
        {label}
      </span>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );

  const body = (
    <>
      {labelEl}
      {children}
    </>
  );

  const shellClass = cn(
    variant === 'card' &&
      'rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-sm space-y-4',
    variant === 'plain' && 'space-y-2',
    className
  );

  if (collapsible) {
    return (
      <Collapsible defaultOpen={defaultOpen} className={cn('group', shellClass)}>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 py-0.5 rounded hover:bg-muted/40 transition-colors group -mx-0.5 px-0.5">
          {labelEl}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-1">{children}</CollapsibleContent>
      </Collapsible>
    );
  }

  return <div className={shellClass}>{body}</div>;
}
