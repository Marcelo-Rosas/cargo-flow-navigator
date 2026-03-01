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
import { Loader2, FileText, Truck } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { KanbanColumn } from '@/components/boards/KanbanColumn';
import { FinancialCard } from '@/components/financial/FinancialCard';
import { CashFlowReport } from '@/components/financial/CashFlowReport';
import { TripReconciliationCard } from '@/components/financial/TripReconciliationCard';
import { TripDetailModal } from '@/components/modals/TripDetailModal';
import { FinancialDetailModal } from '@/components/modals/FinancialDetailModal';
import { TabButton } from '@/components/financial/TabButton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useFinancialBoardData } from '@/hooks/useFinancialBoardData';
import { useTripsReconciliation } from '@/hooks/useReconciliation';
import { useUpdateFinancialDocumentStatus } from '@/hooks/useUpdateFinancialDocumentStatus';
import { FAT_COLUMNS, PAG_COLUMNS } from '@/lib/financial-kanban';
import type { FinancialDocType } from '@/types/financial';
import type { FinancialKanbanRow } from '@/types/financial';
import { toast } from 'sonner';

type TabKey = 'receber' | 'pagar' | 'fluxo';
type PagViewMode = 'os' | 'trip';

export default function Financial() {
  const [tab, setTab] = useState<TabKey>('receber');
  const [pagViewMode, setPagViewMode] = useState<PagViewMode>('os');
  const [activeDoc, setActiveDoc] = useState<FinancialKanbanRow | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<FinancialKanbanRow | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const activeType = useMemo(
    () => (tab === 'receber' ? 'FAT' : tab === 'pagar' ? 'PAG' : null) as FinancialDocType | null,
    [tab]
  );
  const receber = useFinancialBoardData('FAT', { enabled: tab === 'receber' });
  const pagar = useFinancialBoardData('PAG', { enabled: tab === 'pagar' });
  const showTripsMode = tab === 'pagar' && pagViewMode === 'trip';
  const tripsReconciliation = useTripsReconciliation({ enabled: showTripsMode });

  const boardData = tab === 'receber' ? receber : tab === 'pagar' ? pagar : receber;
  const columnsConfig = activeType === 'FAT' ? FAT_COLUMNS : PAG_COLUMNS;
  const updateStatusMutation = useUpdateFinancialDocumentStatus();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const row = boardData.rows.find((r) => r.id === event.active.id);
    if (row) setActiveDoc(row);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDoc(null);

    if (!over || !boardData.rows) return;

    const doc = boardData.rows.find((r) => r.id === active.id);
    if (!doc) return;

    const targetStatus = columnsConfig.find((c) => c.id === over.id);
    if (targetStatus && targetStatus.id !== doc.status) {
      try {
        await updateStatusMutation.mutateAsync({ id: doc.id, status: targetStatus.id });
        toast.success(`Movido para ${targetStatus.label}`);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'Erro ao mover';
        toast.error(msg);
      }
      return;
    }

    const overDoc = boardData.rows.find((r) => r.id === over.id);
    if (overDoc && overDoc.status !== doc.status) {
      const target = columnsConfig.find((c) => c.id === overDoc.status);
      if (target) {
        try {
          await updateStatusMutation.mutateAsync({ id: doc.id, status: target.id });
          toast.success(`Movido para ${target.label}`);
        } catch (err: unknown) {
          const msg =
            err instanceof Error
              ? err.message
              : typeof err === 'object' && err && 'message' in err
                ? String((err as { message: unknown }).message)
                : 'Erro ao mover';
          toast.error(msg);
        }
      }
    }
  };

  const totalReceber = receber.rows.length;
  const totalPagar = pagar.rows.length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <motion.h1
            className="text-3xl font-bold text-foreground"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Financeiro
          </motion.h1>
          <motion.p
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Contas a receber e a pagar
          </motion.p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-2">
            <TabButton
              active={tab === 'receber'}
              onClick={() => setTab('receber')}
              label="Receber"
              count={totalReceber}
              overdueCount={receber.overdueCount}
            />
            <TabButton
              active={tab === 'pagar'}
              onClick={() => setTab('pagar')}
              label="Pagar"
              count={totalPagar}
              overdueCount={pagar.overdueCount}
            />
            <TabButton
              active={tab === 'fluxo'}
              onClick={() => setTab('fluxo')}
              label="Fluxo de Caixa"
              count={0}
            />
          </div>
          {tab === 'pagar' && (
            <ToggleGroup
              type="single"
              value={pagViewMode}
              onValueChange={(v) => v && setPagViewMode(v as PagViewMode)}
              className="border rounded-md p-0.5 bg-muted/30"
            >
              <ToggleGroupItem value="os" className="gap-1.5 text-xs">
                <FileText className="w-3.5 h-3.5" />
                Por OS
              </ToggleGroupItem>
              <ToggleGroupItem value="trip" className="gap-1.5 text-xs">
                <Truck className="w-3.5 h-3.5" />
                Por Trip
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>

        {tab === 'fluxo' ? (
          <CashFlowReport />
        ) : tab === 'pagar' && pagViewMode === 'trip' ? (
          tripsReconciliation.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : tripsReconciliation.isError ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-destructive">
              Erro ao carregar trips
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {(tripsReconciliation.data ?? []).map((trip) => (
                <TripReconciliationCard
                  key={trip.trip_id}
                  trip={trip}
                  onClick={() => setSelectedTripId(trip.trip_id)}
                />
              ))}
            </div>
          )
        ) : boardData.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : boardData.isError ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-destructive">
            Erro ao carregar:{' '}
            {boardData.error instanceof Error ? boardData.error.message : 'Erro desconhecido'}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6">
              {boardData.columns.map((col) => (
                <KanbanColumn
                  key={col.status}
                  id={col.status}
                  title={col.label}
                  count={col.items.length}
                  color={columnsConfig.find((c) => c.id === col.status)?.color}
                  items={col.items.map((r) => r.id)}
                >
                  {col.items.map((row) => (
                    <FinancialCard
                      key={row.id}
                      row={row}
                      onEdit={() => setSelectedDoc(row)}
                      canManageActions
                    />
                  ))}
                </KanbanColumn>
              ))}
            </div>

            <DragOverlay>
              {activeDoc && <FinancialCard row={activeDoc} canManageActions />}
            </DragOverlay>
          </DndContext>
        )}

        {((showTripsMode && (tripsReconciliation.data ?? []).length === 0) ||
          (!showTripsMode && boardData.rows.length === 0)) &&
          !boardData.isLoading &&
          !tripsReconciliation.isLoading && (
            <div className="w-full py-16 text-center text-muted-foreground">
              Nenhum registro encontrado.
            </div>
          )}
      </div>

      <FinancialDetailModal
        open={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
        doc={selectedDoc}
      />

      <TripDetailModal
        open={!!selectedTripId}
        onClose={() => setSelectedTripId(null)}
        tripId={selectedTripId}
      />
    </MainLayout>
  );
}
