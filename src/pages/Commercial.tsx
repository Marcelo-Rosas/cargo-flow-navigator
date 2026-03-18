import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { Plus, Filter, Search, CalendarDays } from 'lucide-react';
import { LoadingFollowUpPanel } from '@/components/commercial/LoadingFollowUpPanel';
import { KanbanSkeleton } from '@/components/skeletons/KanbanSkeleton';
import { MainLayout } from '@/components/layout/MainLayout';
import { KanbanColumn } from '@/components/boards/KanbanColumn';
import { QuoteCard } from '@/components/boards/QuoteCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuotes, useUpdateQuoteStage } from '@/hooks/useQuotes';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Database } from '@/integrations/supabase/types';
import { findContainer, moveItem, type ItemsState } from '@/lib/kanban-dnd';
import { toast } from 'sonner';
import { QuoteForm } from '@/components/forms/QuoteForm';
import { ConvertQuoteModal } from '@/components/modals/ConvertQuoteModal';
import { QuoteDetailModal } from '@/components/modals/QuoteDetailModal';
import { SendQuoteEmailModal } from '@/components/modals/SendQuoteEmailModal';
import { LoadCompositionPanel } from '@/components/LoadCompositionPanel';
import { MarketIntelligencePanel } from '@/components/market/MarketIntelligencePanel';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';

type Quote = Database['public']['Tables']['quotes']['Row'];
type QuoteStage = Database['public']['Enums']['quote_stage'];
type CommercialTab = 'kanban' | 'market-intelligence';

const COMMERCIAL_TABS: { id: CommercialTab; label: string }[] = [
  { id: 'kanban', label: 'Kanban Comercial' },
  { id: 'market-intelligence', label: 'Inteligência NTC' },
];

const QUOTE_STAGES: { id: QuoteStage; label: string; color: string }[] = [
  { id: 'novo_pedido', label: 'Novo Pedido', color: 'bg-muted-foreground' },
  { id: 'qualificacao', label: 'Qualificação', color: 'bg-accent-foreground' },
  { id: 'precificacao', label: 'Precificação', color: 'bg-primary' },
  { id: 'enviado', label: 'Enviado', color: 'bg-warning' },
  { id: 'negociacao', label: 'Negociação', color: 'bg-warning' },
  { id: 'ganho', label: 'Ganho', color: 'bg-success' },
  { id: 'perdido', label: 'Perdido', color: 'bg-destructive' },
];

