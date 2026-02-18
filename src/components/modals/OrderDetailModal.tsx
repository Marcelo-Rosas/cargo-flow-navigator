import { useState, useEffect } from 'react';
import { useAnttFloorRate, calculateAnttMinimum } from '@/hooks/useAnttFloorRate';
import {
  MapPin,
  Truck,
  Phone,
  Calendar,
  FileText,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  DollarSign,
  Pencil,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { DocumentList } from '@/components/documents/DocumentList';
import { OccurrenceForm } from '@/components/forms/OccurrenceForm';
import { OrderForm } from '@/components/forms/OrderForm';
import { useOccurrencesByOrder, useResolveOccurrence } from '@/hooks/useOccurrences';
import { useVehicleByPlate } from '@/hooks/useVehicles';
import { useUpdateOrder } from '@/hooks/useOrders';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type Order = Database['public']['Tables']['orders']['Row'];
type Occurrence = Database['public']['Tables']['occurrences']['Row'];
type Quote = Database['public']['Tables']['quotes']['Row'];
type OrderStage = Database['public']['Enums']['order_stage'];

interface OrderWithOccurrences extends Order {
  occurrences: Occurrence[];
  quote?:
    | (Pick<
        Quote,
        | 'id'
        | 'shipper_name'
        | 'shipper_id'
        | 'client_name'
        | 'client_id'
        | 'origin'
        | 'origin_cep'
        | 'destination'
        | 'destination_cep'
        | 'freight_type'
        | 'km_distance'
        | 'vehicle_type_id'
      > & {
        vehicle_type?: {
          axes_count: number | null;
          code: string;
          name: string;
        } | null;
      })
    | null;
}

interface OrderDetailModalProps {
  open: boolean;
  onClose: () => void;
  order: OrderWithOccurrences | null;
  canManage?: boolean;
}

// Stage visibility constants
const STAGES_WITH_DRIVER: OrderStage[] = [
  'busca_motorista',
  'documentacao',
  'coleta_realizada',
  'em_transito',
  'entregue',
];
const STAGES_WITH_DOCS_TAB: OrderStage[] = [
  'busca_motorista',
  'documentacao',
  'coleta_realizada',
  'em_transito',
  'entregue',
];

const STAGE_LABELS: Record<OrderStage, { label: string; color: string }> = {
  ordem_criada: { label: 'Ordem Criada', color: 'bg-muted text-muted-foreground' },
  busca_motorista: { label: 'Busca Motorista', color: 'bg-accent text-accent-foreground' },
  documentacao: { label: 'Documentação', color: 'bg-primary/10 text-primary' },
  coleta_realizada: { label: 'Coleta Realizada', color: 'bg-warning/10 text-warning-foreground' },
  em_transito: { label: 'Em Trânsito', color: 'bg-warning/10 text-warning-foreground' },
  entregue: { label: 'Entregue', color: 'bg-success/10 text-success' },
};

export function OrderDetailModal({
  open,
  onClose,
  order,
  canManage = true,
}: OrderDetailModalProps) {
  const { user } = useAuth();
  const { data: occurrences } = useOccurrencesByOrder(order?.id || '');
  const resolveOccurrenceMutation = useResolveOccurrence();
  const [isOccurrenceFormOpen, setIsOccurrenceFormOpen] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [plateInput, setPlateInput] = useState('');
  const [plateToSearch, setPlateToSearch] = useState<string | null>(null);

  const isBuscaMotorista = order?.stage === 'busca_motorista';
  const { data: vehicleByPlate, isLoading: vehicleByPlateLoading } = useVehicleByPlate(
    isBuscaMotorista && plateToSearch ? plateToSearch : null
  );
  const updateOrderMutation = useUpdateOrder();

  useEffect(() => {
    if (order?.vehicle_plate != null) setPlateInput(order.vehicle_plate);
    else setPlateInput('');
    setPlateToSearch(null);
  }, [order?.id, order?.vehicle_plate, open]);

  const handleBuscarPorPlaca = () => {
    const trimmed = plateInput.replace(/\s|-/g, '').toUpperCase().trim();
    if (trimmed.length >= 7) setPlateToSearch(trimmed);
    else toast.error('Informe uma placa válida (7 caracteres)');
  };

  const handleAplicarVeiculoNaOS = async () => {
    if (!order?.id || !vehicleByPlate) return;
    try {
      await updateOrderMutation.mutateAsync({
        id: order.id,
        updates: {
          vehicle_plate: vehicleByPlate.plate,
          driver_name: vehicleByPlate.driver?.name ?? null,
          driver_phone: vehicleByPlate.driver?.phone ?? null,
          owner_name: vehicleByPlate.owner?.name ?? null,
          owner_phone: vehicleByPlate.owner?.phone ?? null,
        },
      });
      toast.success('Veículo, motorista e proprietário aplicados à OS');
      setPlateToSearch(null);
    } catch {
      toast.error('Erro ao aplicar à OS');
    }
  };

  // ANTT piso mínimo (Tabela A / Carga Geral / sem retorno vazio)
  const axesCount = order?.quote?.vehicle_type?.axes_count ?? null;
  const kmDistance = order?.quote?.km_distance ?? null;
  const { data: anttRate } = useAnttFloorRate({
    operationTable: 'A',
    cargoType: 'carga_geral',
    axesCount,
  });

  const anttCalc =
    anttRate && kmDistance
      ? calculateAnttMinimum({
          kmDistance: Number(kmDistance),
          ccd: Number(anttRate.ccd),
          cc: Number(anttRate.cc),
        })
      : null;

  if (!order) return null;

  const stageInfo = STAGE_LABELS[order.stage];

  // Stage-based visibility flags
  const showDriverSection = STAGES_WITH_DRIVER.includes(order.stage);
  const showDocsTab = STAGES_WITH_DOCS_TAB.includes(order.stage);

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
                <Badge className={cn(stageInfo.color)}>{stageInfo.label}</Badge>
              </DialogTitle>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditFormOpen(true)}
                  aria-label="Editar ordem de serviço"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
            </div>
          </DialogHeader>

          <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="flex-shrink-0">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              {showDocsTab && (
                <TabsTrigger value="documents" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Documentos
                </TabsTrigger>
              )}
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
                {/* Contexto da OS (para continuidade do fluxo) */}
                <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                  {order.quote?.shipper_name && (
                    <div>
                      <h4 className="font-semibold text-foreground">Embarcador</h4>
                      <p className="text-foreground">{order.quote.shipper_name}</p>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold text-foreground">Cliente</h4>
                    <p className="text-foreground">{order.client_name}</p>
                  </div>
                </div>

                {/* Rota + CEP */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm">Origem</span>
                    </div>
                    <p className="font-medium text-foreground">{order.origin}</p>
                    {order.quote?.origin_cep && (
                      <p className="text-xs text-muted-foreground mt-1">
                        CEP: {order.quote.origin_cep}
                      </p>
                    )}
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm">Destino</span>
                    </div>
                    <p className="font-medium text-foreground">{order.destination}</p>
                    {order.quote?.destination_cep && (
                      <p className="text-xs text-muted-foreground mt-1">
                        CEP: {order.quote.destination_cep}
                      </p>
                    )}
                  </div>
                </div>

                {/* Busca por placa (stage Busca Motorista) - preenche veículo, motorista e proprietário na OS */}
                {isBuscaMotorista && canManage && (
                  <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                    <p className="text-sm font-medium text-foreground">
                      Preencher veículo, motorista e proprietário pela placa
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        placeholder="Placa do veículo (ex: ABC1D23)"
                        className="w-[180px] font-mono uppercase placeholder:normal-case"
                        value={plateInput}
                        onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleBuscarPorPlaca()}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleBuscarPorPlaca}
                        disabled={vehicleByPlateLoading}
                      >
                        {vehicleByPlateLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Buscar e preencher'
                        )}
                      </Button>
                    </div>
                    {!vehicleByPlateLoading && plateToSearch && !vehicleByPlate && (
                      <p className="text-sm text-muted-foreground">Placa não encontrada.</p>
                    )}
                    {vehicleByPlate && (
                      <div className="rounded-md border border-border bg-background p-3 text-sm space-y-2">
                        <p className="font-medium text-foreground">
                          Veículo: <span className="font-mono">{vehicleByPlate.plate}</span>
                          {vehicleByPlate.driver?.name && (
                            <> · Motorista: {vehicleByPlate.driver.name}</>
                          )}
                          {vehicleByPlate.owner?.name && (
                            <> · Proprietário: {vehicleByPlate.owner.name}</>
                          )}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAplicarVeiculoNaOS}
                          disabled={updateOrderMutation.isPending}
                        >
                          {updateOrderMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Aplicar à OS
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Motorista e Proprietário (via veículo) - visível a partir de Busca Motorista */}
                {showDriverSection && (order.driver_name || order.owner_name) && (
                  <div className="space-y-3">
                    {order.driver_name && (
                      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Truck className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Motorista
                            </p>
                            <p className="font-semibold text-foreground">{order.driver_name}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
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
                    {order.owner_name && (
                      <div className="p-4 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Proprietário
                            </p>
                            <p className="font-semibold text-foreground">{order.owner_name}</p>
                            {order.owner_phone && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                <Phone className="w-3.5 h-3.5" />
                                {order.owner_phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Valores */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-sm">Valor do Frete (cliente)</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">
                      {formatCurrency(Number(order.value))}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-sm">Piso mínimo p/ carreteiro (ANTT)</span>
                    </div>
                    {anttCalc ? (
                      <>
                        <p className="text-xl font-bold text-foreground">
                          {formatCurrency(anttCalc.total)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Tabela A • Carga Geral • {axesCount || '-'} eixos •{' '}
                          {Number(kmDistance || 0).toLocaleString('pt-BR')} km
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Memória: ({Number(kmDistance || 0).toLocaleString('pt-BR')} ×{' '}
                          {Number(anttRate?.ccd || 0).toFixed(4)}) +{' '}
                          {Number(anttRate?.cc || 0).toFixed(2)}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xl font-bold text-foreground">—</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Cadastre CCD/CC em ANTT Floor Rates (Tabela A / Carga Geral) e preencha KM
                          + veículo.
                        </p>
                      </>
                    )}
                  </div>

                  {/* Carreteiro (persistido na OS) */}
                  {(order.carreteiro_antt != null || order.carreteiro_real != null) && (
                    <div className="p-4 rounded-lg bg-muted/30 border border-border col-span-2">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-sm">Carreteiro (OS)</span>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">ANTT (base)</p>
                          <p className="font-semibold text-foreground">
                            {order.carreteiro_antt != null
                              ? formatCurrency(Number(order.carreteiro_antt))
                              : '—'}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Real (fechado)</p>
                          <p className="font-semibold text-foreground">
                            {order.carreteiro_real != null
                              ? formatCurrency(Number(order.carreteiro_real))
                              : '—'}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Diferença</p>
                          {order.carreteiro_real != null && order.carreteiro_antt != null ? (
                            <p
                              className={cn(
                                'font-semibold',
                                Number(order.carreteiro_real) - Number(order.carreteiro_antt) > 0
                                  ? 'text-warning-foreground'
                                  : 'text-success'
                              )}
                            >
                              {formatCurrency(
                                Number(order.carreteiro_real) - Number(order.carreteiro_antt)
                              )}
                            </p>
                          ) : (
                            <p className="font-semibold text-foreground">—</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {order.eta && (
                    <div className="p-4 rounded-lg bg-muted/30 border border-border col-span-2">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">Previsão de Entrega</span>
                      </div>
                      <p className="font-medium text-foreground">{formatDate(order.eta)}</p>
                    </div>
                  )}
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

              {showDocsTab && (
                <TabsContent value="documents" className="m-0 space-y-6">
                  {canManage && <DocumentUpload orderId={order.id} orderStage={order.stage} />}
                  <Separator />
                  <DocumentList orderId={order.id} />
                </TabsContent>
              )}

              <TabsContent value="occurrences" className="m-0 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-foreground">Histórico de Ocorrências</h4>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsOccurrenceFormOpen(true)}
                      className="gap-2"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Nova Ocorrência
                    </Button>
                  )}
                </div>

                {!occurrences || occurrences.length === 0 ? (
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
                          'p-4 rounded-lg border',
                          occ.resolved_at
                            ? 'bg-muted/30 border-border'
                            : occ.severity === 'critica'
                              ? 'bg-destructive/10 border-destructive/30'
                              : occ.severity === 'alta'
                                ? 'bg-destructive/5 border-destructive/20'
                                : 'bg-warning/10 border-warning/30'
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-xs',
                                occ.severity === 'baixa' && 'bg-muted',
                                occ.severity === 'media' && 'bg-warning/20 text-warning-foreground',
                                occ.severity === 'alta' && 'bg-destructive/20 text-destructive',
                                occ.severity === 'critica' &&
                                  'bg-destructive text-destructive-foreground'
                              )}
                            >
                              {occ.severity.toUpperCase()}
                            </Badge>
                            {occ.resolved_at && (
                              <Badge
                                variant="secondary"
                                className="text-xs bg-success/20 text-success"
                              >
                                Resolvida
                              </Badge>
                            )}
                          </div>
                          {canManage && !occ.resolved_at && (
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
        open={canManage && isOccurrenceFormOpen}
        onClose={() => setIsOccurrenceFormOpen(false)}
        orderId={order.id}
        osNumber={order.os_number}
      />

      {/* Edit Form */}
      <OrderForm
        open={canManage && isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        order={order}
      />
    </>
  );
}
