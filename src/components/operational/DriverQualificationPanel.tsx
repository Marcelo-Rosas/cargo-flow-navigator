import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  UserCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  useDriverQualification,
  useRequestDriverQualification,
  useDecideDriverQualification,
} from '@/hooks/useDriverQualification';
import type { DriverQualification } from '@/hooks/useDriverQualification';

// ─────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DriverQualification['status'], { label: string; className: string }> = {
  aprovado: {
    label: 'Aprovado',
    className:
      'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  },
  em_analise: {
    label: 'Em Análise',
    className:
      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  },
  bloqueado: {
    label: 'Bloqueado',
    className:
      'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  },
  reprovado: {
    label: 'Reprovado',
    className:
      'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  },
  pendente: {
    label: 'Pendente',
    className:
      'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
  },
};

// ─────────────────────────────────────────────────────
// Risk Score Gauge
// ─────────────────────────────────────────────────────

function RiskScoreGauge({ score }: { score: number }) {
  const color =
    score >= 70
      ? 'text-emerald-600 dark:text-emerald-400'
      : score >= 40
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  const ringColor =
    score >= 70 ? 'stroke-emerald-500' : score >= 40 ? 'stroke-amber-500' : 'stroke-red-500';

  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
        <circle cx="44" cy="44" r="36" fill="none" strokeWidth="6" className="stroke-muted/30" />
        <motion.circle
          cx="44"
          cy="44"
          r="36"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={ringColor}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          strokeDasharray={circumference}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold ${color}`}>{score}</span>
        <span className="text-[10px] text-muted-foreground">Score</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Severity badge for risk flags
// ─────────────────────────────────────────────────────

const SEVERITY_CLASSES: Record<string, string> = {
  critical:
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  warning:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  info: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
};

// ─────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────

interface DriverQualificationPanelProps {
  orderId: string;
  canManage?: boolean;
}

export function DriverQualificationPanel({ orderId, canManage }: DriverQualificationPanelProps) {
  const { data: qualification, isLoading } = useDriverQualification(orderId);
  const requestQualification = useRequestDriverQualification();
  const decideQualification = useDecideDriverQualification();

  const handleAnalyze = () => {
    const cpf = qualification?.driver_cpf ?? '';
    requestQualification.mutate({ orderId, driverCpf: cpf });
  };

  const handleDecision = (decision: 'aprovado' | 'reprovado') => {
    if (!qualification) return;
    decideQualification.mutate({
      qualificationId: qualification.id,
      orderId,
      decision,
    });
  };

  const statusConfig = qualification ? STATUS_CONFIG[qualification.status] : null;

  return (
    <div className="space-y-4">
      <Separator />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-sm font-semibold">Qualificação do Motorista</h3>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={handleAnalyze}
          disabled={requestQualification.isPending}
        >
          {requestQualification.isPending ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <Brain className="w-3 h-3" />
              Analisar
            </>
          )}
        </Button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* Loading */}
        {(isLoading || requestQualification.isPending) && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-8 text-muted-foreground"
          >
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Carregando qualificação...</span>
          </motion.div>
        )}

        {/* Error */}
        {requestQualification.isError && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          >
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400">
              Erro ao analisar: {requestQualification.error?.message || 'Tente novamente'}
            </p>
          </motion.div>
        )}

        {/* Empty state */}
        {!isLoading && !requestQualification.isPending && !qualification && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-6"
          >
            <ShieldQuestion className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">Nenhuma qualificação realizada.</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Clique em &quot;Analisar&quot; para iniciar a qualificação.
            </p>
          </motion.div>
        )}

        {/* Qualification data */}
        {!isLoading && !requestQualification.isPending && qualification && (
          <motion.div
            key="data"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Score + Status row */}
            <div className="flex items-center gap-4">
              {qualification.risk_score !== null && (
                <RiskScoreGauge score={qualification.risk_score} />
              )}

              <div className="flex-1 space-y-2">
                {qualification.driver_name && (
                  <p className="text-sm font-medium">{qualification.driver_name}</p>
                )}
                {qualification.driver_cpf && (
                  <p className="text-xs text-muted-foreground">CPF: {qualification.driver_cpf}</p>
                )}
                {statusConfig && (
                  <Badge variant="default" className={`text-[10px] ${statusConfig.className}`}>
                    {statusConfig.label}
                  </Badge>
                )}
              </div>
            </div>

            {/* Checklist grid */}
            {qualification.checklist && Object.keys(qualification.checklist).length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-medium">Checklist</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(qualification.checklist).map(([key, passed]) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs">
                      {passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                      <span className="text-muted-foreground truncate">
                        {key.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk flags */}
            {qualification.risk_flags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-xs font-medium">Alertas de Risco</span>
                </div>
                <div className="space-y-1.5">
                  {qualification.risk_flags.map((flag, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2 rounded-lg bg-muted/40 border border-border/50"
                    >
                      <Badge
                        variant="default"
                        className={`text-[9px] shrink-0 ${SEVERITY_CLASSES[flag.severity] || SEVERITY_CLASSES.info}`}
                      >
                        {flag.severity}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{flag.flag}</p>
                        {flag.detail && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{flag.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            {canManage &&
              qualification.status !== 'aprovado' &&
              qualification.status !== 'reprovado' && (
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                    onClick={() => handleDecision('aprovado')}
                    disabled={decideQualification.isPending}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Aprovar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                    onClick={() => handleDecision('reprovado')}
                    disabled={decideQualification.isPending}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Reprovar
                  </Button>
                </div>
              )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
