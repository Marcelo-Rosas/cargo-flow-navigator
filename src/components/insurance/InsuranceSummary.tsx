import { Badge } from '@/components/ui/badge';
import { Check, AlertCircle, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface InsuranceSummaryProps {
  coverage: string;
  premium: number;
  features: string[];
  restrictions?: string[];
  status?: 'pending' | 'active' | 'concluded' | 'inactive';
  policyNumber?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  compact?: boolean;
}

const statusConfig = {
  pending: {
    label: 'Pendente',
    bg: 'bg-yellow-50 dark:bg-yellow-950/20',
    text: 'text-yellow-700 dark:text-yellow-400',
  },
  active: {
    label: 'Ativa',
    bg: 'bg-green-50 dark:bg-green-950/20',
    text: 'text-green-700 dark:text-green-400',
  },
  concluded: {
    label: 'Concluída',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    text: 'text-blue-700 dark:text-blue-400',
  },
  inactive: {
    label: 'Inativa',
    bg: 'bg-gray-50 dark:bg-gray-950/20',
    text: 'text-gray-700 dark:text-gray-400',
  },
};

const riskLevelConfig = {
  low: {
    label: 'Baixo Risco',
    badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  },
  medium: {
    label: 'Risco Médio',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
  },
  high: { label: 'Alto Risco', badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' },
};

export function InsuranceSummary({
  coverage,
  premium,
  features,
  restrictions = [],
  status = 'pending',
  policyNumber,
  riskLevel,
  compact = false,
}: InsuranceSummaryProps) {
  const statusInfo = statusConfig[status];
  const riskInfo = riskLevel && riskLevelConfig[riskLevel];

  if (compact) {
    // Inline summary for quick display
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Cobertura {coverage}</span>
          </div>
          <Badge variant="outline" className={cn(statusInfo.text, statusInfo.bg, 'border-0')}>
            {statusInfo.label}
          </Badge>
        </div>
        <div className="text-sm">
          <p className="text-muted-foreground">Prêmio:</p>
          <p className="text-lg font-bold text-primary">{formatCurrency(premium)}</p>
        </div>
      </div>
    );
  }

  // Full summary
  return (
    <div className={cn('rounded-lg border p-4 space-y-4', statusInfo.bg)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Cobertura {coverage}
          </h3>
          {policyNumber && (
            <p className="text-xs text-muted-foreground mt-1 font-mono">Apólice: {policyNumber}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge className={cn(statusInfo.text, statusInfo.bg, 'border-0')}>
            {statusInfo.label}
          </Badge>
          {riskInfo && (
            <Badge variant="outline" className={riskInfo.badge}>
              {riskInfo.label}
            </Badge>
          )}
        </div>
      </div>

      {/* Premium */}
      <div className="bg-white/50 dark:bg-black/20 p-3 rounded">
        <p className="text-xs text-muted-foreground mb-1">Prêmio Estimado</p>
        <p className="text-2xl font-bold text-primary">{formatCurrency(premium)}</p>
      </div>

      {/* Features */}
      <div>
        <h4 className="text-sm font-medium mb-2">Cobertura Inclusa:</h4>
        <ul className="space-y-1.5">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Restrictions */}
      {restrictions.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            <div className="space-y-1">
              <p className="text-xs font-medium mb-1">Limitações:</p>
              <ul className="text-xs space-y-0.5">
                {restrictions.map((restriction, idx) => (
                  <li key={idx}>• {restriction}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
