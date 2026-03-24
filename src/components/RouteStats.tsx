/**
 * RouteStats Component
 *
 * Displays route summary metrics in a clean card layout.
 * Follows the same pattern as TollRouteForm (sub-component pattern).
 *
 * Shows:
 * - Distance
 * - Duration
 * - Toll (in R$, formatted from centavos)
 * - Number of stops
 * - Warnings if any
 */

import { AlertCircle, Route, Clock, Banknote, MapPin } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrencyFromCents } from '@/lib/formatters';
import type { CompositionRouteMetrics } from '@/hooks/useCompositionRouteMetrics';

export interface RouteStatsProps {
  metrics: CompositionRouteMetrics;
  className?: string;
}

export function RouteStats({ metrics, className = '' }: RouteStatsProps) {
  const { totalDistanceKm, totalDurationMin, totalTollCentavos, stopCount, warnings } = metrics;

  // Format toll: centavos to R$ with 2 decimal places
  const tollFormatted = formatCurrencyFromCents(totalTollCentavos);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {/* Distance */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium text-muted-foreground">Distância</span>
          </div>
          <div className="mt-2 text-lg font-semibold">
            {totalDistanceKm.toLocaleString('pt-BR', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{' '}
            km
          </div>
        </div>

        {/* Duration */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-medium text-muted-foreground">Duração est.</span>
          </div>
          <div className="mt-2 text-lg font-semibold">
            {Math.floor(totalDurationMin / 60)}
            <span className="text-sm font-normal">h </span>
            {totalDurationMin % 60}
            <span className="text-sm font-normal">m</span>
          </div>
        </div>

        {/* Toll */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium text-muted-foreground">Pedágio</span>
          </div>
          <div className="mt-2 text-lg font-semibold">
            {tollFormatted}
            {totalTollCentavos === 0 && (
              <span className="ml-2 text-xs font-normal text-gray-500">(sem pedagio)</span>
            )}
          </div>
        </div>

        {/* Stops */}
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-red-500" />
            <span className="text-sm font-medium text-muted-foreground">Paradas</span>
          </div>
          <div className="mt-2 text-lg font-semibold">{stopCount}</div>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning, idx) => (
            <Alert key={idx} variant="default" className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">{warning}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}
    </div>
  );
}
