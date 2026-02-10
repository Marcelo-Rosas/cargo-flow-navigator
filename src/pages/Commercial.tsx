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
import { useQuotes, useUpdateQuoteStage, useCreateQuote, useDeleteQuote } from '@/hooks/useQuotes';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { QuoteForm } from '@/components/forms/QuoteForm';
import { ConvertQuoteModal } from '@/components/modals/ConvertQuoteModal';
import { QuoteDetailModal } from '@/components/modals/QuoteDetailModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const { data: quotes, isLoading } = useQuotes();
  const updateStageMutation = useUpdateQuoteStage();
  const createQuoteMutation = useCreateQuote();
  const deleteQuoteMutation = useDeleteQuote();
  const [activeQuote, setActiveQuote] = useState<Quote | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [convertingQuote, setConvertingQuote] = useState<Quote | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);

  // Enable realtime updates
  useRealtimeSubscription(['quotes']);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleClone = async (quote: Quote) => {
    if (!user) return;

    try {
      const cloned = {
        client_id: quote.client_id,
        client_name: quote.client_name,
        client_email: quote.client_email,
        freight_modality: quote.freight_modality,
        origin: quote.origin,
        destination: quote.destination,
        cargo_type: quote.cargo_type,
        weight: quote.weight,
        volume: quote.volume,
        cubage_weight: quote.cubage_weight,
        billable_weight: quote.billable_weight,
        price_table_id: quote.price_table_id,
        vehicle_type_id: quote.vehicle_type_id,
        payment_term_id: quote.payment_term_id,
        km_distance: quote.km_distance,
        toll_value: quote.toll_value,
        cargo_value: quote.cargo_value,
        value: quote.value,
        pricing_breakdown: quote.pricing_breakdown,
        notes: quote.notes,
        tags: quote.tags,
        validity_date: quote.validity_date,
        waiting_time_cost: quote.waiting_time_cost,
        assigned_to: quote.assigned_to,
        tac_percent: quote.tac_percent,
        conditional_fees_breakdown: quote.conditional_fees_breakdown,
        stage: 'novo_pedido' as QuoteStage,
        created_by: user.id,
      };

      await createQuoteMutation.mutateAsync(cloned as any);
      toast.success('Cotação clonada com sucesso');
    } catch {
      toast.error('Erro ao clonar cotação');
    }
  };

  const handleSendEmail = (quote: Quote) => {
    const to = quote.client_email || (quote as { shipper_email?: string | null }).shipper_email;
    if (!to) {
      toast.error('Sem e-mail cadastrado para envio');
      return;
    }

    const subject = `Proposta - ${quote.client_name}`;
    const body = `Olá ${quote.client_name},\n\nSegue a proposta da cotação.\n\nOrigem: ${quote.origin}\nDestino: ${quote.destination}\nValor: ${Number(quote.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n\nObrigado!`;

    window.location.href =
      `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const confirmDelete = async () => {
    if (!quoteToDelete) return;

    try {
      await deleteQuoteMutation.mutateAsync(quoteToDelete.id);
      toast.success('Cotação excluída');
      setQuoteToDelete(null);
    } catch {
      toast.error('Erro ao excluir cotação');
    }
  };

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
                    onClone={() => handleClone(quote)}
                    onDelete={() => setQuoteToDelete(quote)}
                    onSendEmail={() => handleSendEmail(quote)}
                    onConvert={() => setConvertingQuote(quote)}
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

      <AlertDialog open={!!quoteToDelete} onOpenChange={(open) => !open && setQuoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cotação?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a cotação de <strong>{quoteToDelete?.client_name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setQuoteToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
