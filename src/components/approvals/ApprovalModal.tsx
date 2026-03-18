import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useQuery } from '@tanstack/react-query';
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
import { supabase } from '@/integrations/supabase/client';
import { useEntityInsights, useRequestAiAnalysis } from '@/hooks/useAiInsights';

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
  const requestAi = useRequestAiAnalysis();
  const requestedForRef = useRef<string | null>(null);

  const { data: insights = [], isLoading: isInsightsLoading } = useEntityInsights(
    approval?.entity_type ?? '',
    approval?.entity_id ?? ''
  );

  const quoteUuidFromDescription = useMemo(() => {
    const desc = approval?.description;
    if (!desc) return null;
    const m = desc.match(/Quote\s+([0-9a-fA-F-]{36})/);
    return m?.[1] ?? null;
  }, [approval?.description]);

  const { data: quoteCode } = useQuery({
    queryKey: ['approval-quote-code', quoteUuidFromDescription],
    enabled: open && !!quoteUuidFromDescription,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes' as 'documents')
        .select('quote_code')
        .eq('id', quoteUuidFromDescription!)
        .maybeSingle();

      if (error) return null;
      return (data as unknown as { quote_code: string } | null)?.quote_code ?? null;
    },
  });

  const aiAnalysis = approval?.ai_analysis ?? insights?.[0]?.analysis ?? null;
  const risk = (aiAnalysis?.risk as string) || 'medio';
  const RiskIcon = riskIcons[risk] || AlertTriangle;
  const recommendation = (aiAnalysis?.recommendation as string) || null;
  const summary = (aiAnalysis?.summary as string) || null;
  const metrics = (aiAnalysis?.metrics as Record<string, unknown>) || null;
  const renderedDescription = useMemo(() => {
    const desc = approval?.description ?? null;
    const uuid = quoteUuidFromDescription;
    if (!desc || !uuid || !quoteCode) return desc;
    // Matches UI pattern currently stored: "Quote <uuid> ..."
    return desc.replace(`Quote ${uuid}`, `Quote ${quoteCode}`);
  }, [approval?.description, quoteUuidFromDescription, quoteCode]);

  useEffect(() => {
    if (!open) return;
    if (!approval) return;
    if (approval.status !== 'pending') return;
    if (aiAnalysis) return;
    if (requestAi.isPending) return;
    if (isInsightsLoading) return;

    if (!approval.entity_type || !approval.entity_id) return;
    if (requestedForRef.current === approval.id) return;

    requestedForRef.current = approval.id;
    requestAi.mutate({
      analysisType: 'approval_summary',
      entityId: approval.entity_id,
      entityType: approval.entity_type,
    });
  }, [
    open,
    approval?.id,
    approval?.status,
    aiAnalysis,
    requestAi.isPending,
    requestAi.mutate,
    approval?.entity_type,
    approval?.entity_id,
    insights?.length,
    isInsightsLoading,
  ]);

  const handleDecision = (decision: 'approved' | 'rejected') => {
    if (!approval) return;
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

  const isPending = approval?.status === 'pending';

  if (!approval) return null;

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
          {renderedDescription && (
            <p className="text-sm text-muted-foreground">{renderedDescription}</p>
          )}

          <Separator />

          {/* AI Analysis Section */}
          {aiAnalysis ? (
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
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${riskColors[risk]}`}
                >
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
                          ? key.includes('revenue') ||
                            key.includes('margin') ||
                            key.includes('amount')
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
          ) : requestAi.isPending ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Gerando análise AI...
            </div>
          ) : requestAi.error ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-sm text-red-700 border border-red-200">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">Falha ao gerar análise AI</p>
                <p className="text-xs text-red-600">
                  {requestAi.error instanceof Error
                    ? requestAi.error.message
                    : String(requestAi.error)}
                </p>
              </div>
            </div>
          ) : (
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
              disabled={decide.isPending || requestAi.isPending}
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
              disabled={decide.isPending || requestAi.isPending}
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
