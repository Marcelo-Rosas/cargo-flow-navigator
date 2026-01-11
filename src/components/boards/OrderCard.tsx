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
import { ServiceOrder, ORDER_STAGES } from '@/types';
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

interface OrderCardProps {
  order: ServiceOrder;
  onClick?: () => void;
}

export function OrderCard({ order, onClick }: OrderCardProps) {
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

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
    }).format(date);
  };

  const hasOccurrences = order.occurrences.length > 0;
  const hasCriticalDocs = !order.hasNfe || !order.hasCte;
  const needsPod = order.stage === 'entregue' && !order.hasPod;

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
      onClick={onClick}
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
            <h4 className="font-semibold text-foreground">{order.osNumber}</h4>
            <p className="text-sm text-muted-foreground truncate max-w-[140px]">
              {order.clientName}
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
            <DropdownMenuItem>
              <FileText className="w-4 h-4 mr-2" /> Anexar Documento
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Phone className="w-4 h-4 mr-2" /> Contatar Motorista
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
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
      {order.driverName && (
        <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-muted/50">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Truck className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {order.driverName}
            </p>
            <p className="text-xs text-muted-foreground">{order.vehiclePlate}</p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {(hasOccurrences || hasCriticalDocs || needsPod) && (
        <div className="flex flex-wrap gap-1 mb-3">
          {hasOccurrences && (
            <Badge variant="secondary" className="text-xs bg-warning/10 text-warning-foreground gap-1">
              <AlertTriangle className="w-3 h-3" />
              {order.occurrences.length} ocorrência(s)
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
          variant={order.hasNfe ? "default" : "outline"} 
          className={cn(
            "text-xs",
            order.hasNfe ? "bg-success/20 text-success border-success/30" : "border-muted-foreground/30"
          )}
        >
          {order.hasNfe && <CheckCircle className="w-3 h-3 mr-1" />}
          NF-e
        </Badge>
        <Badge 
          variant={order.hasCte ? "default" : "outline"} 
          className={cn(
            "text-xs",
            order.hasCte ? "bg-success/20 text-success border-success/30" : "border-muted-foreground/30"
          )}
        >
          {order.hasCte && <CheckCircle className="w-3 h-3 mr-1" />}
          CT-e
        </Badge>
        <Badge 
          variant={order.hasPod ? "default" : "outline"} 
          className={cn(
            "text-xs",
            order.hasPod ? "bg-success/20 text-success border-success/30" : "border-muted-foreground/30"
          )}
        >
          {order.hasPod && <CheckCircle className="w-3 h-3 mr-1" />}
          POD
        </Badge>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <span className="text-lg font-bold text-foreground">
          {formatCurrency(order.value)}
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
