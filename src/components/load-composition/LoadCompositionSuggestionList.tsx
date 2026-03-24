/**
 * Shared suggestion list for load composition.
 * Renders expandable rows (Panel) or compact cards (Overlay).
 */

import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ChevronDown, ChevronRight, Truck } from 'lucide-react';
import { LoadCompositionCard } from '@/components/LoadCompositionCard';
import type { QuoteInfo, CompositionFilterStatus } from '@/hooks/useLoadCompositionController';
import { formatCurrencyFromCents, formatQuoteValue, formatDate } from '@/lib/formatters';
import type { LoadCompositionSuggestionWithDetails } from '@/types/load-composition';

export interface LoadCompositionSuggestionListProps {
  suggestions: LoadCompositionSuggestionWithDetails[];
  quoteInfoMap: Record<string, QuoteInfo>;
  isLoading: boolean;
  error: Error | null;
  filterStatus: CompositionFilterStatus;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onApprove: (id: string) => void;
  onView: (id: string) => void;
  onCalculateDiscounts: (id: string) => void;
  isApproving: boolean;
  isCalculatingDiscounts: boolean;
  onRetry?: () => void;
  /** 'expandable' for Panel, 'compact' for Overlay */
  layout?: 'expandable' | 'compact';
}

export function LoadCompositionSuggestionList({
  suggestions,
  quoteInfoMap,
  isLoading,
  error,
  filterStatus,
  expandedIds,
  onToggleExpand,
  onApprove,
  onView,
  onCalculateDiscounts,
  isApproving,
  isCalculatingDiscounts,
  onRetry,
  layout = 'expandable',
}: LoadCompositionSuggestionListProps) {
  // Loading
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800">Erro ao carregar sugestões</p>
          <p className="text-xs text-red-700 mt-1">
            {error instanceof Error ? error.message : 'Tente novamente'}
          </p>
          {onRetry && (
            <button className="text-xs text-red-700 underline mt-2" onClick={onRetry}>
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    );
  }

  // Empty
  if (suggestions.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-sm text-gray-600 mb-3">
          {filterStatus === 'all'
            ? 'Nenhuma sugestão de consolidação encontrada'
            : `Nenhuma sugestão ${filterStatus === 'pending' ? 'pendente' : filterStatus} encontrada`}
        </p>
        {filterStatus === 'pending' && (
          <p className="text-xs text-gray-500">
            Clique em "Gerar sugestões" ou adicione mais cotações para o embarcador
          </p>
        )}
      </div>
    );
  }

  // Compact layout (Overlay)
  if (layout === 'compact') {
    return (
      <div className="space-y-3">
        {suggestions.map((s) => (
          <LoadCompositionCard
            key={s.id}
            suggestion={s}
            onApprove={onApprove}
            onView={onView}
            onCalculateDiscounts={onCalculateDiscounts}
            isApproving={isApproving}
            isCalculatingDiscounts={isCalculatingDiscounts}
            compact
          />
        ))}
      </div>
    );
  }

  // Expandable layout (Panel)
  return (
    <div className="space-y-3">
      {suggestions.map((suggestion) => (
        <ExpandableSuggestionRow
          key={suggestion.id}
          suggestion={suggestion}
          quoteInfoMap={quoteInfoMap}
          isExpanded={expandedIds.has(suggestion.id)}
          onToggleExpand={() => onToggleExpand(suggestion.id)}
          onApprove={onApprove}
          onView={onView}
          onCalculateDiscounts={onCalculateDiscounts}
          isApproving={isApproving}
          isCalculatingDiscounts={isCalculatingDiscounts}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expandable row
// ---------------------------------------------------------------------------

interface ExpandableSuggestionRowProps {
  suggestion: LoadCompositionSuggestionWithDetails;
  quoteInfoMap: Record<string, QuoteInfo>;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onApprove: (id: string) => void;
  onView: (id: string) => void;
  onCalculateDiscounts: (id: string) => void;
  isApproving: boolean;
  isCalculatingDiscounts: boolean;
}

function ExpandableSuggestionRow({
  suggestion,
  quoteInfoMap,
  isExpanded,
  onToggleExpand,
  onApprove,
  onView,
  onCalculateDiscounts,
  isApproving,
  isCalculatingDiscounts,
}: ExpandableSuggestionRowProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/50 transition-colors text-left"
        onClick={onToggleExpand}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <span className="text-sm font-medium flex-1 min-w-0 truncate">
          {suggestion.quote_ids.length} cotações •{' '}
          {suggestion.is_feasible ? 'Viável' : 'Não viável'} • Score{' '}
          {suggestion.consolidation_score.toFixed(0)}%
        </span>
        <span className="text-sm font-semibold text-green-600 shrink-0">
          {formatCurrencyFromCents(suggestion.estimated_savings_brl)}
        </span>
      </button>

      {isExpanded && (
        <div className="border-t">
          {/* Quote details */}
          <div className="divide-y">
            {suggestion.quote_ids.map((qid) => {
              const q = quoteInfoMap[qid];
              if (!q) {
                return (
                  <div key={qid} className="px-4 py-2 text-xs text-muted-foreground">
                    {qid.slice(0, 8)}... (carregando)
                  </div>
                );
              }
              return (
                <div key={qid} className="px-4 py-2 flex items-center gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">
                        {q.quote_code || q.id.slice(0, 8)}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {q.client_name}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {q.destination}
                      {q.weight ? ` • ${q.weight.toLocaleString('pt-BR')}kg` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold">{formatQuoteValue(q.value)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatDate(q.estimated_loading_date)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Veículo sugerido */}
          {suggestion.suggested_vehicle_type_name && (
            <div className="mx-4 my-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-800">
                  Veículo Sugerido: {suggestion.suggested_vehicle_type_name}
                  {suggestion.suggested_axes_count
                    ? ` (${suggestion.suggested_axes_count} eixos)`
                    : ''}
                </span>
              </div>
              <div className="text-xs text-blue-700 mb-2">
                Peso total: {(suggestion.total_combined_weight_kg ?? 0).toLocaleString('pt-BR')} kg
                {suggestion.total_combined_volume_m3
                  ? ` • Volume total: ${suggestion.total_combined_volume_m3.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m³`
                  : ''}
              </div>
              <div className="space-y-1">
                {suggestion.quote_ids.map((qid) => {
                  const q = quoteInfoMap[qid];
                  if (!q) return null;
                  const isCompatible = q.vehicle_type_id === suggestion.suggested_vehicle_type_id;
                  return (
                    <div key={qid} className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{q.quote_code || qid.slice(0, 8)}</span>
                      <span className="text-muted-foreground">
                        {q.vehicle_type_name || 'Sem veículo'}
                      </span>
                      <span className="text-muted-foreground">
                        {q.weight ? `${q.weight.toLocaleString('pt-BR')} kg` : ''}
                      </span>
                      <span className="ml-auto">
                        {isCompatible ? (
                          <span className="text-green-700 font-medium">Compatível</span>
                        ) : (
                          <span className="text-amber-700 font-medium">Troca necessária</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full card */}
          <div className="p-3 bg-muted/30">
            <LoadCompositionCard
              suggestion={suggestion}
              onApprove={onApprove}
              onView={onView}
              onCalculateDiscounts={onCalculateDiscounts}
              isApproving={isApproving}
              isCalculatingDiscounts={isCalculatingDiscounts}
            />
          </div>
        </div>
      )}
    </div>
  );
}
