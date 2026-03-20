/**
 * Shared summary stats for load composition.
 * Used by both Panel and Overlay.
 */

import { formatCurrencyFromCents } from '@/lib/formatters';

export interface LoadCompositionSummaryProps {
  totalSuggestions: number;
  totalSavingsCents: number;
  feasibleCount: number;
  /** 'grid' for Panel, 'inline' for Overlay */
  layout?: 'grid' | 'inline';
}

export function LoadCompositionSummary({
  totalSuggestions,
  totalSavingsCents,
  feasibleCount,
  layout = 'grid',
}: LoadCompositionSummaryProps) {
  if (layout === 'inline') {
    return (
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Sugestões:</span>
          <span className="font-semibold">{totalSuggestions}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Economia:</span>
          <span className="font-semibold text-green-600">
            {formatCurrencyFromCents(totalSavingsCents)}
          </span>
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
        <div className="text-xs font-medium text-green-600 mb-1">Economia Total</div>
        <div className="text-2xl font-bold text-green-700">
          {formatCurrencyFromCents(totalSavingsCents)}
        </div>
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
