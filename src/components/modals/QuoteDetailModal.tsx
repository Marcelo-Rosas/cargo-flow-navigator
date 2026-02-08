import { useState } from 'react';
import { 
  MapPin, 
  Calendar, 
  DollarSign,
  Pencil,
  Building2,
  Mail,
  Package,
  Scale,
  Box,
  ArrowRightLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { QuoteForm } from '@/components/forms/QuoteForm';
import { ConvertQuoteModal } from '@/components/modals/ConvertQuoteModal';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type Quote = Database['public']['Tables']['quotes']['Row'];
type QuoteStage = Database['public']['Enums']['quote_stage'];

interface QuoteDetailModalProps {
  open: boolean;
  onClose: () => void;
  quote: Quote | null;
}

const STAGE_LABELS: Record<QuoteStage, { label: string; color: string }> = {
  novo_pedido: { label: 'Novo Pedido', color: 'bg-muted text-muted-foreground' },
  qualificacao: { label: 'Qualificação', color: 'bg-accent text-accent-foreground' },
  precificacao: { label: 'Precificação', color: 'bg-primary/10 text-primary' },
  enviado: { label: 'Enviado', color: 'bg-warning/10 text-warning-foreground' },
  negociacao: { label: 'Negociação', color: 'bg-warning/10 text-warning-foreground' },
  ganho: { label: 'Ganho', color: 'bg-success/10 text-success' },
  perdido: { label: 'Perdido', color: 'bg-destructive/10 text-destructive' },
};

export function QuoteDetailModal({ open, onClose, quote }: QuoteDetailModalProps) {
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

  if (!quote) return null;

  const stageInfo = STAGE_LABELS[quote.stage];
  const canConvert = quote.stage !== 'ganho' && quote.stage !== 'perdido';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date));
  };

  const formatDateTime = (date: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3">
                <span className="text-xl font-bold">Cotação</span>
                <Badge className={cn(stageInfo.color)}>
                  {stageInfo.label}
                </Badge>
              </DialogTitle>
              <div className="flex items-center gap-2">
                {canConvert && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsConvertModalOpen(true)}
                    className="gap-2"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Converter para OS
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setIsEditFormOpen(true)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Client Info */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-lg">{quote.client_name}</p>
                  {quote.client_email && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {quote.client_email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Shipper Info */}
            {(quote.shipper_name || quote.freight_type) && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <h4 className="font-semibold text-foreground mb-3">Embarcador</h4>
                <div className="flex items-center justify-between">
                  <div>
                    {quote.shipper_name && (
                      <p className="font-medium text-foreground">{quote.shipper_name}</p>
                    )}
                    {quote.shipper_email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Mail className="w-3.5 h-3.5" />
                        {quote.shipper_email}
                      </p>
                    )}
                  </div>
                  {quote.freight_type && (
                    <Badge variant="outline" className="text-sm">
                      {quote.freight_type}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Route */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">Origem</span>
                </div>
                <p className="font-medium text-foreground">{quote.origin}</p>
                {quote.origin_cep && (
                  <p className="text-xs text-muted-foreground mt-1">CEP: {quote.origin_cep.replace(/(\d{5})(\d{3})/, '$1-$2')}</p>
                )}
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">Destino</span>
                </div>
                <p className="font-medium text-foreground">{quote.destination}</p>
                {quote.destination_cep && (
                  <p className="text-xs text-muted-foreground mt-1">CEP: {quote.destination_cep.replace(/(\d{5})(\d{3})/, '$1-$2')}</p>
                )}
              </div>
            </div>

            {/* Cargo Info */}
            {(quote.cargo_type || quote.weight || quote.volume) && (
              <div>
                <h4 className="font-semibold text-foreground mb-3">Dados da Carga</h4>
                <div className="grid grid-cols-3 gap-3">
                  {quote.cargo_type && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Package className="w-4 h-4" />
                        <span className="text-xs">Tipo</span>
                      </div>
                      <p className="font-medium text-foreground text-sm">{quote.cargo_type}</p>
                    </div>
                  )}
                  {quote.weight && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Scale className="w-4 h-4" />
                        <span className="text-xs">Peso</span>
                      </div>
                      <p className="font-medium text-foreground text-sm">{Number(quote.weight).toLocaleString('pt-BR')} kg</p>
                    </div>
                  )}
                  {quote.volume && (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Box className="w-4 h-4" />
                        <span className="text-xs">Volume</span>
                      </div>
                      <p className="font-medium text-foreground text-sm">{Number(quote.volume).toLocaleString('pt-BR')} m³</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Value */}
            <div className="p-6 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <DollarSign className="w-5 h-5" />
                  <span className="font-medium">Valor Total</span>
                </div>
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(Number(quote.value))}
                </p>
              </div>
            </div>

            {/* Validity */}
            {quote.validity_date && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Validade da Cotação</span>
                </div>
                <p className="font-medium text-foreground">{formatDate(quote.validity_date)}</p>
              </div>
            )}

            {/* Tags */}
            {quote.tags && quote.tags.length > 0 && (
              <div>
                <h4 className="font-semibold text-foreground mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {quote.tags.map((tag) => (
                    <Badge 
                      key={tag} 
                      variant="secondary"
                      className={cn(
                        tag === 'urgente' && "bg-destructive/10 text-destructive",
                        tag === 'contrato' && "bg-primary/10 text-primary",
                        tag === 'refrigerado' && "bg-accent text-accent-foreground"
                      )}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {quote.notes && (
              <div>
                <h4 className="font-semibold text-foreground mb-2">Observações</h4>
                <p className="text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}

            {/* Timestamps */}
            <Separator />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Criado em: {formatDateTime(quote.created_at)}</span>
              <span>Atualizado em: {formatDateTime(quote.updated_at)}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Form */}
      <QuoteForm
        open={isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        quote={quote}
      />

      {/* Convert Modal */}
      <ConvertQuoteModal
        open={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        quote={quote}
      />
    </>
  );
}
