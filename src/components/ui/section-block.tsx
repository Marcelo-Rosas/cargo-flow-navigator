import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface SectionBlockProps {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** When true, section is collapsible. */
  collapsible?: boolean;
  /** Default open state when collapsible. */
  defaultOpen?: boolean;
}

export function SectionBlock({
  label,
  children,
  className,
  collapsible = false,
  defaultOpen = true,
}: SectionBlockProps) {
  const labelEl = (
    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
  );

  if (collapsible) {
    return (
      <Collapsible defaultOpen={defaultOpen} className={cn('group space-y-2', className)}>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 py-1 -mx-1 rounded hover:bg-muted/50 transition-colors group">
          {labelEl}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>{children}</CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {labelEl}
      {children}
    </div>
  );
}
