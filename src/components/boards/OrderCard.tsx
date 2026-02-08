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
  FileText
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
import { STAGE_DOCUMENTS } from '@/lib/order-documents';

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
}

export function OrderCard({ order, onEdit, onRegisterOccurrence, onUploadDocument }: OrderCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id });

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
  const hasCriticalDocs = !order.has_nfe || !order.has_cte;
  const needsPod = order.stage === 'entregue' && !order.has_pod;

  // Documentos visíveis para o estágio atual
  const visibleDocuments = STAGE_DOCUMENTS[order.stage] || [];
  const hasDocumentsToShow = visibleDocuments.length > 0;

  // Agrupa documentos por categoria
  const documentsByGroup = visibleDocuments.reduce((acc, doc) => {
    if (!acc[doc.group]) acc[doc.group] = [];
    acc[doc.group].push(doc);
    return acc;
  }, {} as Record<string, typeof visibleDocuments>);

  // Calcula progresso
  const totalDocs = visibleDocuments.length;
  const completedDocs = visibleDocuments.filter(doc => order[doc.key as keyof Order]).length;
  const progressPercentage = totalDocs > 0 ? (completedDocs / totalDocs) * 100 : 0;
  const hasPendingDocs = visibleDocuments.some(doc => !order[doc.key as keyof Order]);

  // Debug checkpoint
  console.log('OrderCard Debug:', {
    osNumber: order.os_number,
    stage: order.stage,
    totalDocs,
    completedDocs,
    progressPercentage,
    hasPendingDocs,
    documentsByGroup
  });

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "bg-card rounded-lg border border-border shadow-card p-4 cursor-pointer group",
        "hover:shadow-card-hover hover:border-primary/30 transition-all duration-200",
        isDragging && "opacity-90 rotate-2 scale-[1.02] shadow-lg z-50",
        hasOccurrences && "border-warning/50",
        needsPod && "border-destructive/50"
      )}
      onClick={onEdit}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
          <div>
            <h4 className="font-semibold text-foreground">{order.os_number}</h4>
            <p className="text-sm text-muted-foreground truncate max-w-[140px]">
              {order.client_name}
            </p>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUploadDocument?.(); }}>
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
              onClick={(e) => { e.stopPropagation(); onRegisterOccurrence?.(); }}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Registrar Ocorrência
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
            <p className="text-sm font-medium text-foreground truncate">
              {order.driver_name}
            </p>
            <p className="text-xs text-muted-foreground">{order.vehicle_plate}</p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {(hasOccurrences || hasCriticalDocs || needsPod) && (
        <div className="flex flex-wrap gap-1 mb-3">
          {hasOccurrences && (
            <Badge variant="secondary" className="text-xs bg-warning/10 text-warning-foreground gap-1">
              <AlertTriangle className="w-3 h-3" />
              {occurrences.length} ocorrência(s)
            </Badge>
          )}
          {needsPod && (
            <Badge variant="secondary" className="text-xs bg-destructive/10 text-destructive gap-1">
              POD Pendente
            </Badge>
          )}
        </div>
      )}

      {/* Document Status */}
      <div className="flex gap-1 mb-3">
        <Badge 
          variant={order.has_nfe ? "default" : "outline"} 
          className={cn(
            "text-xs",
            order.has_nfe ? "bg-success/20 text-success border-success/30" : "border-muted-foreground/30"
          )}
        >
          {order.has_nfe && <CheckCircle className="w-3 h-3 mr-1" />}
          NF-e
        </Badge>
        <Badge 
          variant={order.has_cte ? "default" : "outline"} 
          className={cn(
            "text-xs",
            order.has_cte ? "bg-success/20 text-success border-success/30" : "border-muted-foreground/30"
          )}
        >
          {order.has_cte && <CheckCircle className="w-3 h-3 mr-1" />}
          CT-e
        </Badge>
        <Badge 
          variant={order.has_pod ? "default" : "outline"} 
          className={cn(
            "text-xs",
            order.has_pod ? "bg-success/20 text-success border-success/30" : "border-muted-foreground/30"
          )}
        >
          {order.has_pod && <CheckCircle className="w-3 h-3 mr-1" />}
          POD
        </Badge>
      </div>

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
