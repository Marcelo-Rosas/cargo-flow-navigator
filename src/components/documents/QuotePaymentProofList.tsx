import { useMemo, useState } from 'react';
import {
  FileText,
  Download,
  ExternalLink,
  Loader2,
  Save,
  Trash2,
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
import { useDocumentsByQuote, useDeleteDocument } from '@/hooks/useDocuments';
import {
  useQuotePaymentProofsByQuote,
  useQuoteReconciliation,
  useUpsertQuotePaymentProofAmount,
  useUpdateQuotePaymentProofAmount,
  useUpdatePaymentProofDeltaReason,
  useProcessQuotePaymentProof,
} from '@/hooks/useQuotePaymentProofs';
import type { Database } from '@/integrations/supabase/types';

type DocumentType = Database['public']['Enums']['document_type'];

const DOC_FAT_TYPES: DocumentType[] = [
  'a_vista_fat' as DocumentType,
  'adiantamento',
  'saldo_fat' as DocumentType,
  'a_prazo_fat' as DocumentType,
];

const DOC_TYPE_TO_PROOF_TYPE: Record<string, 'a_vista' | 'adiantamento' | 'saldo' | 'a_prazo'> = {
  a_vista_fat: 'a_vista',
  adiantamento: 'adiantamento',
  saldo_fat: 'saldo',
  a_prazo_fat: 'a_prazo',
};

const PROOF_LABELS: Record<string, { label: string; color: string }> = {
  a_vista: { label: 'À vista', color: 'bg-emerald-500/10 text-emerald-600' },
  adiantamento: { label: 'Adiantamento', color: 'bg-orange-500/10 text-orange-600' },
  saldo: { label: 'Saldo', color: 'bg-amber-500/10 text-amber-600' },
  a_prazo: { label: 'A prazo', color: 'bg-blue-500/10 text-blue-600' },
};

const DELTA_REASONS = [
  { value: 'mao_de_obra', label: 'Abatimento mão de obra' },
  { value: 'avaria', label: 'Desconto por avaria' },
  { value: 'atraso', label: 'Desconto por atraso' },
  { value: 'negociacao', label: 'Renegociação comercial' },
  { value: 'taxa_banco', label: 'Taxa bancária' },
  { value: 'arredondamento', label: 'Arredondamento' },
  { value: 'outro', label: 'Outro' },
] as const;

export function QuotePaymentProofList({ quoteId }: { quoteId: string }) {
  const { data: proofs, isLoading: isLoadingProofs } = useQuotePaymentProofsByQuote(quoteId);
  const { data: quoteDocuments, isLoading: isLoadingDocuments } = useDocumentsByQuote(quoteId);
  const { data: reconciliation } = useQuoteReconciliation(quoteId);
  const updateMutation = useUpdateQuotePaymentProofAmount();
  const upsertMutation = useUpsertQuotePaymentProofAmount();
  const processProofMutation = useProcessQuotePaymentProof();
  const deltaReasonMutation = useUpdatePaymentProofDeltaReason();
  const deleteDocMutation = useDeleteDocument();
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));

  const docFatDocuments = useMemo(
    () => (quoteDocuments ?? []).filter((doc) => DOC_FAT_TYPES.includes(doc.type as DocumentType)),
    [quoteDocuments]
  );

  const proofByDocumentId = useMemo(
    () => new Map((proofs ?? []).map((proof) => [proof.document_id, proof])),
    [proofs]
  );

  const isPendingConfirmation =
    !!reconciliation &&
    !reconciliation.is_reconciled &&
    reconciliation.proofs_count > 0 &&
    reconciliation.paid_amount === 0 &&
    Number(reconciliation.expected_amount) > 0;

  const isSaving = updateMutation.isPending || upsertMutation.isPending;

  // Build per proof-type line breakdown (adiantamento, saldo, a_vista, a_prazo)
  const proofLines = useMemo(() => {
    const lines = new Map<
      string,
      {
        proofType: string;
        expected: number | null;
        received: number | null;
        deltaReason: string | null;
        proofIds: string[];
      }
    >();
    for (const proof of proofs ?? []) {
      const pt = proof.proof_type;
      const existing = lines.get(pt) ?? {
        proofType: pt,
        expected: null,
        received: null,
        deltaReason: null,
        proofIds: [],
      };
      existing.expected = (existing.expected ?? 0) + Number(proof.expected_amount ?? 0);
      existing.received = (existing.received ?? 0) + Number(proof.amount ?? 0);
      if (proof.delta_reason) existing.deltaReason = proof.delta_reason;
      existing.proofIds.push(proof.id);
      lines.set(pt, existing);
    }
    // Order: adiantamento, saldo, a_vista, a_prazo
    const order = ['adiantamento', 'saldo', 'a_vista', 'a_prazo'];
    return order.filter((pt) => lines.has(pt)).map((pt) => lines.get(pt)!);
  }, [proofs]);

  const handleDeltaReasonChange = async (proofIds: string[], reason: string) => {
    const value = reason || null;
    try {
      await Promise.all(
        proofIds.map((id) => deltaReasonMutation.mutateAsync({ id, deltaReason: value }))
      );
      toast.success('Motivo salvo');
    } catch {
      toast.error('Erro ao salvar motivo');
    }
  };

  const handleStartEdit = (documentId: string, amount: number | null) => {
    setEditingDocumentId(documentId);
    setEditValue(amount != null ? String(Math.round(Number(amount) * 100)) : '');
  };

  const handleCancelEdit = () => {
    setEditingDocumentId(null);
    setEditValue('');
  };

  const handleSave = async (
    documentId: string,
    documentType: string,
    existingProofId: string | undefined
  ) => {
    const cents = editValue.replace(/\D/g, '');
    const num = cents ? Number(cents) / 100 : NaN;
    if (isNaN(num) || num < 0) return toast.error('Informe um valor válido');
    try {
      if (existingProofId) {
        await updateMutation.mutateAsync({ id: existingProofId, amount: num });
      } else {
        // Call Edge Function first so expected_amount is always computed
        const result = await processProofMutation.mutateAsync(documentId);
        const proofId = (result as { quotePaymentProofId?: string })?.quotePaymentProofId;
        if (proofId) {
          await updateMutation.mutateAsync({ id: proofId, amount: num });
        } else {
          await upsertMutation.mutateAsync({
            quoteId,
            documentId,
            proofType: DOC_TYPE_TO_PROOF_TYPE[documentType] ?? 'a_prazo',
            amount: num,
          });
        }
      }
      toast.success('Valor recebido salvo');
      handleCancelEdit();
    } catch {
      toast.error('Erro ao salvar valor');
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!window.confirm('Excluir este documento? Esta ação não pode ser desfeita.')) return;
    try {
      await deleteDocMutation.mutateAsync(docId);
      toast.success('Documento excluído');
    } catch {
      toast.error('Erro ao excluir documento');
    }
  };

  if (isLoadingProofs || isLoadingDocuments) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Per-line reconciliation breakdown */}
      {reconciliation && Number(reconciliation.expected_amount) > 0 && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Conciliação de Recebimento</h4>
            {reconciliation.is_reconciled ? (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Conciliado
              </span>
            ) : isPendingConfirmation ? (
              <span className="inline-flex items-center gap-1 text-xs text-warning-foreground">
                <AlertCircle className="w-3.5 h-3.5" />
                Pendente confirmação
              </span>
            ) : reconciliation.proofs_count > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs text-destructive">
                <XCircle className="w-3.5 h-3.5" />
                Divergente
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-warning-foreground">
                <AlertCircle className="w-3.5 h-3.5" />
                Pendente
              </span>
            )}
          </div>

          {/* Per proof-type lines */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-1 font-medium">Parcela</th>
                  <th className="text-right py-1 font-medium">Esperado</th>
                  <th className="text-right py-1 font-medium">Recebido</th>
                  <th className="text-right py-1 font-medium">Delta</th>
                  <th className="text-left py-1 pl-2 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {proofLines.map((line) => {
                  const delta = (line.received ?? 0) - (line.expected ?? 0);
                  const hasDelta = Math.abs(delta) > 1;
                  return (
                    <tr key={line.proofType} className="border-b last:border-0">
                      <td className="py-1.5">
                        <Badge
                          variant="secondary"
                          className={cn('text-xs', PROOF_LABELS[line.proofType]?.color)}
                        >
                          {PROOF_LABELS[line.proofType]?.label ?? line.proofType}
                        </Badge>
                      </td>
                      <td className="text-right py-1.5 font-medium">
                        {line.expected != null ? formatCurrency(line.expected) : '—'}
                      </td>
                      <td className="text-right py-1.5 font-medium">
                        {line.received != null ? formatCurrency(line.received) : '—'}
                      </td>
                      <td
                        className={cn(
                          'text-right py-1.5 font-semibold',
                          hasDelta ? 'text-destructive' : 'text-success'
                        )}
                      >
                        {line.received != null ? formatCurrency(delta) : '—'}
                      </td>
                      <td className="py-1.5 pl-2">
                        {hasDelta && (
                          <select
                            className="text-xs border rounded px-1 py-0.5 bg-background"
                            value={line.deltaReason ?? ''}
                            onChange={(e) => handleDeltaReasonChange(line.proofIds, e.target.value)}
                            disabled={deltaReasonMutation.isPending}
                          >
                            <option value="">Selecionar...</option>
                            {DELTA_REASONS.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold border-t">
                  <td className="py-1.5">Total</td>
                  <td className="text-right py-1.5">
                    {formatCurrency(Number(reconciliation.expected_amount))}
                  </td>
                  <td className="text-right py-1.5">
                    {formatCurrency(Number(reconciliation.paid_amount))}
                  </td>
                  <td
                    className={cn(
                      'text-right py-1.5',
                      reconciliation.is_reconciled ? 'text-success' : 'text-destructive'
                    )}
                  >
                    {formatCurrency(Number(reconciliation.delta_amount))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!docFatDocuments.length && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum comprovante Doc Fat enviado.
        </p>
      )}

      {docFatDocuments.map((doc) => {
        const proof = proofByDocumentId.get(doc.id);
        const proofType = proof?.proof_type ?? DOC_TYPE_TO_PROOF_TYPE[doc.type] ?? 'a_prazo';
        const info = PROOF_LABELS[proofType] ?? {
          label: proofType,
          color: 'bg-muted text-muted-foreground',
        };
        const amount = proof?.amount != null ? Number(proof.amount) : null;
        const expectedAmount =
          proof?.expected_amount != null ? Number(proof.expected_amount) : null;
        const lineDelta = amount != null && expectedAmount != null ? amount - expectedAmount : null;
        const isEditing = editingDocumentId === doc.id;
        return (
          <div
            key={doc.id}
            className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <FileText className="w-4 h-4 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium truncate">{doc.file_name ?? 'Documento'}</p>
                  <Badge variant="secondary" className={cn('text-xs', info.color)}>
                    {info.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(doc.created_at)}
                  {lineDelta != null && (
                    <span
                      className={cn(
                        'ml-2',
                        Math.abs(lineDelta) <= 1 ? 'text-success' : 'text-destructive'
                      )}
                    >
                      Delta: {formatCurrency(lineDelta)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <MaskedInput
                    mask="currency"
                    value={editValue}
                    onValueChange={(raw) => setEditValue(raw)}
                    className="w-28 h-8 text-sm"
                    placeholder="0,00"
                  />
                  <Button
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => handleSave(doc.id, doc.type, proof?.id)}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={handleCancelEdit}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium min-w-[100px] text-right">
                    {amount != null ? formatCurrency(amount) : '—'}
                    {expectedAmount != null && (
                      <span className="text-xs text-muted-foreground ml-1">
                        (esp. {formatCurrency(expectedAmount)})
                      </span>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => handleStartEdit(doc.id, amount)}
                  >
                    {amount != null ? 'Editar' : 'Informar valor'}
                  </Button>
                </>
              )}
              {doc.file_url && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openDocument(doc.file_url)}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => downloadDocument(doc.file_url, doc.file_name)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleDeleteDoc(doc.id)}
                disabled={deleteDocMutation.isPending}
                title="Excluir documento"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
