import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  Search,
  Filter,
  FileText,
  Image,
  File as FileIcon,
  Download,
  Eye,
  Trash2,
  MoreHorizontal,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useDocuments } from '@/hooks/useDocuments';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Database } from '@/integrations/supabase/types';

type DocumentType = Database['public']['Enums']['document_type'];

const typeLabels: Record<DocumentType, string> = {
  cnh: 'CNH',
  crlv: 'CRLV',
  comp_residencia: 'Comp. Residência',
  antt_motorista: 'ANTT',
  nfe: 'NF-e',
  cte: 'CT-e',
  mdfe: 'MDF-e',
  pod: 'Comprovante',
  outros: 'Outros',
};

const typeColors: Record<DocumentType, string> = {
  cnh: 'bg-blue-500/10 text-blue-600',
  crlv: 'bg-blue-500/10 text-blue-600',
  comp_residencia: 'bg-blue-500/10 text-blue-600',
  antt_motorista: 'bg-blue-500/10 text-blue-600',
  nfe: 'bg-primary/10 text-primary',
  cte: 'bg-accent text-accent-foreground',
  mdfe: 'bg-primary/10 text-primary',
  pod: 'bg-success/10 text-success',
  outros: 'bg-muted text-muted-foreground',
};

const statusConfig = {
  valid: { icon: CheckCircle, color: 'text-success', label: 'Válido' },
  pending: { icon: Clock, color: 'text-warning', label: 'Pendente' },
  invalid: { icon: AlertCircle, color: 'text-destructive', label: 'Inválido' },
};

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return Image;
  if (['xml'].includes(ext || '')) return FileText;
  return FileIcon;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function Documents() {
  const { user } = useAuth();
  const { canWrite } = useUserRole();
  const { data: documents, isLoading, isError, error, refetch } = useDocuments();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isDragging, setIsDragging] = useState(false);

  const filteredDocuments = (documents || []).filter((doc) => {
    const matchesSearch =
      doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.nfe_key && doc.nfe_key.includes(searchTerm));
    const matchesType = typeFilter === 'all' || doc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">Faça login para acessar os documentos</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <motion.h1
            className="text-3xl font-bold text-foreground"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Documentos
          </motion.h1>
          <motion.p
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Gestão de NF-e, CT-e e comprovantes de entrega
          </motion.p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou chave..."
              className="pl-10 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="nfe">NF-e</SelectItem>
              <SelectItem value="cte">CT-e</SelectItem>
              <SelectItem value="pod">Comprovante</SelectItem>
              <SelectItem value="outros">Outros</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
          {canWrite && (
            <Button className="gap-2">
              <Upload className="w-4 h-4" />
              Upload
            </Button>
          )}
        </div>
      </div>

      {canWrite && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center mb-6 transition-colors',
            isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          )}
        >
          <Upload
            className={cn(
              'w-10 h-10 mx-auto mb-3 transition-colors',
              isDragging ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <p className="text-foreground font-medium">Arraste e solte arquivos aqui</p>
          <p className="text-sm text-muted-foreground mt-1">
            ou clique para selecionar (PDF, XML, JPG, PNG até 10MB)
          </p>
        </motion.div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="bg-card rounded-xl border border-border shadow-card p-8">
          <p className="text-foreground font-medium">Não foi possível carregar os documentos</p>
          <p className="text-sm text-muted-foreground mt-1">
            {(error instanceof Error && error.message) || 'Erro inesperado ao buscar documentos.'}
          </p>
          <div className="mt-4">
            <Button onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-card p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum documento encontrado</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border border-border shadow-card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Documento
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Data
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDocuments.map((doc, index) => {
                  const FileTypeIcon = getFileIcon(doc.file_name);
                  const status =
                    statusConfig[(doc.validation_status as keyof typeof statusConfig) || 'pending'];
                  const StatusIcon = status.icon;
                  return (
                    <motion.tr
                      key={doc.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * index }}
                      className="hover:bg-muted/30 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <FileTypeIcon className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate max-w-[300px]">
                              {doc.file_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(doc.file_size)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={cn('text-xs', typeColors[doc.type])}>
                          {typeLabels[doc.type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className={cn('flex items-center gap-1.5', status.color)}>
                          <StatusIcon className="w-4 h-4" />
                          <span className="text-sm">{status.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Intl.DateTimeFormat('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(doc.created_at))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Visualizar documento"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Baixar documento"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          {canWrite && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label="Mais ações"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Anexar a OS</DropdownMenuItem>
                                <DropdownMenuItem>Validar Chave</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </MainLayout>
  );
}
