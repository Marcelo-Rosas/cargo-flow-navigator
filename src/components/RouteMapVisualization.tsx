/**
 * RouteMapVisualization (v2)
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
import { MapPin, Route, Clock, DollarSign } from 'lucide-react';
import { formatCurrencyFromCents } from '@/lib/formatters';

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
  /** Route legs from generate-optimal-route */
  legs?: {
    from_label: string;
    to_label: string;
    distance_km: number;
    duration_min: number;
    quote_id: string | null;
    sequence_number: number;
    toll_centavos: number;
  }[];
  totalDistanceKm?: number;
  totalDurationMin?: number;
  totalTollCentavos?: number;
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
  // Compute summary from legs or routings
  const summary = useMemo(() => {
    if (totalDistanceKm != null) {
      return {
        distance: totalDistanceKm,
        duration: totalDurationMin ?? Math.round((totalDistanceKm / 60) * 60),
        toll: totalTollCentavos ?? 0,
        stops: (legs?.length ?? routings?.length ?? 0),
      };
    }
    // Fallback: compute from routings
    if (routings && routings.length > 0) {
      const dist = routings.reduce((s, r) => s + (r.leg_distance_km || 0), 0);
      const dur = routings.reduce((s, r) => s + (r.leg_duration_min || 0), 0);
      return { distance: dist, duration: dur, toll: 0, stops: routings.length };
    }
    return { distance: 0, duration: 0, toll: 0, stops: 0 };
  }, [totalDistanceKm, totalDurationMin, totalTollCentavos, legs, routings]);

  const hasMap = polylineCoords && polylineCoords.length >= 2;

  // Center map on polyline bounds
  const bounds = useMemo(() => {
    if (!hasMap) return undefined;
    return L.latLngBounds(polylineCoords!.map(([lat, lng]) => [lat, lng]));
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
            {legs && legs.length > 1 && legs.slice(0, -1).map((leg, i) => {
              // Estimate waypoint position proportionally along polyline
              const fraction = (i + 1) / legs.length;
              const idx = Math.min(
                Math.floor(fraction * (polylineCoords!.length - 1)),
                polylineCoords!.length - 1
              );
              return (
                <Marker key={i} position={polylineCoords![idx]}>
                  <Popup>
                    <strong>Parada {i + 1}</strong><br />
                    {leg.to_label}<br />
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

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-center">
          <Route className="w-4 h-4 text-blue-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-blue-700">{summary.distance.toFixed(1)}km</div>
          <div className="text-[10px] text-blue-600">Distância</div>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-center">
          <Clock className="w-4 h-4 text-purple-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-purple-700">
            {summary.duration >= 60
              ? `${Math.floor(summary.duration / 60)}h${summary.duration % 60 > 0 ? `${summary.duration % 60}m` : ''}`
              : `${summary.duration}min`}
          </div>
          <div className="text-[10px] text-purple-600">Duração est.</div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg border border-green-100 text-center">
          <DollarSign className="w-4 h-4 text-green-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-green-700">
            {summary.toll > 0 ? formatCurrencyFromCents(summary.toll) : '—'}
          </div>
          <div className="text-[10px] text-green-600">Pedágio</div>
        </div>
        <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 text-center">
          <MapPin className="w-4 h-4 text-orange-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-orange-700">{summary.stops}</div>
          <div className="text-[10px] text-orange-600">Paradas</div>
        </div>
      </div>

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
                {leg.toll_centavos > 0 && (
                  <> • {formatCurrencyFromCents(leg.toll_centavos)}</>
                )}
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
