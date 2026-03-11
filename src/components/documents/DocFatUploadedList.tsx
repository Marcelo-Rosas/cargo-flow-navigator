import { CheckCircle2, Download, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { openDocument, downloadDocument } from '@/lib/storage';
import { useDocumentsByQuote } from '@/hooks/useDocuments';

const DOC_FAT_LABELS: Record<string, { label: string; color: string }> = {
  a_vista_fat: { label: 'À vista', color: 'bg-emerald-500/10 text-emerald-600' },
  adiantamento: { label: 'Adiantamento', color: 'bg-orange-500/10 text-orange-600' },
  saldo_fat: { label: 'Saldo', color: 'bg-amber-500/10 text-amber-600' },
  a_prazo_fat: { label: 'A prazo', color: 'bg-blue-500/10 text-blue-600' },
};

const DOC_FAT_TYPES = Object.keys(DOC_FAT_LABELS);

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function DocFatUploadedList({ quoteId }: { quoteId: string }) {
  const { data: documents, isLoading } = useDocumentsByQuote(quoteId);

  const docFatDocs = (documents ?? []).filter((d) => DOC_FAT_TYPES.includes(d.type));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!docFatDocs.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Nenhum comprovante enviado ainda.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {docFatDocs.map((doc) => {
        const info = DOC_FAT_LABELS[doc.type] ?? {
          label: doc.type,
          color: 'bg-muted text-muted-foreground',
        };
        return (
          <div
            key={doc.id}
            className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium truncate">{doc.file_name ?? 'Documento'}</p>
                  <Badge variant="secondary" className={cn('text-[10px] shrink-0', info.color)}>
                    {info.label}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{formatDate(doc.created_at)}</p>
              </div>
            </div>
            {doc.file_url && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => openDocument(doc.file_url)}
                  title="Abrir"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => downloadDocument(doc.file_url, doc.file_name)}
                  title="Baixar"
                >
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
