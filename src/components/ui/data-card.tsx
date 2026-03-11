import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type DataCardVariant = 'default' | 'primary' | 'success' | 'destructive' | 'warning';

const VARIANT_CLASSES: Record<DataCardVariant, string> = {
  default: 'bg-muted/30 border-border',
  primary: 'bg-primary/5 border-primary/20',
  success: 'bg-success/5 border-success/20',
  destructive: 'bg-destructive/5 border-destructive/20',
  warning: 'bg-amber-500/5 border-amber-500/20',
};

interface DataCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  variant?: DataCardVariant;
  className?: string;
}

export function DataCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
  className,
}: DataCardProps) {
  return (
    <div className={cn('p-2.5 rounded-lg border', VARIANT_CLASSES[variant], className)}>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        <span className="text-[10px] truncate">{label}</span>
      </div>
      <div className="font-semibold text-sm leading-tight">{value}</div>
    </div>
  );
}
