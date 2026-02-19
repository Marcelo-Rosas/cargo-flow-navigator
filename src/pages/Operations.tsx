import { useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { Plus, Filter, Search, List, LayoutGrid, Loader2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { KanbanColumn } from '@/components/boards/KanbanColumn';
import { OrderCard } from '@/components/boards/OrderCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useOrders,
  useUpdateOrderStage,
  useUpdateOrder,
  OrderWithOccurrences,
} from '@/hooks/useOrders';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { OrderForm } from '@/components/forms/OrderForm';
import { OrderDetailModal } from '@/components/modals/OrderDetailModal';
import { OccurrenceForm } from '@/components/forms/OccurrenceForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MaskedInput } from '@/components/ui/masked-input';

type OrderStage = Database['public']['Enums']['order_stage'];

const ORDER_STAGES: { id: OrderStage; label: string; color: string }[] = [
  { id: 'ordem_criada', label: 'Ordem Criada', color: 'bg-muted-foreground' },
  { id: 'busca_motorista', label: 'Busca Motorista', color: 'bg-accent-foreground' },
  { id: 'documentacao', label: 'Documentação', color: 'bg-primary' },
  { id: 'coleta_realizada', label: 'Coleta Realizada', color: 'bg-warning' },
  { id: 'em_transito', label: 'Em Trânsito', color: 'bg-warning' },
  { id: 'entregue', label: 'Entregue', color: 'bg-success' },
];

const stageColors: Record<OrderStage, string> = {
  ordem_criada: 'bg-muted-foreground',
  busca_motorista: 'bg-accent-foreground',
  documentacao: 'bg-primary',
  coleta_realizada: 'bg-warning',
  em_transito: 'bg-warning',
  entregue: 'bg-success',
};

export default function Operations() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { canWrite } = useUserRole();
  const { data: orders, isLoading, isError, error, refetch } = useOrders();
  const updateStageMutation = useUpdateOrderStage();
  const updateOrderMutation = useUpdateOrder();
  const [activeOrder, setActiveOrder] = useState<OrderWithOccurrences | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    orderId: string;
    order: OrderWithOccurrences;
    newStage: OrderStage;
  } | null>(null);
  const [carreteiroRealCents, setCarreteiroRealCents] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithOccurrences | null>(null);
  const [occurrenceOrder, setOccurrenceOrder] = useState<OrderWithOccurrences | null>(null);
  const canManageOperations = canWrite;

  // Enable realtime updates
  useRealtimeSubscription(['orders', 'occurrences']);

  // Deep-link support: /operacional?orderId=<uuid>
  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (!orderId) return;
    if (!orders || orders.length === 0) return;

    const order = orders.find((o) => o.id === orderId);
    if (order) setSelectedOrder(order);
  }, [searchParams, orders]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (!searchTerm) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(
      (o) =>
        o.os_number.toLowerCase().includes(term) ||
        o.client_name.toLowerCase().includes(term) ||
        o.origin.toLowerCase().includes(term) ||
        o.destination.toLowerCase().includes(term) ||
        (o.driver_name && o.driver_name.toLowerCase().includes(term))
    );
  }, [orders, searchTerm]);

  const ordersByStage = useMemo(() => {
    const grouped: Record<OrderStage, OrderWithOccurrences[]> = {
      ordem_criada: [],
      busca_motorista: [],
      documentacao: [],
      coleta_realizada: [],
      em_transito: [],
      entregue: [],
    };

    filteredOrders.forEach((order) => {
      grouped[order.stage].push(order);
    });

    return grouped;
  }, [filteredOrders]);

  const handleDragStart = (event: DragStartEvent) => {
    const order = orders?.find((o) => o.id === event.active.id);
    if (order) setActiveOrder(order);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!canManageOperations) {
      toast.error('Seu perfil é somente leitura para alterações');
      setActiveOrder(null);
      return;
    }

    const { active, over } = event;
    setActiveOrder(null);

    if (!over || !orders) return;

    const activeOrder = orders.find((o) => o.id === active.id);
    if (!activeOrder) return;

    // Check if dropped on a column
    const targetStage = ORDER_STAGES.find((s) => s.id === over.id);
    if (targetStage && targetStage.id !== activeOrder.stage) {
      // Validate stage transition (can't skip to entregue without POD)
      if (targetStage.id === 'entregue' && !activeOrder.has_pod) {
        toast.error('É necessário anexar o comprovante de entrega (POD) antes de finalizar');
        return;
      }

      // Busca motorista -> Documentação: exige carreteiro real via modal
      if (activeOrder.stage === 'busca_motorista' && targetStage.id === 'documentacao') {
        setPendingMove({
          orderId: activeOrder.id,
          order: activeOrder,
          newStage: targetStage.id,
        });
        setCarreteiroRealCents(
          activeOrder.carreteiro_antt != null
            ? String(Math.round(Number(activeOrder.carreteiro_antt) * 100))
            : ''
        );
        return;
      }

      try {
        await updateStageMutation.mutateAsync({
          id: activeOrder.id,
          stage: targetStage.id,
        });
        toast.success(`OS movida para ${targetStage.label}`);
      } catch (error: unknown) {
        const msg = (error instanceof Error ? error.message : String(error)).toString();
        if (
          msg.toLowerCase().includes('pod obrigatório') ||
          msg.toLowerCase().includes('pod obrigatorio')
        ) {
          toast.error('Anexe o comprovante de entrega (POD) antes de finalizar');
          return;
        }
        if (
          msg.toLowerCase().includes('carreteiro real') ||
          msg.toLowerCase().includes('documentação') ||
          msg.toLowerCase().includes('documentacao')
        ) {
          setPendingMove({
            orderId: activeOrder.id,
            order: activeOrder,
            newStage: 'documentacao',
          });
          const antt = Number(activeOrder.carreteiro_antt ?? 0);
          setCarreteiroRealCents(antt > 0 ? String(Math.round(antt * 100)) : '');
          toast.error('Informe o carreteiro real para avançar para Documentação');
          return;
        }
        toast.error('Erro ao mover OS');
      }
      return;
    }

    // Check if dropped on another card
    const overOrder = orders.find((o) => o.id === over.id);
    if (overOrder && activeOrder.stage !== overOrder.stage) {
      if (overOrder.stage === 'entregue' && !activeOrder.has_pod) {
        toast.error('É necessário anexar o comprovante de entrega (POD) antes de finalizar');
        return;
      }

      if (activeOrder.stage === 'busca_motorista' && overOrder.stage === 'documentacao') {
        setPendingMove({
          orderId: activeOrder.id,
          order: activeOrder,
          newStage: overOrder.stage,
        });
        setCarreteiroRealCents(
          activeOrder.carreteiro_antt != null
            ? String(Math.round(Number(activeOrder.carreteiro_antt) * 100))
            : ''
        );
        return;
      }

      try {
        await updateStageMutation.mutateAsync({
          id: activeOrder.id,
          stage: overOrder.stage,
        });
        toast.success(
          `OS movida para ${ORDER_STAGES.find((s) => s.id === overOrder.stage)?.label}`
        );
      } catch (error: unknown) {
        const msg = (error instanceof Error ? error.message : String(error)).toString();
        if (
          msg.toLowerCase().includes('pod obrigatório') ||
          msg.toLowerCase().includes('pod obrigatorio')
        ) {
          toast.error('Anexe o comprovante de entrega (POD) antes de finalizar');
          return;
        }
        if (
          msg.toLowerCase().includes('carreteiro real') ||
          msg.toLowerCase().includes('documentação') ||
          msg.toLowerCase().includes('documentacao')
        ) {
          setPendingMove({
            orderId: activeOrder.id,
            order: activeOrder,
            newStage: 'documentacao',
          });
          const antt = Number(activeOrder.carreteiro_antt ?? 0);
          setCarreteiroRealCents(antt > 0 ? String(Math.round(antt * 100)) : '');
          toast.error('Informe o carreteiro real para avançar para Documentação');
          return;
        }
        toast.error('Erro ao mover OS');
      }
    }
  };

  const handleConfirmCarreteiroReal = async () => {
    if (!pendingMove) return;
    const valueReais = carreteiroRealCents ? Number(carreteiroRealCents) / 100 : 0;
    if (valueReais <= 0) {
      toast.error('Informe o valor do carreteiro real para avançar.');
      return;
    }
    try {
      await updateOrderMutation.mutateAsync({
        id: pendingMove.orderId,
        updates: { stage: pendingMove.newStage, carreteiro_real: valueReais },
      });
      toast.success('OS movida para Documentação');
      setPendingMove(null);
      setCarreteiroRealCents('');
    } catch (error: unknown) {
      const msg = (error instanceof Error ? error.message : String(error)).toString();
      toast.error(msg || 'Erro ao atualizar OS');
    }
  };

  const activeOrdersCount = orders?.filter((o) => o.stage !== 'entregue').length || 0;
  const pendingDeliveries = orders?.filter((o) => o.stage === 'em_transito').length || 0;

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">Faça login para acessar o board operacional</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (isError) {
    return (
      <MainLayout>
        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Não foi possível carregar as OS</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {(error instanceof Error && error.message) ||
              'Erro inesperado ao buscar ordens de serviço.'}
          </p>
          <div className="mt-4">
            <Button onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <motion.h1
            className="text-3xl font-bold text-foreground"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Board Operacional
          </motion.h1>
          <motion.p
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <span className="font-semibold text-primary">{activeOrdersCount}</span> ordens ativas •{' '}
            <span className="font-semibold text-warning">{pendingDeliveries}</span> em trânsito
          </motion.p>
        </div>

        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'kanban' | 'list')}>
            <TabsList>
              <TabsTrigger value="kanban" className="gap-2">
                <LayoutGrid className="w-4 h-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="w-4 h-4" />
                Lista
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar OS, cliente..."
              className="pl-10 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" aria-label="Filtrar ordens de serviço">
            <Filter className="w-4 h-4" />
          </Button>
          {canManageOperations && (
            <Button className="gap-2" onClick={() => setIsFormOpen(true)}>
              <Plus className="w-4 h-4" />
              Nova OS
            </Button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Kanban Board */}
          {viewMode === 'kanban' && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6">
                {ORDER_STAGES.map((stage) => (
                  <KanbanColumn
                    key={stage.id}
                    id={stage.id}
                    title={stage.label}
                    count={ordersByStage[stage.id].length}
                    color={stageColors[stage.id]}
                    items={ordersByStage[stage.id].map((o) => o.id)}
                  >
                    {ordersByStage[stage.id].map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onEdit={() => setSelectedOrder(order)}
                        onRegisterOccurrence={
                          canManageOperations ? () => setOccurrenceOrder(order) : undefined
                        }
                        canManageActions={canManageOperations}
                      />
                    ))}
                  </KanbanColumn>
                ))}
              </div>

              <DragOverlay>
                {activeOrder && (
                  <OrderCard order={activeOrder} canManageActions={canManageOperations} />
                )}
              </DragOverlay>
            </DndContext>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card rounded-xl border border-border shadow-card overflow-hidden"
            >
              {filteredOrders.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-muted-foreground">Nenhuma ordem de serviço encontrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          OS
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Cliente
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Rota
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Motorista
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          Docs
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                          Valor
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredOrders.map((order) => {
                        const stage = ORDER_STAGES.find((s) => s.id === order.stage);
                        return (
                          <tr
                            key={order.id}
                            className="hover:bg-muted/30 cursor-pointer transition-colors"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <td className="px-4 py-3 font-medium text-foreground">
                              {order.os_number}
                            </td>
                            <td className="px-4 py-3 text-foreground">{order.client_name}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {order.origin} → {order.destination}
                            </td>
                            <td className="px-4 py-3 text-foreground">
                              {order.driver_name || '-'}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${stageColors[order.stage]} bg-opacity-20`}
                              >
                                {stage?.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <span
                                  className={`w-2 h-2 rounded-full ${order.has_nfe ? 'bg-success' : 'bg-muted'}`}
                                  title="NF-e"
                                />
                                <span
                                  className={`w-2 h-2 rounded-full ${order.has_cte ? 'bg-success' : 'bg-muted'}`}
                                  title="CT-e"
                                />
                                <span
                                  className={`w-2 h-2 rounded-full ${order.has_pod ? 'bg-success' : 'bg-muted'}`}
                                  title="POD"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-foreground">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(Number(order.value))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}

      {/* Order Form Modal */}
      <OrderForm open={isFormOpen} onClose={() => setIsFormOpen(false)} />

      {/* Order Detail Modal */}
      <OrderDetailModal
        open={!!selectedOrder}
        onClose={() => {
          setSelectedOrder(null);
          // If opened via deep-link, clean the URL
          if (searchParams.get('orderId')) {
            navigate('/operacional', { replace: true });
          }
        }}
        order={selectedOrder}
        canManage={canManageOperations}
      />

      {/* Occurrence Form */}
      {occurrenceOrder && (
        <OccurrenceForm
          open={!!occurrenceOrder}
          onClose={() => setOccurrenceOrder(null)}
          orderId={occurrenceOrder.id}
          osNumber={occurrenceOrder.os_number}
        />
      )}

      {/* Modal: Carreteiro real ao mover Busca Motorista -> Documentação */}
      <Dialog
        open={!!pendingMove}
        onOpenChange={(open) => {
          if (!open) {
            setPendingMove(null);
            setCarreteiroRealCents('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carreteiro real</DialogTitle>
            <DialogDescription>
              Para avançar para Documentação é obrigatório informar o valor do carreteiro real (R$).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Valor (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  R$
                </span>
                <MaskedInput
                  mask="currency"
                  placeholder="0,00"
                  className="pl-10"
                  value={carreteiroRealCents}
                  onValueChange={(rawValue) => setCarreteiroRealCents(rawValue)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingMove(null);
                setCarreteiroRealCents('');
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmCarreteiroReal} disabled={updateOrderMutation.isPending}>
              {updateOrderMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                'Confirmar e mover'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
