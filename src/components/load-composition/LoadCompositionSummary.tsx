/**
 * Shared summary stats for load composition.
 * Used by both Panel and Overlay.
 *
 * "Economia" shows the max realizable savings (non-overlapping suggestions only),
 * not the raw sum of all suggestions which would double-count shared quotes.
 */

import { formatCurrencyFromCents } from '@/lib/formatters';

export interface LoadCompositionSummaryProps {
  totalSuggestions: number;
  totalSavingsCents: number;
  feasibleCount: number;
  /** How many non-overlapping suggestions make up the savings total */
  realizableCount?: number;
  /** 'grid' for Panel, 'inline' for Overlay */
  layout?: 'grid' | 'inline';
}

export function LoadCompositionSummary({
  totalSuggestions,
  totalSavingsCents,
  feasibleCount,
  realizableCount,
  layout = 'grid',
}: LoadCompositionSummaryProps) {
  if (layout === 'inline') {
    return (
      <div className="flex gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Sugestões:</span>
          <span className="font-semibold">{totalSuggestions}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Economia realizável:</span>
          <span className="font-semibold text-green-600">
            {formatCurrencyFromCents(totalSavingsCents)}
          </span>
          {realizableCount != null && realizableCount < totalSuggestions && (
            <span className="text-xs text-muted-foreground">
              ({realizableCount} de {totalSuggestions})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Viáveis:</span>
          <span className="font-semibold text-purple-600">
            {feasibleCount}/{totalSuggestions}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
        <div className="text-xs font-medium text-blue-600 mb-1">Sugestões</div>
        <div className="text-2xl font-bold text-blue-700">{totalSuggestions}</div>
      </div>
      <div className="bg-green-50 p-3 rounded-lg border border-green-100">
        <div className="text-xs font-medium text-green-600 mb-1">Economia Realizável</div>
        <div className="text-2xl font-bold text-green-700">
          {formatCurrencyFromCents(totalSavingsCents)}
        </div>
        {realizableCount != null && realizableCount < totalSuggestions && (
          <div className="text-[10px] text-green-600 mt-0.5">
            {realizableCount} composições sem sobreposição
          </div>
        )}
      </div>
      <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
        <div className="text-xs font-medium text-purple-600 mb-1">Viáveis</div>
        <div className="text-2xl font-bold text-purple-700">
          {feasibleCount}/{totalSuggestions}
        </div>
      </div>
    </div>
  );
}
