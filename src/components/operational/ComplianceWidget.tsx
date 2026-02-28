import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ChevronDown,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useComplianceChecks, useRequestComplianceCheck } from '@/hooks/useComplianceChecks';
import type { ComplianceCheck } from '@/hooks/useComplianceChecks';

// ─────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ComplianceCheck['status'],
  { label: string; icon: typeof ShieldCheck; className: string }
> = {
  ok: {
    label: 'Conforme',
    icon: ShieldCheck,
    className:
      'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  },
  warning: {
    label: 'Atenção',
    icon: AlertTriangle,
    className:
      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  },
  violation: {
    label: 'Violação',
    icon: ShieldAlert,
    className:
      'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  },
};

// ─────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────

interface ComplianceWidgetProps {
  orderId: string;
}

export function ComplianceWidget({ orderId }: ComplianceWidgetProps) {
  const { data: checks, isLoading } = useComplianceChecks(orderId);
  const requestCheck = useRequestComplianceCheck();
  const [expanded, setExpanded] = useState(false);

  const latest = checks?.[0] ?? null;
  const statusConfig = latest ? STATUS_CONFIG[latest.status] : null;
  const StatusIcon = statusConfig?.icon ?? ShieldCheck;
  const violationCount = latest?.violations?.length ?? 0;

  const handleCheck = () => {
    requestCheck.mutate({ orderId, checkType: 'pre_contratacao' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg border bg-card p-3 space-y-3"
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-semibold">Compliance</span>
        </div>

        {latest && statusConfig && (
          <Badge variant="default" className={`text-[10px] gap-1 ${statusConfig.className}`}>
            <StatusIcon className="w-3 h-3" />
            {statusConfig.label}
          </Badge>
        )}
      </div>

      {/* Loading */}
      {(isLoading || requestCheck.isPending) && (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-xs">
            {requestCheck.isPending ? 'Verificando...' : 'Carregando...'}
          </span>
        </div>
      )}

      {/* Error */}
      {requestCheck.isError && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <p className="text-[11px] text-red-600 dark:text-red-400">
            {requestCheck.error?.message || 'Erro ao verificar compliance'}
          </p>
        </div>
      )}

      {/* Violation count */}
      {!isLoading && !requestCheck.isPending && latest && violationCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>
            {violationCount} violaç{violationCount === 1 ? 'ão' : 'ões'} encontrada
            {violationCount === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {/* Expandable details */}
      {!isLoading && !requestCheck.isPending && latest && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
            {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                key="details"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-1">
                  {/* Rules evaluated */}
                  {latest.rules_evaluated.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-medium">Regras Avaliadas</span>
                      <div className="space-y-1">
                        {latest.rules_evaluated.map((rule, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs">
                            {rule.passed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0">
                              <span className="text-muted-foreground">{rule.rule}</span>
                              {rule.detail && (
                                <p className="text-[10px] text-muted-foreground/70">
                                  {rule.detail}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Violations */}
                  {latest.violations.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-medium text-red-600 dark:text-red-400">
                          Violações
                        </span>
                        <div className="space-y-1.5">
                          {latest.violations.map((v, i) => (
                            <div
                              key={i}
                              className="p-2 rounded-lg bg-red-50/50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/50"
                            >
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <Badge
                                  variant="default"
                                  className={`text-[9px] ${
                                    v.severity === 'critical'
                                      ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400'
                                      : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                                  }`}
                                >
                                  {v.severity}
                                </Badge>
                                <span className="text-xs font-medium">{v.rule}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground">{v.detail}</p>
                              {v.remediation && (
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                                  Remediação: {v.remediation}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Timestamp */}
                  <p className="text-[10px] text-muted-foreground/60 text-right">
                    Última verificação:{' '}
                    {new Date(latest.created_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Action button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full h-7 text-xs gap-1.5"
        onClick={handleCheck}
        disabled={requestCheck.isPending}
      >
        {requestCheck.isPending ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Verificando...
          </>
        ) : (
          <>
            <ShieldCheck className="w-3 h-3" />
            Verificar Compliance
          </>
        )}
      </Button>
    </motion.div>
  );
}
