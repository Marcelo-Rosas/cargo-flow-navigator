import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Truck,
  Scale,
  DollarSign,
  Route,
  AlertTriangle,
  Loader2,
  RefreshCw,
  FileText,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { useCiotOperations } from '@/hooks/useCiotOperations';
import type { OrderWithOccurrences } from '@/hooks/useOrders';

interface CiotPanelProps {
  order: OrderWithOccurrences;
  canManage?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  generated: {
    label: 'Gerado',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <ShieldCheck className="w-4 h-4" />,
  },
  pending: {
    label: 'Pendente',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <Clock className="w-4 h-4" />,
  },
  error: {
    label: 'Erro',
    color: 'bg-red-50 text-red-700 border-red-200',
    icon: <ShieldAlert className="w-4 h-4" />,
  },
  cancelled: {
    label: 'Cancelado',
    color: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: <XCircle className="w-4 h-4" />,
  },
  validation_failed: {
    label: 'Validação Falhou',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
};

export function CiotPanel({ order, canManage = true }: CiotPanelProps) {
  const qc = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const { data: operations, isLoading } = useCiotOperations(order.id);

  const ciotNumber = (order as unknown as { ciot_number?: string | null }).ciot_number;
  const ciotStatus = (order as unknown as { ciot_status?: string | null }).ciot_status || 'pending';
  const config = STATUS_CONFIG[ciotStatus] || STATUS_CONFIG.pending;

  const canGenerate =
    canManage &&
    !ciotNumber &&
    (order.stage === 'documentacao' || order.stage === 'coleta_realizada') &&
    !!order.vehicle_plate;

  const handleGenerate = async () => {
    if (!order.vehicle_plate) {
      toast.error('Placa do veículo é obrigatória para gerar CIOT');
      return;
    }
    setIsGenerating(true);
    try {
      const result = await invokeEdgeFunction<{
        success: boolean;
        ciotNumber?: string;
        status?: string;
        message?: string;
        operationId?: string;
        anttPisoMinimo?: number;
        belowFloor?: boolean;
      }>('generate-ciot', {
        body: { orderId: order.id },
      });

      if (result.success && result.ciotNumber) {
        toast.success(`CIOT ${result.ciotNumber} gerado com sucesso`);
        await qc.invalidateQueries({ queryKey: ['ciot-operations', order.id] });
        await qc.invalidateQueries({ queryKey: ['orders'] });
      } else {
        toast.error(result.message || 'Falha ao gerar CIOT');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Erro ao gerar CIOT: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (v: number | null) =>
    v != null
      ? new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(v)
      : '-';

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(d));

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Status do CIOT
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border',
                  config.color
                )}
              >
                {config.icon}
              </div>
              <div>
                <p className="font-semibold text-foreground">{config.label}</p>
                {ciotNumber ? (
                  <p className="text-sm text-muted-foreground font-mono">{ciotNumber}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    CIOT ainda não gerado para esta OS
                  </p>
                )}
              </div>
            </div>
            {canGenerate && (
              <Button size="sm" onClick={handleGenerate} disabled={isGenerating} className="gap-2">
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                {isGenerating ? 'Gerando...' : 'Gerar CIOT'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Requisitos / Dados da Operação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" />
            Dados da Operação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Placa</p>
                  <p className="text-sm font-medium">
                    {order.vehicle_plate || (
                      <span className="text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Pendente
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Peso</p>
                  <p className="text-sm font-medium">
                    {order.weight ? `${order.weight.toLocaleString('pt-BR')} kg` : '-'}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Valor do Frete</p>
                  <p className="text-sm font-medium">{formatCurrency(Number(order.value))}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Distância</p>
                  <p className="text-sm font-medium">
                    {order.km_distance ? `${order.km_distance.toLocaleString('pt-BR')} km` : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Operações CIOT */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            Histórico de Operações CIOT
            {operations && operations.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {operations.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !operations || operations.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Nenhuma operação CIOT registrada
            </div>
          ) : (
            <div className="space-y-3">
              {operations.map((op) => {
                const opConfig = STATUS_CONFIG[op.status] || STATUS_CONFIG.pending;
                const payload = op.payload as {
                  cpfCnpj?: string;
                  transportadorCnpj?: string;
                  placa?: string;
                  valorFrete?: number;
                  ambiente?: string;
                };
                return (
                  <div
                    key={op.id}
                    className="p-3 rounded-lg border border-border bg-muted/20 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs', opConfig.color)}>{opConfig.icon}</span>
                        <Badge variant="outline" className={cn('text-xs', opConfig.color)}>
                          {opConfig.label}
                        </Badge>
                        {op.ambiente === 'homologacao' && (
                          <Badge variant="secondary" className="text-[10px]">
                            HML
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(op.created_at)}
                      </span>
                    </div>

                    {op.ciot_number && (
                      <p className="text-sm font-mono font-medium text-foreground">
                        {op.ciot_number}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>Placa: {payload.placa || '-'}</span>
                      <span>Frete: {formatCurrency(payload.valorFrete ?? null)}</span>
                      {op.antt_piso_minimo != null && (
                        <span className="col-span-2">
                          Piso ANTT: {formatCurrency(op.antt_piso_minimo)}
                          {op.below_floor && (
                            <span className="text-destructive ml-1">(abaixo do piso)</span>
                          )}
                        </span>
                      )}
                    </div>

                    {op.error_message && (
                      <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                        {op.error_message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
