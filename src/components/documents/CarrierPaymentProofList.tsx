import { useState } from 'react';
import { FileText, Download, ExternalLink, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MaskedInput } from '@/components/ui/masked-input';
import { usePaymentProofsByOrder, useUpdatePaymentProofAmount } from '@/hooks/usePaymentProofs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { openDocument, downloadDocument } from '@/lib/storage';

const PROOF_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  adiantamento: { label: 'Adiantamento', color: 'bg-orange-500/10 text-orange-600' },
  saldo: { label: 'Saldo', color: 'bg-orange-500/10 text-orange-600' },
  outros: { label: 'Outros', color: 'bg-muted text-muted-foreground' },
};

interface CarrierPaymentProofListProps {
  orderId: string;
}

export function CarrierPaymentProofList({ orderId }: CarrierPaymentProofListProps) {
  const { data: proofs, isLoading } = usePaymentProofsByOrder(orderId);
  const updateAmountMutation = useUpdatePaymentProofAmount();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));

  const handleStartEdit = (proof: { id: string; amount: number | null }) => {
    setEditingId(proof.id);
    setEditValue(proof.amount != null ? String(Math.round(Number(proof.amount) * 100)) : '');
  };

  const handleSaveAmount = async (proofId: string) => {
    const cents = editValue.replace(/\D/g, '');
    const num = cents ? Number(cents) / 100 : NaN;
    if (isNaN(num) || num < 0) {
      toast.error('Informe um valor válido');
      return;
    }
    try {
      await updateAmountMutation.mutateAsync({ id: proofId, amount: num });
      toast.success('Valor salvo');
      setEditingId(null);
      setEditValue('');
    } catch {
      toast.error('Erro ao salvar valor');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleOpen = async (fileUrl: string) => {
    try {
      await openDocument(fileUrl);
    } catch {
      toast.error('Erro ao abrir documento');
    }
  };

  const handleDownload = async (fileUrl: string, fileName: string | null) => {
    try {
      await downloadDocument(fileUrl, fileName);
    } catch {
      toast.error('Erro ao baixar documento');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!proofs || proofs.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground text-sm">
          Nenhum comprovante de pagamento. Faça upload de um documento tipo Adiantamento ou Saldo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {proofs.map((proof) => {
        const doc = proof.document;
        const typeInfo = PROOF_TYPE_LABELS[proof.proof_type] ?? PROOF_TYPE_LABELS.outros;
        const isEditing = editingId === proof.id;

        return (
          <div
            key={proof.id}
            className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium truncate">{doc?.file_name ?? 'Documento'}</p>
                  <Badge variant="secondary" className={cn('text-xs shrink-0', typeInfo.color)}>
                    {typeInfo.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {doc?.created_at ? formatDate(doc.created_at) : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {isEditing ? (
                <>
                  <MaskedInput
                    mask="currency"
                    value={editValue}
                    onValueChange={(raw) => setEditValue(raw)}
                    placeholder="0,00"
                    className="w-28 h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 gap-1"
                    onClick={() => handleSaveAmount(proof.id)}
                    disabled={updateAmountMutation.isPending}
                  >
                    {updateAmountMutation.isPending ? (
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
                  <div className="text-sm min-w-[80px]">
                    <span className="font-medium">
                      {proof.amount != null ? formatCurrency(Number(proof.amount)) : '—'}
                    </span>
                    {proof.expected_amount != null && (
                      <span className="text-muted-foreground text-xs ml-1">
                        (esp. {formatCurrency(Number(proof.expected_amount))})
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => handleStartEdit(proof)}
                  >
                    {proof.amount != null ? 'Editar' : 'Informar valor'}
                  </Button>
                </>
              )}

              {doc?.file_url && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => handleOpen(doc.file_url!)}
                    title="Visualizar"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => handleDownload(doc.file_url!, doc.file_name)}
                    title="Baixar"
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