export default function Commercial() {
  const { user } = useAuth();
  const { canWrite } = useUserRole();
  const { data: quotes, isLoading, isError, error, refetch } = useQuotes();
  const updateStageMutation = useUpdateQuoteStage();
  const [activeTab, setActiveTab] = useState<CommercialTab>('kanban');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [convertingQuote, setConvertingQuote] = useState<Quote | null>(null);
  const [emailingQuote, setEmailingQuote] = useState<Quote | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const canManageCommercial = canWrite;

  type QuoteItemsState = ItemsState<Quote>;

  // Canonical Kanban state: quotes grouped by stage with stable ordering.
  const buildItemsState = useCallback((source: Quote[] | undefined): QuoteItemsState => {
    const base: QuoteItemsState = {
      novo_pedido: [],
      qualificacao: [],
      precificacao: [],
      enviado: [],
      negociacao: [],
      ganho: [],
      perdido: [],
    };
    if (!source) return base;
    for (const quote of source) {
      base[quote.stage]?.push(quote);
    }
    return base;
  }, []);

  const [items, setItems] = useState<QuoteItemsState>(() => buildItemsState(quotes));

  // Snapshot for rollback on mutation error.
  const snapshotRef = useRef<QuoteItemsState | null>(null);

  // Guard to prevent jitter when crossing containers quickly.
  const recentlyMovedToNewContainer = useRef(false);

  // Sincroniza selectedQuote com o cache quando quotes atualiza (após save/edit)
  useEffect(() => {
    if (!selectedQuote) return;
    const freshQuote = quotes?.find((q) => q.id === selectedQuote.id);
    if (freshQuote && freshQuote.updated_at !== selectedQuote.updated_at) {
      setSelectedQuote(freshQuote);
    }
  }, [quotes, selectedQuote]);

  // Enable realtime updates
  useRealtimeSubscription(['quotes']);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const filteredQuotes = useMemo(() => {
    if (!quotes) return [];
    if (!searchTerm) return quotes;
    const term = searchTerm.toLowerCase();
    return quotes.filter(
      (q) =>
        q.client_name.toLowerCase().includes(term) ||
        q.origin.toLowerCase().includes(term) ||
        q.destination.toLowerCase().includes(term)
    );
  }, [quotes, searchTerm]);

  // Sync local Kanban items whenever the filtered list changes,
  // but never clobber the optimistic state while a drag is active.
  useEffect(() => {
    if (activeId) return;
    setItems(buildItemsState(filteredQuotes));
  }, [filteredQuotes, buildItemsState, activeId]);

  const activeQuote = useMemo(
    () => (activeId ? (quotes?.find((q) => q.id === activeId) ?? null) : null),
    [activeId, quotes]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      setActiveId(id);
      snapshotRef.current = items;
    },
    [items]
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    setItems((previous) => {
      const next = moveItem(previous, active.id, over.id);
      if (!next) return previous;

      const fromContainer = findContainer(previous, active.id);
      const toContainer = findContainer(next, active.id);

      if (fromContainer && toContainer && fromContainer !== toContainer) {
        if (recentlyMovedToNewContainer.current) {
          return previous;
        }
        recentlyMovedToNewContainer.current = true;
        requestAnimationFrame(() => {
          recentlyMovedToNewContainer.current = false;
        });
      }

      return next;
    });
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) {
        // Dropped outside any droppable — rollback to snapshot if we have one.
        if (snapshotRef.current) {
          setItems(snapshotRef.current);
          snapshotRef.current = null;
        }
        return;
      }

      const activeIdStr = String(active.id);
      const previous = snapshotRef.current ?? items;
      const fromContainer = findContainer(previous, activeIdStr) as QuoteStage | null;
      const toContainer = findContainer(items, activeIdStr) as QuoteStage | null;

      if (!fromContainer || !toContainer || fromContainer === toContainer) {
        snapshotRef.current = null;
        return;
      }

      const fullQuote = quotes?.find((q) => q.id === activeIdStr);
      if (!fullQuote) {
        snapshotRef.current = null;
        return;
      }

      // Read-only users must not persist changes; rollback visual state.
      if (!canManageCommercial) {
        toast.error('Seu perfil é somente leitura para alterações');
        if (snapshotRef.current) {
          setItems(snapshotRef.current);
        }
        snapshotRef.current = null;
        return;
      }

      const targetStage = toContainer;
      const targetMeta = QUOTE_STAGES.find((s) => s.id === targetStage);

      // Moving to "ganho" opens the convert modal instead of PATCH.
      if (targetStage === 'ganho') {
        setConvertingQuote(fullQuote);
        if (snapshotRef.current) {
          setItems(snapshotRef.current);
        }
        snapshotRef.current = null;
        return;
      }

      try {
        await updateStageMutation.mutateAsync({
          id: fullQuote.id,
          stage: targetStage,
        });
        toast.success(`Cotação movida para ${targetMeta?.label ?? targetStage}`);
      } catch (error) {
        console.error('Erro ao mover cotação', error);
        // Rollback on failure.
        if (snapshotRef.current) {
          setItems(snapshotRef.current);
        }
        toast.error('Erro ao mover cotação');
      } finally {
        snapshotRef.current = null;
      }
    },
    [canManageCommercial, items, quotes, updateStageMutation]
  );

  const totalPipelineValue = useMemo(() => {
    if (!quotes) return 0;
    return quotes
      .filter((q) => q.stage !== 'perdido' && q.stage !== 'ganho')
      .reduce((acc, q) => acc + Number(q.value), 0);
  }, [quotes]);

  const firstShipperId = useMemo(() => {
    if (!quotes || quotes.length === 0) return null;
    return quotes[0]?.shipper_id ?? null;
  }, [quotes]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">Faça login para acessar o board comercial</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (isError) {
    return (
      <MainLayout>
        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Não foi possível carregar as cotações
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {(error instanceof Error && error.message) || 'Erro inesperado ao buscar cotações.'}
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
            Comercial
          </motion.h1>
          <motion.p
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {activeTab === 'kanban'
              ? `Pipeline total: ${formatCurrency(totalPipelineValue)}`
              : 'Índices e Preços de Transporte'}
          </motion.p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cotações..."
              className="pl-10 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" aria-label="Filtrar cotações">
            <Filter className="w-4 h-4" />
          </Button>
          <Sheet open={showFollowUp} onOpenChange={setShowFollowUp}>
            <SheetTrigger asChild>
              <Button
                variant={showFollowUp ? 'default' : 'outline'}
                size="icon"
                aria-label="Follow-up de carregamento"
              >
                <CalendarDays className="w-4 h-4" />
              </Button>
            </SheetTrigger>

            {/* Follow-up + Oportunidades de Consolidação em Sheet lateral */}
            <SheetContent side="right" className="w-[420px] sm:w-[480px] space-y-4">
              <SheetHeader>
                <SheetTitle>Follow-up de Carregamento</SheetTitle>
                <SheetDescription>
                  Acompanhe embarques em negociação e oportunidades de consolidação em uma visão
                  única.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 overflow-y-auto pr-1 h-full">
                <LoadingFollowUpPanel />
                {firstShipperId && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      Oportunidades de Consolidação
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Análise automática de cargas do mesmo embarcador para otimização de rotas.
                    </p>
                    <LoadCompositionPanel shipperId={firstShipperId} />
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
          {canManageCommercial && (
            <Button className="gap-2" onClick={() => setIsFormOpen(true)}>
              <Plus className="w-4 h-4" />
              Nova Cotação
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 mb-6 border-b border-border pb-4">
        {COMMERCIAL_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-primary border-b-2 border-primary -mb-4 pb-2'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'kanban' && (
        <>
          {/* Kanban Board */}
          {/* Mantém o board ocupando toda a largura; follow-up/consolidação abre em Sheet flutuante */}
          {/* Loading State */}
          {isLoading ? (
            <KanbanSkeleton columnCount={7} columnLabels={QUOTE_STAGES} />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6">
                {QUOTE_STAGES.map((stage) => {
                  const columnItems = items[stage.id] ?? [];
                  return (
                    <KanbanColumn
                      key={stage.id}
                      id={stage.id}
                      title={stage.label}
                      count={columnItems.length}
                      color={stage.color}
                      items={columnItems.map((q) => q.id)}
                    >
                      {columnItems.map((quote) => (
                        <QuoteCard
                          key={quote.id}
                          quote={quote}
                          onEdit={() => setSelectedQuote(quote)}
                          onSendEmail={() => setEmailingQuote(quote)}
                          canManageActions={canManageCommercial}
                        />
                      ))}
                    </KanbanColumn>
                  );
                })}
              </div>

              <DragOverlay>
                {activeQuote && (
                  <QuoteCard quote={activeQuote} canManageActions={canManageCommercial} />
                )}
              </DragOverlay>
            </DndContext>
          )}
        </>
      )}

      {activeTab === 'market-intelligence' && (
        <div className="mb-6">
          <MarketIntelligencePanel />
        </div>
      )}

      {/* Quote Form Modal */}
      <QuoteForm open={isFormOpen} onClose={() => setIsFormOpen(false)} />

      {/* Quote Detail Modal */}
      <QuoteDetailModal
        open={!!selectedQuote}
        onClose={() => setSelectedQuote(null)}
        quote={selectedQuote}
        canManage={canManageCommercial}
      />

      {/* Send Quote Email Modal */}
      <SendQuoteEmailModal
        open={!!emailingQuote}
        onClose={() => setEmailingQuote(null)}
        quote={emailingQuote}
      />

      {/* Convert Quote Modal */}
      <ConvertQuoteModal
        open={!!convertingQuote}
        onClose={() => setConvertingQuote(null)}
        quote={convertingQuote}
      />
    </MainLayout>
  );
}
