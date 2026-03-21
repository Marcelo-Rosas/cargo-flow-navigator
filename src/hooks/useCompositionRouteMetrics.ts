/**
 * Hook: useCompositionRouteMetrics
 *
 * Métricas agregadas para rota de composição de carga (mapa + cards).
 * Não confundir com useRouteMetrics (relatórios / RPC get_route_metrics).
 */

import { useMemo } from 'react';

export interface CompositionRouteLeg {
  from_label: string;
  to_label: string;
  distance_km: number;
  duration_min: number;
  quote_id: string | null;
  sequence_number: number;
  toll_centavos: number;
}

export interface CompositionRouteMetrics {
  totalDistanceKm: number;
  totalDurationMin: number;
  totalTollCentavos: number;
  stopCount: number;
  hasValidCoordinates: boolean;
  warnings: string[];
}

export interface CompositionRoutingRow {
  leg_distance_km: number;
  leg_duration_min: number;
}

export interface UseCompositionRouteMetricsProps {
  legs?: CompositionRouteLeg[];
  totalDistanceKm?: number;
  totalDurationMin?: number;
  totalTollCentavos?: number;
  polylineCoords?: [number, number][];
  /** Quando não há `legs` (ex.: só registros em load_composition_routings) */
  routings?: CompositionRoutingRow[];
}

export function useCompositionRouteMetrics({
  legs,
  totalDistanceKm,
  totalDurationMin,
  totalTollCentavos,
  polylineCoords,
  routings,
}: UseCompositionRouteMetricsProps): CompositionRouteMetrics {
  return useMemo(() => {
    const warnings: string[] = [];

    let distance = totalDistanceKm ?? 0;
    let duration = totalDurationMin ?? 0;
    let toll = totalTollCentavos ?? 0;
    let stops = 0;

    if (legs && legs.length > 0) {
      if (totalDistanceKm == null || totalDistanceKm === 0) {
        distance = legs.reduce((sum, leg) => sum + leg.distance_km, 0);
      }
      if (totalDurationMin == null || totalDurationMin === 0) {
        duration = legs.reduce((sum, leg) => sum + leg.duration_min, 0);
      }
      if (totalTollCentavos == null || totalTollCentavos === 0) {
        toll = legs.reduce((sum, leg) => sum + leg.toll_centavos, 0);
      }

      stops = Math.max(0, legs.length - 1);

      const legsWithoutToll = legs.filter((leg) => leg.toll_centavos === 0).length;
      if (legsWithoutToll > 0) {
        warnings.push(`${legsWithoutToll} trecho(s) sem pedágio calculado`);
      }
    } else if (routings && routings.length > 0) {
      if (totalDistanceKm == null || totalDistanceKm === 0) {
        distance = routings.reduce((s, r) => s + (r.leg_distance_km || 0), 0);
      }
      if (totalDurationMin == null || totalDurationMin === 0) {
        duration = routings.reduce((s, r) => s + (r.leg_duration_min || 0), 0);
      }
      toll = totalTollCentavos ?? 0;
      stops = routings.length;
    } else {
      warnings.push('Dados de rota incompletos');
    }

    if (!Number.isInteger(toll)) {
      warnings.push('Pedágio em formato inválido (não é inteiro)');
      toll = Math.round(toll);
    }

    const hasValidCoordinates = !!polylineCoords && polylineCoords.length > 0;
    if (!hasValidCoordinates && (distance > 0 || toll > 0)) {
      warnings.push('Coordenadas de rota não disponíveis para visualizar mapa');
    }

    return {
      totalDistanceKm: Math.round(distance * 10) / 10,
      totalDurationMin: Math.round(duration),
      totalTollCentavos: toll,
      stopCount: stops,
      hasValidCoordinates,
      warnings,
    };
  }, [legs, totalDistanceKm, totalDurationMin, totalTollCentavos, polylineCoords, routings]);
}
