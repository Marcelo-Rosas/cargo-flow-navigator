import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  ShieldX,
  Brain,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import { useDecideApproval, type ApprovalRequest } from '@/hooks/useApprovalRequests';
import { useEntityInsights } from '@/hooks/useAiInsights';

interface Props {
  approval: ApprovalRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const riskColors: Record<string, string> = {
  baixo: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  medio: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  alto: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const riskIcons: Record<string, typeof CheckCircle2> = {
  baixo: CheckCircle2,
  medio: AlertTriangle,
  alto: XCircle,
};

export function ApprovalModal({ approval, open, onOpenChange }: Props) {
  const [notes, setNotes] = useState('');
  const decide = useDecideApproval();

  const { data: insights = [] } = useEntityInsights(
    approval?.entity_type ?? '',
    approval?.entity_id ?? ''
  );

  if (!approval) return null;

  const aiAnalysis = approval.ai_analysis ?? insights?.[0]?.analysis ?? null;
  const risk = (aiAnalysis?.risk as string) || 'medio';
  const RiskIcon = riskIcons[risk] || AlertTriangle;
  const recommendation = (aiAnalysis?.recommendation as string) || null;
  const summary = (aiAnalysis?.summary as string) || null;
  const metrics = (aiAnalysis?.metrics as Record<string, unknown>) || null;

  const handleDecision = (decision: 'approved' | 'rejected') => {
    decide.mutate(
      { id: approval.id, decision, notes },
      {
        onSuccess: () => {
          setNotes('');
          onOpenChange(false);
        },
      }
    );
  };

  const isPending = approval.status === 'pending';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            {approval.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status & Type badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{approval.approval_type}</Badge>
            <Badge variant="outline" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              {new Date(approval.created_at).toLocaleDateString('pt-BR')}
            </Badge>
            {approval.status !== 'pending' && (
              <Badge
                className={
                  approval.status === 'approved'
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                }
              >
                {approval.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
              </Badge>
            )}
          </div>

          {/* Description */}
          {approval.description && (
            <p className="text-sm text-muted-foreground">{approval.description}</p>
          )}

          <Separator />

          {/* AI Analysis Section */}
          {aiAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                  Análise AI
                </span>
              </div>

              {/* Risk Badge */}
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${riskColors[risk]}`}>
                  <RiskIcon className="w-3.5 h-3.5" />
                  Risco {risk}
                </div>
              </div>

              {/* Summary */}
              {summary && (
                <p className="text-sm text-foreground bg-muted/50 p-3 rounded-lg">{summary}</p>
              )}

              {/* Key Metrics */}
              {metrics && Object.keys(metrics).length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(metrics).map(([key, val]) => (
                    <div key={key} className="p-2 rounded-md bg-muted/30 border">
                      <p className="text-[10px] uppercase text-muted-foreground tracking-wide">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className="text-sm font-semibold">
                        {typeof val === 'number'
                          ? key.includes('revenue') || key.includes('margin') || key.includes('amount')
                            ? formatCurrency(val)
                            : val.toFixed(1)
                          : String(val)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendation */}
              {recommendation && (
                <div className="flex gap-2 p-3 rounded-lg border-l-4 border-violet-400 bg-violet-50 dark:bg-violet-950/20">
                  <p className="text-sm text-violet-800 dark:text-violet-300">
                    <strong>Recomendação:</strong> {recommendation}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {!aiAnalysis && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <Brain className="w-4 h-4" />
              Análise AI ainda não disponível para esta solicitação.
            </div>
          )}

          {/* Decision Notes */}
          {isPending && (
            <>
              <Separator />
              <div>
                <label className="text-sm font-medium">Notas da decisão (opcional)</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicione observações sobre a decisão..."
                  className="mt-1.5"
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Decision notes (if already decided) */}
          {!isPending && approval.decision_notes && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground mb-1">Notas da decisão</p>
              <p className="text-sm">{approval.decision_notes}</p>
            </div>
          )}
        </div>

        {isPending && (
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => handleDecision('rejected')}
              disabled={decide.isPending}
            >
              {decide.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <ShieldX className="w-4 h-4 mr-1" />
              )}
              Rejeitar
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleDecision('approved')}
              disabled={decide.isPending}
            >
              {decide.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <ShieldCheck className="w-4 h-4 mr-1" />
              )}
              Aprovar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
