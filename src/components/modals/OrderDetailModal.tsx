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
  Clock,
  Package,
  Scale,
  Box,
  CreditCard,
  Route,
  Landmark,
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
import { DriverQualificationPanel } from '@/components/operational/DriverQualificationPanel';
import { ComplianceWidget } from '@/components/operational/ComplianceWidget';
import { useOccurrencesByOrder, useResolveOccurrence } from '@/hooks/useOccurrences';
import { useVehicleByPlate } from '@/hooks/useVehicles';
import { useUpdateOrder } from '@/hooks/useOrders';
import { useEnsureFinancialDocument } from '@/hooks/useEnsureFinancialDocument';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { StoredPricingBreakdown, TollPlaza } from '@/lib/freightCalculator';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Order = Database['public']['Tables']['orders']['Row'];
type Occurrence = Database['public']['Tables']['occurrences']['Row'];
type Quote = Database['public']['Tables']['quotes']['Row'];
type OrderStage = Database['public']['Enums']['order_stage'];

interface OrderWithOccurrences extends Order {
  occurrences: Occurrence[];
  price_table?: { name: string } | null;
  vehicle_type?: { name: string; code: string; axes_count: number | null } | null;
  payment_term?: {
    name: string;
    code: string;
    adjustment_percent: number;
    advance_percent: number | null;
    days: number | null;
  } | null;
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
        | 'pricing_breakdown'
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
  const canConvertToPAG = canManage && order?.stage === 'coleta_realizada';
  const { data: vehicleByPlate, isLoading: vehicleByPlateLoading } = useVehicleByPlate(
    isBuscaMotorista && plateToSearch ? plateToSearch : null
  );
  const updateOrderMutation = useUpdateOrder();
  const ensureFinancialDocumentMutation = useEnsureFinancialDocument();

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
          vehicle_brand: vehicleByPlate.brand ?? null,
          vehicle_model: vehicleByPlate.model ?? null,
          vehicle_type_name: vehicleByPlate.vehicle_type?.name ?? null,
          driver_name: vehicleByPlate.driver?.name ?? null,
          driver_phone: vehicleByPlate.driver?.phone ?? null,
          driver_cnh: vehicleByPlate.driver?.cnh ?? null,
          driver_antt: vehicleByPlate.driver?.antt ?? null,
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

  const handleConverterParaPAG = async () => {
    if (!order?.id) return;

    try {
      await ensureFinancialDocumentMutation.mutateAsync({
        docType: 'PAG',
        sourceId: order.id,
      });
      toast.success('PAG criado no Financeiro (status: INCLUIR)');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Erro ao converter para PAG';
      toast.error(msg);
    }
  };

  // Parse pricing breakdown (cloned to order, fallback to quote)
  const pricingBreakdown = (order?.pricing_breakdown ??
    order?.quote?.pricing_breakdown) as unknown as StoredPricingBreakdown | null;
  const tollPlazas: TollPlaza[] = pricingBreakdown?.meta?.tollPlazas ?? [];

  // ANTT piso mínimo (Tabela A / Carga Geral / sem retorno vazio)
  const breakdown =
    (pricingBreakdown as unknown as {
      meta?: {
        antt?: {
          total: number;
          axesCount: number;
          kmDistance: number;
          ccd: number;
          cc: number;
          ida: number;
        };
      };
    } | null) ?? null;
  const savedAntt = breakdown?.meta?.antt;

  const axesCount =
    savedAntt?.axesCount ??
    order?.vehicle_type?.axes_count ??
    order?.quote?.vehicle_type?.axes_count ??
    null;
  const kmDistance =
    savedAntt?.kmDistance ?? order?.km_distance ?? order?.quote?.km_distance ?? null;

  const { data: anttRate } = useAnttFloorRate({
    operationTable: 'A',
    cargoType: 'carga_geral',
    axesCount,
  });

