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
  AlertCircle
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
import { Document, DocumentType } from '@/types';

// Mock documents data
const mockDocuments: Document[] = [
  {
    id: '1',
    orderId: '1',
    type: 'nfe',
    fileName: 'NFe_35240112345678901234550010000001231123456789.xml',
    fileUrl: '#',
    fileSize: 45678,
    uploadedAt: new Date('2024-01-12T10:30:00'),
    uploadedBy: 'Maria Santos',
    validationStatus: 'valid',
    nfeKey: '35240112345678901234550010000001231123456789',
  },
  {
    id: '2',
    orderId: '1',
    type: 'cte',
    fileName: 'CTe_35240112345678901234570010000005671123456789.xml',
    fileUrl: '#',
    fileSize: 38900,
    uploadedAt: new Date('2024-01-12T11:15:00'),
    uploadedBy: 'Maria Santos',
    validationStatus: 'valid',
  },
  {
    id: '3',
    orderId: '2',
    type: 'nfe',
    fileName: 'NFe_31240109876543210987650010000002341987654321.xml',
    fileUrl: '#',
    fileSize: 52100,
    uploadedAt: new Date('2024-01-11T14:00:00'),
    uploadedBy: 'João Silva',
    validationStatus: 'pending',
  },
  {
    id: '4',
    orderId: '4',
    type: 'pod',
    fileName: 'Canhoto_OS-2024-0004_20240110.jpg',
    fileUrl: '#',
    fileSize: 1250000,
    uploadedAt: new Date('2024-01-10T18:45:00'),
    uploadedBy: 'André Costa',
    validationStatus: 'valid',
  },
  {
    id: '5',
    orderId: '3',
    type: 'nfe',
    fileName: 'NFe_52240111223344556677880010000003451234567890.xml',
    fileUrl: '#',
    fileSize: 41200,
    uploadedAt: new Date('2024-01-09T09:20:00'),
    uploadedBy: 'Pedro Santos',
    validationStatus: 'invalid',
  },
  {
    id: '6',
    type: 'outros',
    fileName: 'Contrato_Transporte_2024.pdf',
    fileUrl: '#',
    fileSize: 2340000,
    uploadedAt: new Date('2024-01-08T16:00:00'),
    uploadedBy: 'Admin',
    validationStatus: 'valid',
  },
];

const typeLabels: Record<DocumentType, string> = {
  nfe: 'NF-e',
  cte: 'CT-e',
  pod: 'Comprovante',
  outros: 'Outros',
};

const typeColors: Record<DocumentType, string> = {
  nfe: 'bg-primary/10 text-primary',
  cte: 'bg-accent text-accent-foreground',
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
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
    return Image;
  }
  if (['xml'].includes(ext || '')) {
    return FileText;
  }
  return FileIcon;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function Documents() {
  const [documents] = useState<Document[]>(mockDocuments);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isDragging, setIsDragging] = useState(false);

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = 
      doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.nfeKey && doc.nfeKey.includes(searchTerm));
    const matchesType = typeFilter === 'all' || doc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Handle file upload logic here
  };

  return (
    <MainLayout>
      {/* Page Header */}
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

          <Button className="gap-2">
            <Upload className="w-4 h-4" />
            Upload
          </Button>
        </div>
      </div>

      {/* Upload Drop Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center mb-6 transition-colors",
          isDragging 
            ? "border-primary bg-primary/5" 
            : "border-border hover:border-primary/50"
        )}
      >
        <Upload className={cn(
          "w-10 h-10 mx-auto mb-3 transition-colors",
          isDragging ? "text-primary" : "text-muted-foreground"
        )} />
        <p className="text-foreground font-medium">
          Arraste e solte arquivos aqui
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          ou clique para selecionar (PDF, XML, JPG, PNG até 10MB)
        </p>
      </motion.div>

      {/* Documents List */}
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
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Documento</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">OS</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Enviado por</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredDocuments.map((doc, index) => {
                const FileTypeIcon = getFileIcon(doc.fileName);
                const status = statusConfig[doc.validationStatus || 'pending'];
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
                            {doc.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(doc.fileSize)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={cn("text-xs", typeColors[doc.type])}>
                        {typeLabels[doc.type]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {doc.orderId ? `OS-2024-000${doc.orderId}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className={cn("flex items-center gap-1.5", status.color)}>
                        <StatusIcon className="w-4 h-4" />
                        <span className="text-sm">{status.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground">{doc.uploadedBy}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Intl.DateTimeFormat('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(doc.uploadedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
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
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </MainLayout>
  );
}
