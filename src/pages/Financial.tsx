import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FileText, Truck } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { FinancialKanbanBoard } from '@/components/financial/kanban/FinancialKanbanBoard';
import { CashFlowReport } from '@/components/financial/CashFlowReport';
import { TripReconciliationCard } from '@/components/financial/TripReconciliationCard';
import { TripDetailModal } from '@/components/modals/TripDetailModal';
import { FinancialDetailModal } from '@/components/modals/FinancialDetailModal';
import { TabButton } from '@/components/financial/TabButton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useFinancialBoardData } from '@/hooks/useFinancialBoardData';
import { useTripsReconciliation } from '@/hooks/useReconciliation';
import { useUpdateFinancialDocumentStatus } from '@/hooks/useUpdateFinancialDocumentStatus';
import { KanbanSkeleton } from '@/components/skeletons/KanbanSkeleton';
import { TripsGridSkeleton } from '@/components/skeletons/TripsGridSkeleton';
import { FAT_COLUMNS, PAG_COLUMNS } from '@/lib/financial-kanban';
import type { FinancialDocType } from '@/types/financial';
import type { FinancialKanbanRow } from '@/types/financial';

type TabKey = 'receber' | 'pagar' | 'fluxo';
type PagViewMode = 'os' | 'trip';

export default function Financial() {
  const [tab, setTab] = useState<TabKey>('receber');
  const [pagViewMode, setPagViewMode] = useState<PagViewMode>('os');
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
            <TripsGridSkeleton />
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
          <KanbanSkeleton columnLabels={columnsConfig} />
        ) : boardData.isError ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-destructive">
            Erro ao carregar:{' '}
            {boardData.error instanceof Error ? boardData.error.message : 'Erro desconhecido'}
          </div>
        ) : (
          <FinancialKanbanBoard
            initialRows={boardData.rows}
            type={activeType!}
            columnsConfig={columnsConfig}
            updateStatusMutation={updateStatusMutation}
            onCardClick={setSelectedDoc}
          />
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
