/**
 * LoadCompositionOverlay (v3)
 * Thin wrapper: uses shared controller + shared components.
 * Floating overlay (Dialog on desktop, Drawer on mobile).
 */

import React, { useState } from 'react';
import { useLoadCompositionController } from '@/hooks/useLoadCompositionController';
import { LoadCompositionSummary } from './load-composition/LoadCompositionSummary';
import { LoadCompositionSuggestionList } from './load-composition/LoadCompositionSuggestionList';
import { LoadCompositionFooter } from './load-composition/LoadCompositionFooter';
import { ManualQuoteSelector } from './load-composition/ManualQuoteSelector';
import { LoadCompositionModal } from './LoadCompositionModal';
import { useIsDesktop } from '@/hooks/useIsDesktop';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import type { CompositionFilterStatus } from '@/hooks/useLoadCompositionController';

export interface LoadCompositionOverlayProps {
  shipperId: string;
  dateRange?: { from: Date; to: Date };
  trigger?: React.ReactNode;
}

export function LoadCompositionOverlay({
  shipperId,
  dateRange,
  trigger,
}: LoadCompositionOverlayProps) {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [showManualSelector, setShowManualSelector] = useState(false);
  const ctrl = useLoadCompositionController({ shipperId, dateRange });

  const content = (
    <>
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Oportunidades de Consolidação</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Análise por embarcador — janela operacional e aderência ao trajeto
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={ctrl.handleAnalyze}
              disabled={ctrl.isAnalyzing}
              className="gap-2"
            >
              {ctrl.isAnalyzing ? (
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
              onClick={() => ctrl.refetch()}
              disabled={ctrl.isLoading}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
            <Button
              variant={showManualSelector ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowManualSelector((v) => !v)}
              className="gap-2"
            >
              Manual
            </Button>
          </div>
        </div>

        <LoadCompositionSummary
          totalSuggestions={ctrl.totalSuggestions}
          totalSavingsCents={ctrl.totalSavingsCents}
          feasibleCount={ctrl.feasibleCount}
          realizableCount={ctrl.realizableCount}
          layout="inline"
        />

        <ToggleGroup
          type="single"
          value={ctrl.filterStatus}
          onValueChange={(v) => v && ctrl.setFilterStatus(v as CompositionFilterStatus)}
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

      {/* Manual selector */}
      {showManualSelector && (
        <div className="border rounded-lg p-3 bg-muted/30">
          <ManualQuoteSelector
            shipperId={shipperId}
            onAnalysisComplete={() => {
              setShowManualSelector(false);
              ctrl.refetch();
            }}
          />
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full pr-3">
          <div className="pb-4">
            <LoadCompositionSuggestionList
              suggestions={ctrl.suggestions}
              quoteInfoMap={ctrl.quoteInfoMap}
              isLoading={ctrl.isLoading}
              error={ctrl.error}
              filterStatus={ctrl.filterStatus}
              expandedIds={ctrl.expandedIds}
              onToggleExpand={ctrl.toggleExpand}
              onApprove={ctrl.handleApprove}
              onView={ctrl.handleViewDetails}
              onCalculateDiscounts={ctrl.handleCalculateDiscounts}
              isApproving={ctrl.isApproving}
              isCalculatingDiscounts={ctrl.isCalculatingDiscounts}
              onRetry={() => ctrl.refetch()}
              layout="compact"
            />
          </div>
        </ScrollArea>
      </div>

      <LoadCompositionFooter layout="overlay" />
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
            if (!o) ctrl.handleCloseModal();
          }}
        >
          <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-4 sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="sr-only">Oportunidades de Consolidação</DialogTitle>
              <DialogDescription className="sr-only">Análise por embarcador</DialogDescription>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>

        {ctrl.showModal && ctrl.selectedCompositionId && (
          <LoadCompositionModal
            compositionId={ctrl.selectedCompositionId}
            onClose={ctrl.handleCloseModal}
            onApprove={ctrl.handleApproveFromModal}
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
            <DrawerDescription>Análise por embarcador</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col flex-1 min-h-0 px-4 pb-6 overflow-hidden">{content}</div>
        </DrawerContent>
      </Drawer>

      {ctrl.showModal && ctrl.selectedCompositionId && (
        <LoadCompositionModal
          compositionId={ctrl.selectedCompositionId}
          onClose={ctrl.handleCloseModal}
          onApprove={ctrl.handleApproveFromModal}
        />
      )}
    </>
  );
}