  const anttCalc =
    savedAntt ||
    (anttRate && kmDistance
      ? calculateAnttMinimum({
          kmDistance: Number(kmDistance),
          ccd: Number(anttRate.ccd),
          cc: Number(anttRate.cc),
        })
      : null);

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
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-3">
                <span className="text-2xl font-bold">{order.os_number}</span>
                <Badge className={cn(stageInfo.color)}>{stageInfo.label}</Badge>
              </DialogTitle>

              <div className="flex items-center gap-2">
                {canConvertToPAG && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleConverterParaPAG}
                    disabled={ensureFinancialDocumentMutation.isPending}
                    className="gap-2"
                  >
                    {ensureFinancialDocumentMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <DollarSign className="w-4 h-4" />
                    )}
                    Converter para PAG
                  </Button>
                )}

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
            </div>
          </DialogHeader>

          <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="flex-shrink-0">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="pedagios" className="gap-2">
                <Landmark className="w-4 h-4" />
                Pedágios
                {tollPlazas.length > 0 && (
                  <Badge variant="secondary" className="text-xs ml-1">
                    {tollPlazas.length}
                  </Badge>
                )}
              </TabsTrigger>
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
              <TabsTrigger value="timeline" className="gap-2">
                <Clock className="w-4 h-4" />
                Timeline
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              <TabsContent value="details" className="m-0 space-y-6">
                {/* Contexto da OS (para continuidade do fluxo) */}
                <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                  {(order.shipper_name || order.quote?.shipper_name) && (
                    <div>
                      <h4 className="font-semibold text-foreground">Embarcador</h4>
                      <p className="text-foreground">
                        {order.shipper_name || order.quote?.shipper_name}
                      </p>
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
                    {(order.origin_cep || order.quote?.origin_cep) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        CEP: {order.origin_cep || order.quote?.origin_cep}
                      </p>
                    )}
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm">Destino</span>
                    </div>
                    <p className="font-medium text-foreground">{order.destination}</p>
                    {(order.destination_cep || order.quote?.destination_cep) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        CEP: {order.destination_cep || order.quote?.destination_cep}
                      </p>
                    )}
                  </div>
                </div>

                {/* Dados da Carga */}
                {(order.cargo_type || order.weight || order.volume) && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Dados da Carga</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {order.cargo_type && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Package className="w-4 h-4" />
                            <span className="text-xs">Tipo</span>
                          </div>
                          <p className="font-medium text-foreground text-sm">{order.cargo_type}</p>
                        </div>
                      )}
                      {order.weight != null && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Scale className="w-4 h-4" />
                            <span className="text-xs">Peso</span>
                          </div>
                          <p className="font-medium text-foreground text-sm">
                            {Number(order.weight) >= 1000
                              ? `${(Number(order.weight) / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} t`
                              : `${Number(order.weight).toLocaleString('pt-BR')} kg`}
                          </p>
                        </div>
                      )}
                      {order.volume != null && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Box className="w-4 h-4" />
                            <span className="text-xs">Volume</span>
                          </div>
                          <p className="font-medium text-foreground text-sm">
                            {Number(order.volume).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Detalhes de Precificação */}
                {(order.price_table ||
                  order.vehicle_type ||
                  order.payment_term ||
                  order.km_distance) && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Detalhes de Precificação</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {order.price_table && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <DollarSign className="w-4 h-4" />
                            <span className="text-xs">Tabela de Preços</span>
                          </div>
                          <p className="font-medium text-foreground text-sm">
                            {order.price_table.name}
                          </p>
                        </div>
                      )}
                      {order.vehicle_type && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Truck className="w-4 h-4" />
                            <span className="text-xs">Veículo</span>
                          </div>
                          <p className="font-medium text-foreground text-sm">
                            {order.vehicle_type.name} ({order.vehicle_type.code})
                          </p>
                        </div>
                      )}
                      {order.payment_term && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <CreditCard className="w-4 h-4" />
                            <span className="text-xs">Prazo Pagamento</span>
                          </div>
                          <p className="font-medium text-foreground text-sm">
                            {order.payment_term.name}
                          </p>
                        </div>
                      )}
                      {order.km_distance != null && (
                        <div className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Route className="w-4 h-4" />
                            <span className="text-xs">Distância</span>
                          </div>
                          <p className="font-medium text-foreground text-sm">
                            {Number(order.km_distance).toLocaleString('pt-BR')} km
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">
                            Placa: <span className="font-mono">{vehicleByPlate.plate}</span>
                            {vehicleByPlate.brand && vehicleByPlate.model && (
                              <span className="text-muted-foreground">
                                {' '}
                                · {vehicleByPlate.brand} {vehicleByPlate.model}
                              </span>
                            )}
                          </p>
                          {vehicleByPlate.vehicle_type?.name && (
                            <p className="text-muted-foreground">
                              Tipo: {vehicleByPlate.vehicle_type.name}
                            </p>
                          )}
                          {vehicleByPlate.driver?.name && (
                            <p className="text-foreground">
                              Motorista: {vehicleByPlate.driver.name}
                              {vehicleByPlate.driver.cnh && (
                                <span className="text-muted-foreground">
                                  {' '}
                                  · CNH: {vehicleByPlate.driver.cnh}
                                </span>
                              )}
                              {vehicleByPlate.driver.antt && (
                                <span className="text-muted-foreground">
                                  {' '}
                                  · ANTT: {vehicleByPlate.driver.antt}
                                </span>
                              )}
                            </p>
                          )}
                          {vehicleByPlate.owner?.name && (
                            <p className="text-foreground">
                              Proprietário: {vehicleByPlate.owner.name}
                            </p>
                          )}
                        </div>
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
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                              {order.driver_phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3.5 h-3.5" />
                                  {order.driver_phone}
                                </span>
                              )}
                              {order.driver_cnh && <span>CNH: {order.driver_cnh}</span>}
                              {order.driver_antt && <span>ANTT: {order.driver_antt}</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
                              {order.vehicle_plate && (
                                <span className="font-mono">{order.vehicle_plate}</span>
                              )}
                              {order.vehicle_brand && order.vehicle_model && (
                                <span>
                                  {order.vehicle_brand} {order.vehicle_model}
                                </span>
                              )}
                              {order.vehicle_type_name && (
                                <span>Tipo: {order.vehicle_type_name}</span>
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

                {/* Qualificação do Motorista (busca_motorista stage) */}
                {showDriverSection && order.driver_name && (
                  <DriverQualificationPanel orderId={order.id} canManage={canManage} />
                )}

                {/* Compliance Widget */}
                {showDriverSection && <ComplianceWidget orderId={order.id} />}

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

                      {/* R$/KM — comparativo ANTT vs Real */}
                      {Number(kmDistance ?? 0) > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">
                            Custo R$/km
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">ANTT R$/km</p>
                              <p className="font-semibold text-foreground">
                                {order.carreteiro_antt != null
                                  ? `R$ ${(Number(order.carreteiro_antt) / Number(kmDistance)).toFixed(2)}/km`
                                  : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Real R$/km</p>
                              {order.carreteiro_real != null ? (
                                <p
                                  className={cn(
                                    'font-semibold',
                                    order.carreteiro_antt != null &&
                                      Number(order.carreteiro_real) > Number(order.carreteiro_antt)
                                      ? 'text-warning-foreground'
                                      : 'text-success'
                                  )}
                                >
                                  R${' '}
                                  {(Number(order.carreteiro_real) / Number(kmDistance)).toFixed(2)}
                                  /km
                                </p>
                              ) : (
                                <p className="font-semibold text-foreground">—</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
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

              {/* Pedágios Tab */}
              <TabsContent value="pedagios" className="m-0 space-y-4">
                {tollPlazas.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Landmark className="h-4 w-4" />
                        Praças de Pedágio da Rota
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {tollPlazas.length} praça{tollPlazas.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="rounded-md border overflow-auto max-h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10 text-center">#</TableHead>
                            <TableHead>Praça</TableHead>
                            <TableHead>Cidade/UF</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">TAG</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tollPlazas.map((plaza, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-center text-muted-foreground text-xs">
                                {plaza.ordemPassagem || idx + 1}
                              </TableCell>
                              <TableCell className="text-sm font-medium">{plaza.nome}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {plaza.cidade}
                                {plaza.uf ? ` - ${plaza.uf}` : ''}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {plaza.valor.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground">
                                {plaza.valorTag.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow className="font-semibold">
                            <TableCell colSpan={3} className="text-right">
                              Total ({tollPlazas.length} praça{tollPlazas.length !== 1 ? 's' : ''})
                            </TableCell>
                            <TableCell className="text-right">
                              {tollPlazas
                                .reduce((sum, p) => sum + p.valor, 0)
                                .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {tollPlazas
                                .reduce((sum, p) => sum + p.valorTag, 0)
                                .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Landmark className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma praça de pedágio registrada.
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Dados de pedágio são clonados da cotação ao criar a OS.
                    </p>
                  </div>
                )}
              </TabsContent>

              {showDocsTab && (
                <TabsContent value="documents" className="m-0 space-y-6">
                  {canManage && <DocumentUpload orderId={order.id} orderStage={order.stage} />}
                  <Separator />
                  <DocumentList orderId={order.id} />
                </TabsContent>
              )}

              {/* Timeline Tab */}
              <TabsContent value="timeline" className="m-0 space-y-4">
                <h4 className="font-semibold text-foreground">Linha do Tempo</h4>
                <div className="relative pl-6 space-y-0">
                  {(() => {
                    const STAGE_FLOW: { id: OrderStage; label: string; color: string }[] = [
                      { id: 'ordem_criada', label: 'Ordem Criada', color: 'bg-slate-500' },
                      { id: 'busca_motorista', label: 'Busca Motorista', color: 'bg-violet-500' },
                      { id: 'documentacao', label: 'Documentação', color: 'bg-primary' },
                      { id: 'coleta_realizada', label: 'Coleta Realizada', color: 'bg-orange-500' },
                      { id: 'em_transito', label: 'Em Trânsito', color: 'bg-blue-500' },
                      { id: 'entregue', label: 'Entregue', color: 'bg-emerald-500' },
                    ];
                    const currentIdx = STAGE_FLOW.findIndex((s) => s.id === order.stage);

                    return STAGE_FLOW.map((stage, idx) => {
                      const isCompleted = idx < currentIdx;
                      const isCurrent = idx === currentIdx;
                      const isFuture = idx > currentIdx;

                      return (
                        <div key={stage.id} className="relative flex items-start pb-6 last:pb-0">
                          {/* Vertical line */}
                          {idx < STAGE_FLOW.length - 1 && (
                            <div
                              className={cn(
                                'absolute left-[-16px] top-5 w-0.5 h-full',
                                isCompleted
                                  ? 'bg-emerald-400'
                                  : isCurrent
                                    ? 'bg-primary/30'
                                    : 'bg-border'
                              )}
                            />
                          )}
                          {/* Dot */}
                          <div
                            className={cn(
                              'absolute left-[-20px] top-1 w-3 h-3 rounded-full border-2 z-10',
                              isCompleted
                                ? 'bg-emerald-500 border-emerald-500'
                                : isCurrent
                                  ? `${stage.color} border-primary ring-4 ring-primary/20`
                                  : 'bg-background border-muted-foreground/30'
                            )}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'text-sm font-medium',
                                  isFuture ? 'text-muted-foreground/50' : 'text-foreground'
                                )}
                              >
                                {stage.label}
                              </span>
                              {isCurrent && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary"
                                >
                                  ATUAL
                                </Badge>
                              )}
                              {isCompleted && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isCurrent
                                ? `Desde ${formatDate(order.updated_at)}`
                                : isCompleted
                                  ? 'Concluído'
                                  : 'Pendente'}
                            </p>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Timestamps */}
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Criada em</span>
                    <span className="text-foreground">{formatDate(order.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Última atualização</span>
                    <span className="text-foreground">{formatDate(order.updated_at)}</span>
                  </div>
                  {order.eta && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ETA</span>
                      <span className="text-foreground">{formatDate(order.eta)}</span>
                    </div>
                  )}
                </div>
              </TabsContent>

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
