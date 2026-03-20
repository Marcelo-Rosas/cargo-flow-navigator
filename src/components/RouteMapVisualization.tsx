/**
 * RouteMapVisualization (v3 - Refactored)
 *
 * Follows TollRoutesSection methodology:
 * - Separates concerns (map, summary, stats)
 * - Uses custom hooks for route logic
 * - Standardizes data handling (centavos format)
 * - Composable sub-components
 *
 * Renders a Leaflet map with the consolidated route:
 * - Polyline from WebRouter coordinates
 * - Markers for origin, waypoints, and destination
 * - Summary: distance, duration, toll, stops
 *
 * Falls back to a text summary if no coordinates are available.
 */

import { useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import {
  useCompositionRouteMetrics,
  type CompositionRouteLeg,
} from '@/hooks/useCompositionRouteMetrics';
import { formatCurrencyFromCents } from '@/lib/formatters';
import { RouteStats } from './RouteStats';

// Fix Leaflet default marker icons (broken with bundlers)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const originIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  className: 'hue-rotate-[120deg]', // green tint
});

const destinationIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  className: 'hue-rotate-[0deg]', // red (default)
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteMapVisualizationProps {
  /** Full route polyline coordinates [lat, lng][] from WebRouter */
  polylineCoords?: [number, number][];
  /** Route legs from generate-optimal-route (standardized with toll_centavos) */
  legs?: CompositionRouteLeg[];
  /** Total distance in km */
  totalDistanceKm?: number;
  /** Total duration in minutes */
  totalDurationMin?: number;
  /** Total toll in centavos (integer) */
  totalTollCentavos?: number;
  /** Route source (for diagnostics) */
  routeSource?: 'webrouter' | 'fallback_km' | string;
  /** Legacy routings from DB (backwards compat with LoadCompositionModal) */
  routings?: {
    id: string;
    composition_id: string;
    route_sequence: number;
    quote_id?: string;
    leg_distance_km: number;
    leg_duration_min: number;
    leg_polyline: string;
    is_feasible: boolean;
    created_at: string;
  }[];
}

export function RouteMapVisualization({
  polylineCoords,
  legs,
  totalDistanceKm,
  totalDurationMin,
  totalTollCentavos,
  routeSource,
  routings,
}: RouteMapVisualizationProps) {
  const metrics = useCompositionRouteMetrics({
    legs,
    totalDistanceKm,
    totalDurationMin,
    totalTollCentavos,
    polylineCoords,
    routings,
  });

  const hasMap = metrics.hasValidCoordinates && polylineCoords && polylineCoords.length >= 2;

  // Center map on polyline bounds (using memoized metrics to avoid recalculation)
  const bounds = useMemo(() => {
    if (!hasMap || !polylineCoords || polylineCoords.length < 2) return undefined;
    return L.latLngBounds(polylineCoords.map(([lat, lng]) => [lat, lng]));
  }, [polylineCoords, hasMap]);

  return (
    <div className="space-y-4">
      {/* Map */}
      {hasMap && bounds ? (
        <div className="rounded-lg overflow-hidden border" style={{ height: 350 }}>
          <MapContainer
            bounds={bounds}
            boundsOptions={{ padding: [30, 30] }}
            scrollWheelZoom={false}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Polyline
              positions={polylineCoords!}
              pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.8 }}
            />
            {/* Origin marker */}
            <Marker position={polylineCoords![0]} icon={originIcon}>
              <Popup>
                <strong>Origem</strong>
                {legs?.[0]?.from_label && <br />}
                {legs?.[0]?.from_label}
              </Popup>
            </Marker>
            {/* Destination marker */}
            <Marker position={polylineCoords![polylineCoords!.length - 1]} icon={destinationIcon}>
              <Popup>
                <strong>Destino</strong>
                {legs && legs.length > 0 && <br />}
                {legs?.[legs.length - 1]?.to_label}
              </Popup>
            </Marker>
            {/* Waypoint markers (intermediate) */}
            {legs &&
              legs.length > 1 &&
              legs.slice(0, -1).map((leg, i) => {
                // Estimate waypoint position proportionally along polyline
                const fraction = (i + 1) / legs.length;
                const idx = Math.min(
                  Math.floor(fraction * (polylineCoords!.length - 1)),
                  polylineCoords!.length - 1
                );
                return (
                  <Marker key={i} position={polylineCoords![idx]}>
                    <Popup>
                      <strong>Parada {i + 1}</strong>
                      <br />
                      {leg.to_label}
                      <br />
                      {leg.distance_km.toFixed(1)}km
                    </Popup>
                  </Marker>
                );
              })}
          </MapContainer>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">
            {routeSource === 'fallback_km'
              ? 'Mapa não disponível — rota calculada com km armazenado (sem WebRouter).'
              : 'Coordenadas de rota não disponíveis. Gere a rota para visualizar o mapa.'}
          </p>
        </div>
      )}

      {/* ✅ Use RouteStats component (standardized format) */}
      <RouteStats metrics={metrics} />

      {/* Leg details */}
      {legs && legs.length > 0 && (
        <div className="border rounded-lg divide-y">
          {legs.map((leg, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2 text-sm">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs shrink-0">
                {leg.sequence_number}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium">{leg.from_label}</span>
                <span className="text-muted-foreground"> → </span>
                <span className="font-medium">{leg.to_label}</span>
              </div>
              <div className="text-right shrink-0 text-xs text-muted-foreground">
                {leg.distance_km.toFixed(1)}km • {leg.duration_min}min
                {leg.toll_centavos > 0 && <> • {formatCurrencyFromCents(leg.toll_centavos)}</>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Route source badge */}
      {routeSource && (
        <div className="text-[10px] text-muted-foreground text-right">
          Rota via {routeSource === 'webrouter' ? 'WebRouter' : 'km armazenado (estimativa)'}
        </div>
      )}
    </div>
  );
}
