import { cn } from '@/lib/utils';

interface SectionBlockProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionBlock({ label, children, className }: SectionBlockProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
