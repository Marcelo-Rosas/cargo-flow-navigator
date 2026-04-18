import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  overdueCount?: number;
}

export function TabButton({ active, onClick, label, count, overdueCount = 0 }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      )}
    >
      {label}
      {count !== undefined && <span className="text-xs opacity-90">({count})</span>}
      {overdueCount > 0 && (
        <Badge variant={active ? 'secondary' : 'destructive'} className="text-xs">
          {overdueCount} atrasados
        </Badge>
      )}
    </button>
  );
}
