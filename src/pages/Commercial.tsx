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
import { Plus, Filter, Search } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { KanbanColumn } from '@/components/boards/KanbanColumn';
import { QuoteCard } from '@/components/boards/QuoteCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Quote, QuoteStage, QUOTE_STAGES } from '@/types';
import { mockQuotes } from '@/data/mockData';

const stageColors: Record<QuoteStage, string> = {
  novo_pedido: 'bg-muted-foreground',
  qualificacao: 'bg-accent-foreground',
  precificacao: 'bg-primary',
  enviado: 'bg-warning',
  negociacao: 'bg-warning',
  ganho: 'bg-success',
  perdido: 'bg-destructive',
};

export default function Commercial() {
  const [quotes, setQuotes] = useState<Quote[]>(mockQuotes);
  const [activeQuote, setActiveQuote] = useState<Quote | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const filteredQuotes = useMemo(() => {
    if (!searchTerm) return quotes;
    const term = searchTerm.toLowerCase();
    return quotes.filter(
      (q) =>
        q.clientName.toLowerCase().includes(term) ||
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
    const quote = quotes.find((q) => q.id === event.active.id);
    if (quote) setActiveQuote(quote);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveQuote(null);

    if (!over) return;

    const activeQuote = quotes.find((q) => q.id === active.id);
    if (!activeQuote) return;

    // Check if dropped on a column
    const targetStage = QUOTE_STAGES.find((s) => s.id === over.id);
    if (targetStage) {
      setQuotes((prev) =>
        prev.map((q) =>
          q.id === active.id ? { ...q, stage: targetStage.id } : q
        )
      );
      return;
    }

    // Check if dropped on another card
    const overQuote = quotes.find((q) => q.id === over.id);
    if (overQuote && activeQuote.stage === overQuote.stage) {
      const stageQuotes = quotes.filter((q) => q.stage === activeQuote.stage);
      const oldIndex = stageQuotes.findIndex((q) => q.id === active.id);
      const newIndex = stageQuotes.findIndex((q) => q.id === over.id);

      if (oldIndex !== newIndex) {
        const newStageQuotes = arrayMove(stageQuotes, oldIndex, newIndex);
        setQuotes((prev) => {
          const otherQuotes = prev.filter((q) => q.stage !== activeQuote.stage);
          return [...otherQuotes, ...newStageQuotes];
        });
      }
    } else if (overQuote) {
      // Move to different column at specific position
      setQuotes((prev) =>
        prev.map((q) =>
          q.id === active.id ? { ...q, stage: overQuote.stage } : q
        )
      );
    }
  };

  const totalPipelineValue = useMemo(() => {
    return quotes
      .filter((q) => q.stage !== 'perdido' && q.stage !== 'ganho')
      .reduce((acc, q) => acc + q.value, 0);
  }, [quotes]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

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
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Cotação
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
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
              color={stageColors[stage.id]}
              items={quotesByStage[stage.id].map((q) => q.id)}
            >
              {quotesByStage[stage.id].map((quote) => (
                <QuoteCard key={quote.id} quote={quote} />
              ))}
            </KanbanColumn>
          ))}
        </div>

        <DragOverlay>
          {activeQuote && <QuoteCard quote={activeQuote} />}
        </DragOverlay>
      </DndContext>
    </MainLayout>
  );
}
