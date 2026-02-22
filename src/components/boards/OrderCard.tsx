import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import {
  GripVertical,
  MoreHorizontal,
  Truck,
  Phone,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';
import {
  DocumentConfig,
  getNextStage,
  getNextStageRequirements,
  groupDocumentsByCategory,
} from '@/lib/order-documents';

type Order = Database['public']['Tables']['orders']['Row'];
type Occurrence = Database['public']['Tables']['occurrences']['Row'];

interface OrderWithOccurrences extends Order {
  occurrences: Occurrence[];
}

interface OrderCardProps {
  order: OrderWithOccurrences;
  onEdit?: () => void;
  onRegisterOccurrence?: () => void;
  onUploadDocument?: () => void;
  canManageActions?: boolean;
}

export function OrderCard({
  order,
  onEdit,
  onRegisterOccurrence,
  onUploadDocument,
  canManageActions = true,
}: OrderCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: order.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(date));
  };

  const occurrences = order.occurrences || [];
  const hasOccurrences = occurrences.length > 0;

  // Requisitos para avançar para a próxima fase (gates por estágio)
  const nextStage = getNextStage(order.stage);
  const requirements: DocumentConfig[] = [...getNextStageRequirements(order.stage)];
  const hasDocumentsToShow = requirements.length > 0;

  // Agrupa requisitos por categoria
  const documentsByGroup = groupDocumentsByCategory(requirements);

  // Calcula progresso (somente requisitos do próximo estágio)
  const totalDocs = requirements.length;
  const completedDocs = requirements.filter((doc) => order[doc.key as keyof Order]).length;
  const progressPercentage = totalDocs > 0 ? (completedDocs / totalDocs) * 100 : 0;
  const hasPendingDocs = requirements.some((doc) => !order[doc.key as keyof Order]);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'bg-card rounded-lg border shadow-sm p-4 cursor-pointer group',
        'hover:shadow-md hover:border-primary/40 transition-all duration-200',
        isDragging && 'opacity-90 rotate-1 scale-[1.02] shadow-xl z-50',
        hasOccurrences && 'border-l-4 border-l-warning',
        hasPendingDocs && hasDocumentsToShow && 'border-l-4 border-l-amber-400',
        !hasPendingDocs && hasDocumentsToShow && 'border-l-4 border-l-success'
      )}
      onClick={onEdit}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {canManageActions && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-foreground">{order.os_number}</h4>

              {/* Badge de gate: obrigatoriedades para avançar para a próxima fase (por estágio) */}
              {hasDocumentsToShow && hasPendingDocs && nextStage && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] uppercase px-2 py-0.5',
                    order.stage === 'em_transito'
                      ? 'border-amber-500/40 text-amber-700 bg-amber-500/10'
                      : 'border-amber-500/40 text-amber-700 bg-amber-500/10'
                  )}
                >
                  {order.stage === 'em_transito'
                    ? 'POD obrigatório para finalizar'
                    : order.stage === 'busca_motorista'
                      ? `Docs do motorista pendentes (${completedDocs}/${totalDocs})`
                      : order.stage === 'documentacao'
                        ? `Docs fiscais pendentes (${completedDocs}/${totalDocs})`
                        : `Pendências para avançar (${completedDocs}/${totalDocs})`}
                </Badge>
              )}

              {hasDocumentsToShow && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="w-3 h-3" />
                  <span className="font-medium">
                    {completedDocs}/{totalDocs}
                  </span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate max-w-[140px]">
              {order.client_name}
            </p>
          </div>
        </div>

        {canManageActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
                aria-label="Ações da ordem de serviço"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onUploadDocument?.();
                }}
              >
                <FileText className="w-4 h-4 mr-2" /> Anexar Documento
              </DropdownMenuItem>
              {order.driver_phone && (
                <DropdownMenuItem asChild>
                  <a href={`tel:${order.driver_phone}`} onClick={(e) => e.stopPropagation()}>
                    <Phone className="w-4 h-4 mr-2" /> Contatar Motorista
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-warning"
                onClick={(e) => {
                  e.stopPropagation();
                  onRegisterOccurrence?.();
                }}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Registrar Ocorrência
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Route */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
        <MapPin className="w-3.5 h-3.5" />
        <span className="truncate">{order.origin}</span>
        <span>→</span>
        <span className="truncate">{order.destination}</span>
      </div>

      {/* Driver Info */}
      {order.driver_name && (
        <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-muted/50">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Truck className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{order.driver_name}</p>
            <p className="text-xs text-muted-foreground">{order.vehicle_plate}</p>
          </div>
        </div>
      )}

      {/* Alerts - Ocorrências */}
      {hasOccurrences && (
        <div className="flex flex-wrap gap-1 mb-3">
          <Badge
            variant="secondary"
            className="text-xs uppercase bg-warning/10 text-warning-foreground gap-1"
          >
            <AlertTriangle className="w-3 h-3" />
            {occurrences.length} ocorrência{occurrences.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      )}

      {/* Documentos - Agrupados por Categoria */}
      {hasDocumentsToShow && (
        <div className="space-y-2 mb-3">
          {Object.entries(documentsByGroup).map(([group, docs]) => (
            <div key={group} className="space-y-1">
              <div className="flex flex-wrap gap-1.5">
                {docs.map((doc) => {
                  const hasDoc = order[doc.key as keyof Order];
                  return (
                    <Badge
                      key={doc.key}
                      variant={hasDoc ? 'default' : 'outline'}
                      className={cn(
                        'text-xs uppercase font-medium transition-all',
                        hasDoc
                          ? 'bg-success/15 text-success border-success/40 hover:bg-success/20'
                          : 'border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50 bg-background'
                      )}
                    >
                      {hasDoc && <CheckCircle className="w-3 h-3 mr-1" />}
                      {doc.label}
                    </Badge>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Barra de Progresso */}
          {totalDocs > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-300 rounded-full',
                    progressPercentage === 100 ? 'bg-success' : 'bg-primary'
                  )}
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-medium min-w-[45px] text-right">
                {Math.round(progressPercentage)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Carreteiro (Real > ANTT) */}
      {(order.carreteiro_real != null || order.carreteiro_antt != null) && (
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Carreteiro ({order.carreteiro_real != null ? 'real' : 'ANTT'})</span>
          <span className="font-medium text-foreground">
            {formatCurrency(Number(order.carreteiro_real ?? order.carreteiro_antt))}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <span className="text-lg font-bold text-foreground">
          {formatCurrency(Number(order.value))}
        </span>
        {order.eta && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            ETA: {formatDate(order.eta)}
          </div>
        )}
      </div>
    </motion.div>
  );
}
