import { useState } from 'react';
import { 
  MapPin, 
  Truck, 
  Phone, 
  Calendar, 
  FileText, 
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Clock,
  DollarSign,
  Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { DocumentList } from '@/components/documents/DocumentList';
import { OccurrenceForm } from '@/components/forms/OccurrenceForm';
import { OrderForm } from '@/components/forms/OrderForm';
import { useOccurrencesByOrder, useResolveOccurrence } from '@/hooks/useOccurrences';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type Order = Database['public']['Tables']['orders']['Row'];
type Occurrence = Database['public']['Tables']['occurrences']['Row'];
type OrderStage = Database['public']['Enums']['order_stage'];

interface OrderWithOccurrences extends Order {
  occurrences: Occurrence[];
}

interface OrderDetailModalProps {
  open: boolean;
  onClose: () => void;
  order: OrderWithOccurrences | null;
}

const STAGE_LABELS: Record<OrderStage, { label: string; color: string }> = {
  ordem_criada: { label: 'Ordem Criada', color: 'bg-muted text-muted-foreground' },
  busca_motorista: { label: 'Busca Motorista', color: 'bg-accent text-accent-foreground' },
  documentacao: { label: 'Documentação', color: 'bg-primary/10 text-primary' },
  coleta_realizada: { label: 'Coleta Realizada', color: 'bg-warning/10 text-warning-foreground' },
  em_transito: { label: 'Em Trânsito', color: 'bg-warning/10 text-warning-foreground' },
  entregue: { label: 'Entregue', color: 'bg-success/10 text-success' },
};

export function OrderDetailModal({ open, onClose, order }: OrderDetailModalProps) {
  const { user } = useAuth();
  const { data: occurrences } = useOccurrencesByOrder(order?.id || '');
  const resolveOccurrenceMutation = useResolveOccurrence();
  const [isOccurrenceFormOpen, setIsOccurrenceFormOpen] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);

  if (!order) return null;

  const stageInfo = STAGE_LABELS[order.stage];

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
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const handleResolveOccurrence = async (occurrenceId: string) => {
    if (!user) return;
    try {
      await resolveOccurrenceMutation.mutateAsync({
        id: occurrenceId,
        resolved_by: user.id,
      });
      toast.success('Ocorrência resolvida');
    } catch (error) {
      toast.error('Erro ao resolver ocorrência');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3">
                <span className="text-2xl font-bold">{order.os_number}</span>
                <Badge className={cn(stageInfo.color)}>
                  {stageInfo.label}
                </Badge>
              </DialogTitle>
              <Button variant="ghost" size="icon" onClick={() => setIsEditFormOpen(true)}>
                <Pencil className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="flex-shrink-0">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="documents" className="gap-2">
                <FileText className="w-4 h-4" />
                Documentos
              </TabsTrigger>
              <TabsTrigger value="occurrences" className="gap-2">
                <AlertTriangle className="w-4 h-4" />
                Ocorrências
                {(occurrences?.length || 0) > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-warning text-warning-foreground">
                    {occurrences?.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              <TabsContent value="details" className="m-0 space-y-6">
                {/* Client Info */}
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Cliente</h4>
                  <p className="text-lg text-foreground">{order.client_name}</p>
                </div>

                {/* Route */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm">Origem</span>
                    </div>
                    <p className="font-medium text-foreground">{order.origin}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm">Destino</span>
                    </div>
                    <p className="font-medium text-foreground">{order.destination}</p>
                  </div>
                </div>

                {/* Driver Info */}
                {order.driver_name && (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Truck className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{order.driver_name}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {order.driver_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              {order.driver_phone}
                            </span>
                          )}
                          {order.vehicle_plate && (
                            <span className="font-mono">{order.vehicle_plate}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Value and ETA */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-sm">Valor do Frete</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">
                      {formatCurrency(Number(order.value))}
                    </p>
                  </div>
                  {order.eta && (
                    <div className="p-4 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">Previsão de Entrega</span>
                      </div>
                      <p className="font-medium text-foreground">
                        {formatDate(order.eta)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Document Status */}
                <div>
                  <h4 className="font-semibold text-foreground mb-3">Status dos Documentos</h4>
                  <div className="flex gap-3">
                    <div className={cn(
                      "flex-1 p-3 rounded-lg border flex items-center gap-2",
                      order.has_nfe ? "bg-success/10 border-success/30" : "bg-muted/30 border-border"
                    )}>
                      {order.has_nfe ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Clock className="w-5 h-5 text-muted-foreground" />}
                      <span className={order.has_nfe ? "text-success" : "text-muted-foreground"}>NF-e</span>
                    </div>
                    <div className={cn(
                      "flex-1 p-3 rounded-lg border flex items-center gap-2",
                      order.has_cte ? "bg-success/10 border-success/30" : "bg-muted/30 border-border"
                    )}>
                      {order.has_cte ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Clock className="w-5 h-5 text-muted-foreground" />}
                      <span className={order.has_cte ? "text-success" : "text-muted-foreground"}>CT-e</span>
                    </div>
                    <div className={cn(
                      "flex-1 p-3 rounded-lg border flex items-center gap-2",
                      order.has_pod ? "bg-success/10 border-success/30" : "bg-muted/30 border-border"
                    )}>
                      {order.has_pod ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Clock className="w-5 h-5 text-muted-foreground" />}
                      <span className={order.has_pod ? "text-success" : "text-muted-foreground"}>POD</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {order.notes && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">Observações</h4>
                    <p className="text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
                  </div>
                )}

                {/* Timestamps */}
                <Separator />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Criado em: {formatDate(order.created_at)}</span>
                  <span>Atualizado em: {formatDate(order.updated_at)}</span>
                </div>
              </TabsContent>

              <TabsContent value="documents" className="m-0 space-y-6">
                <DocumentUpload orderId={order.id} />
                <Separator />
                <DocumentList orderId={order.id} />
              </TabsContent>

              <TabsContent value="occurrences" className="m-0 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-foreground">Histórico de Ocorrências</h4>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsOccurrenceFormOpen(true)}
                    className="gap-2"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Nova Ocorrência
                  </Button>
                </div>

                {(!occurrences || occurrences.length === 0) ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-10 h-10 mx-auto text-success mb-2" />
                    <p className="text-muted-foreground">Nenhuma ocorrência registrada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {occurrences.map((occ) => (
                      <div 
                        key={occ.id}
                        className={cn(
                          "p-4 rounded-lg border",
                          occ.resolved_at 
                            ? "bg-muted/30 border-border" 
                            : occ.severity === 'critica' 
                              ? "bg-destructive/10 border-destructive/30"
                              : occ.severity === 'alta'
                                ? "bg-destructive/5 border-destructive/20"
                                : "bg-warning/10 border-warning/30"
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={cn(
                              "text-xs",
                              occ.severity === 'baixa' && "bg-muted",
                              occ.severity === 'media' && "bg-warning/20 text-warning-foreground",
                              occ.severity === 'alta' && "bg-destructive/20 text-destructive",
                              occ.severity === 'critica' && "bg-destructive text-destructive-foreground"
                            )}>
                              {occ.severity.toUpperCase()}
                            </Badge>
                            {occ.resolved_at && (
                              <Badge variant="secondary" className="text-xs bg-success/20 text-success">
                                Resolvida
                              </Badge>
                            )}
                          </div>
                          {!occ.resolved_at && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleResolveOccurrence(occ.id)}
                              disabled={resolveOccurrenceMutation.isPending}
                            >
                              {resolveOccurrenceMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                'Marcar como Resolvida'
                              )}
                            </Button>
                          )}
                        </div>
                        <p className="text-foreground whitespace-pre-wrap">{occ.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDate(occ.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Occurrence Form */}
      <OccurrenceForm 
        open={isOccurrenceFormOpen}
        onClose={() => setIsOccurrenceFormOpen(false)}
        orderId={order.id}
        osNumber={order.os_number}
      />

      {/* Edit Form */}
      <OrderForm
        open={isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        order={order}
      />
    </>
  );
}
