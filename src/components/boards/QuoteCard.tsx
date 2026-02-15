import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import {
  GripVertical,
  MoreHorizontal,
  Mail,
  Copy,
  Calendar,
  MapPin,
  Building2,
  ArrowRightLeft,
  Route,
  AlertTriangle,
  Pencil,
  Trash2,
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
import { formatRouteUf, StoredPricingBreakdown } from '@/lib/freightCalculator';

type Quote = Database['public']['Tables']['quotes']['Row'];

interface QuoteCardProps {
  quote: Quote;
  onEdit?: () => void;
  onClone?: () => void;
  onDelete?: () => void;
  onSendEmail?: () => void;
  onConvert?: () => void;
  canManageActions?: boolean;
}

export function QuoteCard({
  quote,
  onEdit,
  onClone,
  onDelete,
  onSendEmail,
  onConvert,
  canManageActions = true,
}: QuoteCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: quote.id,
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

  const tags = quote.tags || [];

  // Extract route UF label from breakdown or generate from origin/destination
  const breakdown = quote.pricing_breakdown as unknown as StoredPricingBreakdown | null;
  const routeUfLabel =
    breakdown?.meta?.routeUfLabel || formatRouteUf(quote.origin, quote.destination);

  // Get km band from pricing_breakdown
  const kmBandLabel = breakdown?.meta?.kmBandLabel || null;
  const kmStatus = breakdown?.meta?.kmStatus || 'OK';
  const marginStatus = breakdown?.meta?.marginStatus || 'UNKNOWN';
  const marginPercent = breakdown?.meta?.marginPercent;

  const canEmail = quote.stage === 'enviado' || quote.stage === 'negociacao';
  const canConvert = quote.stage === 'ganho';

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'bg-card rounded-lg border border-border shadow-card p-4 cursor-pointer group',
        'hover:shadow-card-hover hover:border-primary/30 transition-all duration-200',
        isDragging && 'opacity-90 rotate-2 scale-[1.02] shadow-lg z-50',
        marginStatus === 'BELOW_TARGET' && 'border-l-4 border-l-warning'
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
          <h4 className="font-semibold text-foreground truncate max-w-[160px]">
            {quote.client_name}
          </h4>
        </div>

        {canManageActions && (
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
              {/* Sempre: Editar */}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
              >
                <Pencil className="w-4 h-4 mr-2" /> Editar
              </DropdownMenuItem>

              {/* Sempre: Clonar */}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onClone?.();
                }}
              >
                <Copy className="w-4 h-4 mr-2" /> Clonar
              </DropdownMenuItem>

              {/* Só: Enviado e Negociação */}
              {canEmail && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onSendEmail?.();
                  }}
                >
                  <Mail className="w-4 h-4 mr-2" /> Enviar E-mail
                </DropdownMenuItem>
              )}

              {/* Só: Ganho */}
              {canConvert && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onConvert?.();
                    }}
                    className="text-success"
                  >
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    Converter para OS
                  </DropdownMenuItem>
                </>
              )}

              {/* Sempre: Delete */}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Route */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{quote.origin}</span>
        <span>→</span>
        <span className="truncate">{quote.destination}</span>
      </div>

      {/* Route UF Badge + Km Band Badge */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {routeUfLabel && (
          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
            <Route className="w-3 h-3 mr-1" />
            {routeUfLabel}
          </Badge>
        )}

        {kmBandLabel && kmStatus === 'OK' && (
          <Badge variant="secondary" className="text-xs bg-muted">
            {kmBandLabel} km
          </Badge>
        )}

        {kmStatus === 'OUT_OF_RANGE' && (
          <Badge variant="secondary" className="text-xs bg-destructive/10 text-destructive">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Fora da faixa
          </Badge>
        )}

        {marginStatus === 'BELOW_TARGET' && marginPercent !== undefined && (
          <Badge variant="secondary" className="text-xs bg-warning/10 text-warning-foreground">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {marginPercent.toFixed(1)}%
          </Badge>
        )}
      </div>

      {/* Shipper & Freight Type */}
      {(quote.shipper_name || quote.freight_type) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          {quote.shipper_name && (
            <div className="flex items-center gap-1 truncate">
              <Building2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[100px]">{quote.shipper_name}</span>
            </div>
          )}
          {quote.freight_type && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {quote.freight_type}
            </Badge>
          )}
          {quote.freight_modality && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {quote.freight_modality === 'lotacao' ? 'Lot' : 'Frac'}
            </Badge>
          )}
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className={cn(
                'text-xs',
                tag === 'urgente' && 'bg-destructive/10 text-destructive',
                tag === 'contrato' && 'bg-primary/10 text-primary',
                tag === 'refrigerado' && 'bg-accent text-accent-foreground'
              )}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <span className="text-lg font-bold text-foreground">
          {formatCurrency(Number(quote.value))}
        </span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {formatDate(quote.created_at)}
        </div>
      </div>
    </motion.div>
  );
}
