import { useState, useMemo } from 'react';
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
import { arrayMove } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { Plus, Filter, Search, List, LayoutGrid } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { KanbanColumn } from '@/components/boards/KanbanColumn';
import { OrderCard } from '@/components/boards/OrderCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ServiceOrder, OrderStage, ORDER_STAGES } from '@/types';
import { mockOrders } from '@/data/mockData';

const stageColors: Record<OrderStage, string> = {
  ordem_criada: 'bg-muted-foreground',
  busca_motorista: 'bg-accent-foreground',
  documentacao: 'bg-primary',
  coleta_realizada: 'bg-warning',
  em_transito: 'bg-warning',
  entregue: 'bg-success',
};

export default function Operations() {
  const [orders, setOrders] = useState<ServiceOrder[]>(mockOrders);
  const [activeOrder, setActiveOrder] = useState<ServiceOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(
      (o) =>
        o.osNumber.toLowerCase().includes(term) ||
        o.clientName.toLowerCase().includes(term) ||
        o.origin.toLowerCase().includes(term) ||
        o.destination.toLowerCase().includes(term) ||
        (o.driverName && o.driverName.toLowerCase().includes(term))
    );
  }, [orders, searchTerm]);

  const ordersByStage = useMemo(() => {
    const grouped: Record<OrderStage, ServiceOrder[]> = {
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
    const order = orders.find((o) => o.id === event.active.id);
    if (order) setActiveOrder(order);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOrder(null);

    if (!over) return;

    const activeOrder = orders.find((o) => o.id === active.id);
    if (!activeOrder) return;

    // Check if dropped on a column
    const targetStage = ORDER_STAGES.find((s) => s.id === over.id);
    if (targetStage) {
      // Validate stage transition (e.g., can't skip to entregue without POD)
      if (targetStage.id === 'entregue' && !activeOrder.hasPod) {
        // Show toast error - need POD to complete
        return;
      }
      
      setOrders((prev) =>
        prev.map((o) =>
          o.id === active.id ? { ...o, stage: targetStage.id } : o
        )
      );
      return;
    }

    // Check if dropped on another card
    const overOrder = orders.find((o) => o.id === over.id);
    if (overOrder && activeOrder.stage === overOrder.stage) {
      const stageOrders = orders.filter((o) => o.stage === activeOrder.stage);
      const oldIndex = stageOrders.findIndex((o) => o.id === active.id);
      const newIndex = stageOrders.findIndex((o) => o.id === over.id);

      if (oldIndex !== newIndex) {
        const newStageOrders = arrayMove(stageOrders, oldIndex, newIndex);
        setOrders((prev) => {
          const otherOrders = prev.filter((o) => o.stage !== activeOrder.stage);
          return [...otherOrders, ...newStageOrders];
        });
      }
    } else if (overOrder) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === active.id ? { ...o, stage: overOrder.stage } : o
        )
      );
    }
  };

  const activeOrdersCount = orders.filter(
    (o) => o.stage !== 'entregue'
  ).length;

  const pendingDeliveries = orders.filter(
    (o) => o.stage === 'em_transito'
  ).length;

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
            <span className="font-semibold text-primary">{activeOrdersCount}</span> ordens ativas • <span className="font-semibold text-warning">{pendingDeliveries}</span> em trânsito
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
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nova OS
          </Button>
        </div>
      </div>

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
                  <OrderCard key={order.id} order={order} />
                ))}
              </KanbanColumn>
            ))}
          </div>

          <DragOverlay>
            {activeOrder && <OrderCard order={activeOrder} />}
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">OS</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Cliente</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Rota</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Motorista</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Docs</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.map((order) => {
                  const stage = ORDER_STAGES.find((s) => s.id === order.stage);
                  return (
                    <tr key={order.id} className="hover:bg-muted/30 cursor-pointer transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{order.osNumber}</td>
                      <td className="px-4 py-3 text-foreground">{order.clientName}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {order.origin} → {order.destination}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {order.driverName || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${stageColors[order.stage]} bg-opacity-20`}>
                          {stage?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <span className={`w-2 h-2 rounded-full ${order.hasNfe ? 'bg-success' : 'bg-muted'}`} title="NF-e" />
                          <span className={`w-2 h-2 rounded-full ${order.hasCte ? 'bg-success' : 'bg-muted'}`} title="CT-e" />
                          <span className={`w-2 h-2 rounded-full ${order.hasPod ? 'bg-success' : 'bg-muted'}`} title="POD" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.value)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </MainLayout>
  );
}
