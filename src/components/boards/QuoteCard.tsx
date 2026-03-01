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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

  const anttTotal = breakdown?.meta?.antt?.total;

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
      data-testid={`quote-card-${quote.id}`}
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
              data-testid={`quote-card-drag-handle-${quote.id}`}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <div className="flex flex-col min-w-0">
            <h4 className="font-semibold text-foreground">{quote.quote_code ?? '—'}</h4>
            <p className="text-sm text-muted-foreground truncate max-w-[160px]">
              {quote.client_name}
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

      {/* Rota visível, detalhes secundários no tooltip */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3 cursor-help min-h-[20px]">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{quote.origin}</span>
            <span>→</span>
            <span className="truncate">{quote.destination}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs space-y-2 text-xs">
          {routeUfLabel && (
            <p>
              <Route className="inline w-3 h-3 mr-1" />
              {routeUfLabel}
              {kmBandLabel && ` • ${kmBandLabel} km`}
            </p>
          )}
          {quote.shipper_name && (
            <p>
              <Building2 className="inline w-3 h-3 mr-1" />
              Embarcador: {quote.shipper_name}
            </p>
          )}
          {(quote.freight_type || quote.freight_modality) && (
            <p>
              Tipo: {quote.freight_type || '—'}{' '}
              {quote.freight_modality &&
                `• ${quote.freight_modality === 'lotacao' ? 'Lot' : 'Frac'}`}
            </p>
          )}
          {anttTotal != null && <p>Piso ANTT: {formatCurrency(Number(anttTotal))}</p>}
          {tags.length > 0 && <p>Tags: {tags.join(', ')}</p>}
          {quote.email_sent && (
            <p>
              <Mail className="inline w-3 h-3 mr-1" />
              E-mail enviado
            </p>
          )}
          {kmStatus === 'OUT_OF_RANGE' && (
            <p className="text-destructive">
              <AlertTriangle className="inline w-3 h-3 mr-1" />
              Fora da faixa
            </p>
          )}
          {marginStatus === 'BELOW_TARGET' && marginPercent !== undefined && (
            <p className="text-warning-foreground">
              <AlertTriangle className="inline w-3 h-3 mr-1" />
              Margem: {marginPercent.toFixed(1)}%
            </p>
          )}
        </TooltipContent>
      </Tooltip>

      {/* Footer: Valor e Data */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-lg font-bold text-foreground">
          {formatCurrency(Number(quote.value))}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {formatDate(quote.created_at)}
        </span>
      </div>
    </motion.div>
  );
}
