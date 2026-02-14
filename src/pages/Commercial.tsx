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
import { motion } from 'framer-motion';
import { Plus, Filter, Search, Loader2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { KanbanColumn } from '@/components/boards/KanbanColumn';
import { QuoteCard } from '@/components/boards/QuoteCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuotes, useUpdateQuoteStage } from '@/hooks/useQuotes';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { QuoteForm } from '@/components/forms/QuoteForm';
import { ConvertQuoteModal } from '@/components/modals/ConvertQuoteModal';
import { QuoteDetailModal } from '@/components/modals/QuoteDetailModal';

type Quote = Database['public']['Tables']['quotes']['Row'];
type QuoteStage = Database['public']['Enums']['quote_stage'];

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
  const { data: quotes, isLoading, isError, error, refetch } = useQuotes();
  const updateStageMutation = useUpdateQuoteStage();
  const [activeQuote, setActiveQuote] = useState<Quote | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [convertingQuote, setConvertingQuote] = useState<Quote | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

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

  const quotesByStage = useMemo(() => {
    const grouped: Record<QuoteStage, Quote[]> = {
      novo_pedido: [],
      qualificacao: [],
      precificacao: [],
      enviado: [],
      negociacao: [],
      ganho: [],
      perdido: [],
    };

    filteredQuotes.forEach((quote) => {
      grouped[quote.stage].push(quote);
    });

    return grouped;
  }, [filteredQuotes]);

  const handleDragStart = (event: DragStartEvent) => {
    const quote = quotes?.find((q) => q.id === event.active.id);
    if (quote) setActiveQuote(quote);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveQuote(null);

    if (!over || !quotes) return;

    const activeQuote = quotes.find((q) => q.id === active.id);
    if (!activeQuote) return;

    // Check if dropped on a column
    const targetStage = QUOTE_STAGES.find((s) => s.id === over.id);
    if (targetStage && targetStage.id !== activeQuote.stage) {
      // If moving to "ganho", open convert modal
      if (targetStage.id === 'ganho') {
        setConvertingQuote(activeQuote);
        return;
      }
      
      try {
        await updateStageMutation.mutateAsync({ 
          id: activeQuote.id, 
          stage: targetStage.id 
        });
        toast.success(`Cotação movida para ${targetStage.label}`);
      } catch (error) {
        toast.error('Erro ao mover cotação');
      }
      return;
    }

    // Check if dropped on another card (same stage)
    const overQuote = quotes.find((q) => q.id === over.id);
    if (overQuote && activeQuote.stage !== overQuote.stage) {
      try {
        await updateStageMutation.mutateAsync({ 
          id: activeQuote.id, 
          stage: overQuote.stage 
        });
        toast.success(`Cotação movida para ${QUOTE_STAGES.find(s => s.id === overQuote.stage)?.label}`);
      } catch (error) {
        toast.error('Erro ao mover cotação');
      }
    }
  };

  const totalPipelineValue = useMemo(() => {
    if (!quotes) return 0;
    return quotes
      .filter((q) => q.stage !== 'perdido' && q.stage !== 'ganho')
      .reduce((acc, q) => acc + Number(q.value), 0);
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
          <h2 className="text-lg font-semibold text-foreground">Não foi possível carregar as cotações</h2>
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
            Board Comercial
          </motion.h1>
          <motion.p
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Pipeline total: <span className="font-semibold text-primary">{formatCurrency(totalPipelineValue)}</span>
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
          <Button className="gap-2" onClick={() => setIsFormOpen(true)}>
            <Plus className="w-4 h-4" />
            Nova Cotação
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        /* Kanban Board */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6">
            {QUOTE_STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                id={stage.id}
                title={stage.label}
                count={quotesByStage[stage.id].length}
                color={stage.color}
                items={quotesByStage[stage.id].map((q) => q.id)}
              >
                {quotesByStage[stage.id].map((quote) => (
                  <QuoteCard 
                    key={quote.id} 
                    quote={quote} 
                    onEdit={() => setSelectedQuote(quote)}
                  />
                ))}
              </KanbanColumn>
            ))}
          </div>

          <DragOverlay>
            {activeQuote && <QuoteCard quote={activeQuote} />}
          </DragOverlay>
        </DndContext>
      )}

      {/* Quote Form Modal */}
      <QuoteForm open={isFormOpen} onClose={() => setIsFormOpen(false)} />
      
      {/* Quote Detail Modal */}
      <QuoteDetailModal 
        open={!!selectedQuote} 
        onClose={() => setSelectedQuote(null)} 
        quote={selectedQuote}
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
