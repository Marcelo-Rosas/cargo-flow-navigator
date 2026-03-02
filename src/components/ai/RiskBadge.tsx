// src/components/ai/RiskBadge.tsx
import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const RISK_CONFIG = {
  baixo: {
    icon: ShieldCheck,
    label: 'Risco Baixo',
    variant: 'default' as const,
    className:
      'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  },
  medio: {
    icon: ShieldQuestion,
    label: 'Risco Médio',
    variant: 'default' as const,
    className:
      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  },
  alto: {
    icon: ShieldAlert,
    label: 'Risco Alto',
    variant: 'default' as const,
    className:
      'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  },
} as const;

interface RiskBadgeProps {
  risk?: string;
}

export function RiskBadge({ risk = 'medio' }: RiskBadgeProps) {
  const config = RISK_CONFIG[risk as keyof typeof RISK_CONFIG] || RISK_CONFIG.medio;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}
