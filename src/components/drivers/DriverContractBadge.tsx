import { ShieldAlert, ShieldCheck, BadgeAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type DriverContractType = 'proprio' | 'agregado' | 'terceiro';
export type RntrcRegistryType = 'TAC' | 'ETC' | null;

interface DriverContractBadgeProps {
  contractType: DriverContractType | null | undefined;
  rntrcRegistryType: RntrcRegistryType | undefined;
  className?: string;
}

/**
 * Badge que descreve o vínculo do motorista e a obrigatoriedade de CIOT.
 *
 * Regras (Lei 11.442/07 + Resolução ANTT 5.862/19):
 * - `proprio` (frota Vectra): não exige CIOT — não renderiza badge
 * - `agregado` ou `terceiro`:
 *     - TAC → CIOT obrigatório (amber)
 *     - ETC → CIOT dispensado (azul)
 *     - sem RNTRC → ALERTA vermelho (cadastro deve sempre ter RNTRC)
 */
export function DriverContractBadge({
  contractType,
  rntrcRegistryType,
  className,
}: DriverContractBadgeProps) {
  if (!contractType || contractType === 'proprio') return null;

  const contractLabel = contractType === 'agregado' ? 'Agregado' : 'Terceiro';

  // RNTRC ausente — anomalia que deve aparecer alta
  if (!rntrcRegistryType) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'text-xs w-fit gap-1 text-destructive border-destructive/40 bg-destructive/10',
          className
        )}
      >
        <BadgeAlert className="w-3 h-3" />
        {contractLabel} — RNTRC não informado
      </Badge>
    );
  }

  if (rntrcRegistryType === 'TAC') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'text-xs w-fit gap-1 text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400',
          className
        )}
      >
        <ShieldAlert className="w-3 h-3" />
        TAC {contractLabel} — CIOT obrigatório
      </Badge>
    );
  }

  // ETC
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs w-fit gap-1 text-sky-700 border-sky-300 bg-sky-50 dark:bg-sky-950/20 dark:text-sky-400',
        className
      )}
    >
      <ShieldCheck className="w-3 h-3" />
      ETC {contractLabel} — CIOT dispensado
    </Badge>
  );
}
