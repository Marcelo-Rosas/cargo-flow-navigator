import { FileText, Download, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDocumentsByOrder, useDeleteDocument } from '@/hooks/useDocuments';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type Document = Database['public']['Tables']['documents']['Row'];
type DocumentType = Database['public']['Enums']['document_type'];

interface DocumentListProps {
  orderId: string;
}

const TYPE_LABELS: Record<DocumentType, { label: string; color: string }> = {
  nfe: { label: 'NF-e', color: 'bg-primary/10 text-primary' },
  cte: { label: 'CT-e', color: 'bg-success/10 text-success' },
  pod: { label: 'POD', color: 'bg-warning/10 text-warning-foreground' },
  outros: { label: 'Outros', color: 'bg-muted text-muted-foreground' },
};

export function DocumentList({ orderId }: DocumentListProps) {
  const { data: documents, isLoading } = useDocumentsByOrder(orderId);
  const deleteDocumentMutation = useDeleteDocument();

  const handleDelete = async (doc: Document) => {
    try {
      await deleteDocumentMutation.mutateAsync(doc.id);
      toast.success('Documento excluído');
    } catch (error) {
      toast.error('Erro ao excluir documento');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">Nenhum documento anexado</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => {
        const typeInfo = TYPE_LABELS[doc.type];
        return (
          <div 
            key={doc.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-medium text-foreground truncate">
                  {doc.file_name}
                </p>
                <Badge variant="secondary" className={cn("text-xs", typeInfo.color)}>
                  {typeInfo.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                asChild
              >
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                asChild
              >
                <a href={doc.file_url} download={doc.file_name}>
                  <Download className="w-4 h-4" />
                </a>
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir "{doc.file_name}"? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => handleDelete(doc)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        );
      })}
    </div>
  );
}
