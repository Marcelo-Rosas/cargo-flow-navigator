/**
 * LoadCompositionOverlay
 *
 * Floating overlay (Dialog on desktop, Drawer on mobile) for load composition opportunities.
 * Triggered by button — no sidebar. Modern operational modal UX.
 */

import React, { useState } from 'react';
import { useLoadCompositionSuggestions } from '@/hooks/useLoadCompositionSuggestions';
import { useApproveComposition } from '@/hooks/useApproveComposition';
import { useAnalyzeLoadComposition } from '@/hooks/useAnalyzeLoadComposition';
import { useCalculateDiscounts } from '@/hooks/useCalculateDiscounts';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { LoadCompositionCard } from './LoadCompositionCard';
import { LoadCompositionModal } from './LoadCompositionModal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AlertCircle, RefreshCw, Sparkles, Loader2 } from 'lucide-react';

export interface LoadCompositionOverlayProps {
  shipperId: string;
  dateRange?: { from: Date; to: Date };
  /** Custom trigger. Default: outline button "Ver oportunidades" */
  trigger?: React.ReactNode;
}

export function LoadCompositionOverlay({
  shipperId,
  dateRange,
  trigger,
}: LoadCompositionOverlayProps) {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [selectedCompositionId, setSelectedCompositionId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'executed'>(
    'pending'
  );

  const {
    data: suggestions,
    isLoading,
    error,
    refetch,
  } = useLoadCompositionSuggestions({
    shipper_id: shipperId,
    status: filterStatus === 'all' ? undefined : filterStatus,
    date_from: dateRange?.from,
    date_to: dateRange?.to,
    include_details: true,
  });

  const { mutate: approve, isPending: isApproving } = useApproveComposition();
  const { mutate: analyzeComposition, isPending: isAnalyzing } = useAnalyzeLoadComposition();
  const { mutate: calculateDiscounts, isPending: isCalculatingDiscounts } = useCalculateDiscounts();

  const handleApprove = (compositionId: string) => {
    approve({ composition_id: compositionId });
  };

  const handleCalculateDiscounts = (compositionId: string) => {
    calculateDiscounts({
      composition_id: compositionId,
      discount_strategy: 'proportional_to_original',
      minimum_margin_percent: 30,
      simulate_only: false,
    });
  };

  const handleViewDetails = (compositionId: string) => {
    setSelectedCompositionId(compositionId);
    setShowDetailModal(true);
  };

  const filteredSuggestions =
    suggestions?.filter((s) => (filterStatus === 'all' ? true : s.status === filterStatus)) || [];

  const totalSavings = filteredSuggestions.reduce(
    (sum, s) => sum + s.estimated_savings_brl / 100,
    0
  );
  const totalSuggestions = filteredSuggestions.length;
  const feasibleCount = filteredSuggestions.filter((s) => s.is_feasible).length;

  const content = (
    <>
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Oportunidades de Consolidação</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Análise automática de cargas para otimização de rotas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => analyzeComposition({ shipper_id: shipperId })}
              disabled={isAnalyzing}
              className="gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Gerar sugestões
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Mini stats */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Sugestões:</span>
            <span className="font-semibold">{totalSuggestions}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Economia:</span>
            <span className="font-semibold text-green-600">
              R$ {totalSavings.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Viáveis:</span>
            <span className="font-semibold text-purple-600">
              {feasibleCount}/{totalSuggestions}
            </span>
          </div>
        </div>

        {/* Filter */}
        <ToggleGroup
          type="single"
          value={filterStatus}
          onValueChange={(v) => v && setFilterStatus(v as typeof filterStatus)}
          variant="outline"
          size="sm"
          className="justify-start"
        >
          <ToggleGroupItem value="all">Todas</ToggleGroupItem>
          <ToggleGroupItem value="pending">Pendentes</ToggleGroupItem>
          <ToggleGroupItem value="approved">Aprovadas</ToggleGroupItem>
          <ToggleGroupItem value="executed">Executadas</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoading && (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Erro ao carregar sugestões</p>
              <p className="text-xs text-muted-foreground mt-1">
                {error instanceof Error ? error.message : 'Tente novamente'}
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !error && filteredSuggestions.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {filterStatus === 'all'
                ? 'Nenhuma sugestão encontrada'
                : `Nenhuma sugestão ${filterStatus === 'pending' ? 'pendente' : filterStatus}`}
            </p>
            {filterStatus === 'pending' && (
              <p className="text-xs text-muted-foreground mt-1">
                Use &quot;Gerar sugestões&quot; para analisar cargas pendentes
              </p>
            )}
          </div>
        )}

        {!isLoading && !error && filteredSuggestions.length > 0 && (
          <ScrollArea className="h-full pr-3">
            <div className="space-y-3 pb-4">
              {filteredSuggestions.map((suggestion) => (
                <LoadCompositionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onApprove={handleApprove}
                  onView={handleViewDetails}
                  onCalculateDiscounts={handleCalculateDiscounts}
                  isApproving={isApproving}
                  isCalculatingDiscounts={isCalculatingDiscounts}
                  compact
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Footer hint */}
      <p className="text-xs text-muted-foreground pt-3 border-t">
        💡 Sugestões analisam cargas dos últimos 14 dias. Viabilidade considera peso, datas e desvio
        de rota.
      </p>
    </>
  );

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-2">
      <Sparkles className="w-4 h-4" />
      Ver oportunidades
    </Button>
  );

  if (isDesktop) {
    return (
      <>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setShowDetailModal(false);
          }}
        >
          <DialogTrigger asChild>
            {trigger ?? (
              <Button variant="outline" size="sm" className="gap-2">
                <Sparkles className="w-4 h-4" />
                Ver oportunidades
              </Button>
            )}
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-4 sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="sr-only">Oportunidades de Consolidação</DialogTitle>
              <DialogDescription className="sr-only">
                Análise automática de cargas para otimização
              </DialogDescription>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>

        {showDetailModal && selectedCompositionId && (
          <LoadCompositionModal
            compositionId={selectedCompositionId}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedCompositionId(null);
            }}
            onApprove={() => {
              handleApprove(selectedCompositionId);
              setShowDetailModal(false);
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger ?? defaultTrigger}</DrawerTrigger>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Oportunidades de Consolidação</DrawerTitle>
            <DrawerDescription>Análise automática de cargas</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col flex-1 min-h-0 px-4 pb-6 overflow-hidden">{content}</div>
        </DrawerContent>
      </Drawer>

      {showDetailModal && selectedCompositionId && (
        <LoadCompositionModal
          compositionId={selectedCompositionId}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedCompositionId(null);
          }}
          onApprove={() => {
            handleApprove(selectedCompositionId);
            setShowDetailModal(false);
          }}
        />
      )}
    </>
  );
}
