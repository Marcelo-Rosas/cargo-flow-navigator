import { useState } from 'react';
import {
  FileText,
  Download,
  ExternalLink,
  Loader2,
  Save,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MaskedInput } from '@/components/ui/masked-input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { openDocument, downloadDocument } from '@/lib/storage';
import {
  useQuotePaymentProofsByQuote,
  useQuoteReconciliation,
  useUpdateQuotePaymentProofAmount,
} from '@/hooks/useQuotePaymentProofs';

const PROOF_LABELS: Record<string, { label: string; color: string }> = {
  a_vista: { label: 'À vista', color: 'bg-emerald-500/10 text-emerald-600' },
  adiantamento: { label: 'Adiantamento', color: 'bg-orange-500/10 text-orange-600' },
  saldo: { label: 'Saldo', color: 'bg-amber-500/10 text-amber-600' },
  a_prazo: { label: 'A prazo', color: 'bg-blue-500/10 text-blue-600' },
};

export function QuotePaymentProofList({ quoteId }: { quoteId: string }) {
  const { data: proofs, isLoading } = useQuotePaymentProofsByQuote(quoteId);
  const { data: reconciliation } = useQuoteReconciliation(quoteId);
  const updateMutation = useUpdateQuotePaymentProofAmount();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const isPendingConfirmation =
    !!reconciliation &&
    !reconciliation.is_reconciled &&
    reconciliation.proofs_count > 0 &&
    reconciliation.paid_amount === 0 &&
    Number(reconciliation.expected_amount) > 0;

  const handleSave = async (id: string) => {
    const cents = editValue.replace(/\D/g, '');
    const num = cents ? Number(cents) / 100 : NaN;
    if (isNaN(num) || num < 0) return toast.error('Informe um valor válido');
    try {
      await updateMutation.mutateAsync({ id, amount: num });
      toast.success('Valor salvo');
      setEditingId(null);
      setEditValue('');
    } catch {
      toast.error('Erro ao salvar valor');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reconciliation && Number(reconciliation.expected_amount) > 0 && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Esperado</p>
              <p className="font-semibold">
                {formatCurrency(Number(reconciliation.expected_amount))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recebido</p>
              <p className="font-semibold">{formatCurrency(Number(reconciliation.paid_amount))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Delta</p>
              <p
                className={cn(
                  'font-semibold',
                  reconciliation.is_reconciled ? 'text-success' : 'text-warning-foreground'
                )}
              >
                {formatCurrency(Number(reconciliation.delta_amount))}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            {reconciliation.is_reconciled ? (
              <span className="inline-flex items-center gap-1 text-success">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Conciliado
              </span>
            ) : isPendingConfirmation ? (
              <span className="inline-flex items-center gap-1 text-warning-foreground">
                <AlertCircle className="w-3.5 h-3.5" />
                Pendente confirmação
              </span>
            ) : reconciliation.proofs_count > 0 ? (
              <span className="inline-flex items-center gap-1 text-destructive">
                <XCircle className="w-3.5 h-3.5" />
                Divergente
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-warning-foreground">
                <AlertCircle className="w-3.5 h-3.5" />
                Pendente
              </span>
            )}
          </div>
        </div>
      )}

      {!proofs?.length && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum comprovante Doc Fat enviado.
        </p>
      )}

      {proofs?.map((proof) => {
        const info = PROOF_LABELS[proof.proof_type] ?? {
          label: proof.proof_type,
          color: 'bg-muted text-muted-foreground',
        };
        const isEditing = editingId === proof.id;
        return (
          <div
            key={proof.id}
            className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border"
          >
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <FileText className="w-4 h-4 text-primary" />
              <p className="text-sm truncate">{proof.document?.file_name ?? 'Documento'}</p>
              <Badge variant="secondary" className={cn('text-xs', info.color)}>
                {info.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <MaskedInput
                    mask="currency"
                    value={editValue}
                    onValueChange={(raw) => setEditValue(raw)}
                    className="w-28 h-8 text-sm"
                  />
                  <Button size="sm" className="h-8" onClick={() => handleSave(proof.id)}>
                    <Save className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={() => setEditingId(null)}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium">
                    {proof.amount != null ? formatCurrency(Number(proof.amount)) : '—'}
                    {proof.expected_amount != null && (
                      <span className="text-xs text-muted-foreground ml-1">
                        (esp. {formatCurrency(Number(proof.expected_amount))})
                      </span>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      setEditingId(proof.id);
                      setEditValue(
                        proof.amount != null ? String(Math.round(Number(proof.amount) * 100)) : ''
                      );
                    }}
                  >
                    {proof.amount != null ? 'Editar' : 'Informar valor'}
                  </Button>
                </>
              )}
              {proof.document?.file_url && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openDocument(proof.document!.file_url!)}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      downloadDocument(proof.document!.file_url!, proof.document!.file_name)
                    }
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
