// src/components/financial/modal-sections/FinancialClientHeader.tsx
import { Building2 } from 'lucide-react';

interface FinancialClientHeaderProps {
  name: string;
  shipperName?: string | null;
}

export function FinancialClientHeader({ name, shipperName }: FinancialClientHeaderProps) {
  return (
    <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-2">
      <div className="flex items-center gap-3">
        <Building2 className="w-5 h-5 text-primary shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground">Cliente</p>
          <p className="font-semibold">{name}</p>
        </div>
      </div>
      {shipperName && (
        <div className="pl-8">
          <p className="text-xs text-muted-foreground">Embarcador</p>
          <p className="text-sm font-medium">{shipperName}</p>
        </div>
      )}
    </div>
  );
}
