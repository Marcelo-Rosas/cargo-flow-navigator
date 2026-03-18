/**
 * Component: RouteMapVisualization
 * Map visualization of composition route with:
 * - Polylines connecting pickup/delivery points
 * - Markers for each stop
 * - Route statistics (distance, duration)
 *
 * Uses Leaflet for map rendering
 */

import React, { useMemo } from 'react';
import { RoutingLeg } from '@/hooks/useLoadCompositionSuggestions';
import { AlertCircle } from 'lucide-react';

export interface RouteMapVisualizationProps {
  routings: RoutingLeg[];
}

/**
 * Simplified route visualization
 * Shows route summary and leg details
 * In production, integrate with Leaflet/Mapbox for interactive map
 */
export function RouteMapVisualization({ routings }: RouteMapVisualizationProps) {
  const sortedRoutings = useMemo(() => {
    return [...routings].sort((a, b) => a.route_sequence - b.route_sequence);
  }, [routings]);

  const totalDistance = useMemo(() => {
    return sortedRoutings.reduce((sum, leg) => sum + (leg.leg_distance_km || 0), 0);
  }, [sortedRoutings]);

  const totalDuration = useMemo(() => {
    return sortedRoutings.reduce((sum, leg) => sum + (leg.leg_duration_min || 0), 0);
  }, [sortedRoutings]);

  return (
    <div className="space-y-4">
      {/* Map Placeholder */}
      <div className="bg-gradient-to-b from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-8 text-center">
        <div className="text-sm text-blue-700 space-y-2">
          <p>📍 Mapa de Rota</p>
          <p className="text-xs text-blue-600">
            Integração com Leaflet/Mapbox disponível em produção
          </p>
        </div>
      </div>

      {/* Route Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
          <div className="text-xs font-medium text-blue-600 mb-1">Distância Total</div>
          <div className="text-xl font-bold text-blue-700">{totalDistance.toFixed(1)}km</div>
        </div>

        <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
          <div className="text-xs font-medium text-purple-600 mb-1">Duração Estimada</div>
          <div className="text-xl font-bold text-purple-700">{totalDuration}min</div>
        </div>

        <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
          <div className="text-xs font-medium text-orange-600 mb-1">Número de Paradas</div>
          <div className="text-xl font-bold text-orange-700">{sortedRoutings.length}</div>
        </div>
      </div>

      {/* Detailed Leg Breakdown */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-gray-700">Detalhes da Rota</h4>
        <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y">
          {sortedRoutings.map((leg, idx) => (
            <div key={leg.id} className="p-3">
              <div className="flex items-start gap-3">
                {/* Sequence Badge */}
                <div className="flex-shrink-0 mt-0.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                    {leg.route_sequence}
                  </div>
                </div>

                {/* Leg Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Parada {idx + 1}
                        {leg.quote_id && ` • Cota: ${leg.quote_id.slice(0, 8)}...`}
                      </p>
                    </div>
                    <div className="text-right text-xs font-medium">
                      <div className="text-blue-700">{leg.leg_distance_km?.toFixed(1)}km</div>
                      <div className="text-gray-600">{leg.leg_duration_min}min</div>
                    </div>
                  </div>

                  {/* Time Windows */}
                  {leg.pickup_window_start && (
                    <div className="mt-2 text-xs text-gray-600 space-y-1">
                      <div>
                        <span className="font-medium">Janela de Pickup:</span>{' '}
                        {leg.pickup_window_start} - {leg.pickup_window_end}
                      </div>
                      {leg.estimated_arrival && (
                        <div>
                          <span className="font-medium">Chegada Estimada:</span>{' '}
                          {leg.estimated_arrival}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Feasibility */}
                  {!leg.is_feasible && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-red-700 bg-red-50 w-fit px-2 py-1 rounded">
                      <AlertCircle className="w-3 h-3" />
                      Parada não viável
                    </div>
                  )}
                </div>
              </div>

              {/* Polyline Preview */}
              {leg.leg_polyline && (
                <div className="mt-2 ml-11 text-xs text-gray-500 font-mono bg-white px-2 py-1 rounded border border-gray-200 truncate">
                  Polyline: {leg.leg_polyline.slice(0, 40)}...
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
        <p>
          💡 Polylines são codificadas no formato Google e podem ser decodificadas para renderizar
          rotas exatas no mapa. Integração com Leaflet/Mapbox recomendada para produção.
        </p>
      </div>
    </div>
  );
}
