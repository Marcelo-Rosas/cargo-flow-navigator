/**
 * RouteVisualizationMap Component
 * Exibe mapa interativo com rota de consolidação de cargas
 * Mostra marcadores de origem/destino e polyline da rota
 */

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader } from 'lucide-react';
import { loadGoogleMapsScript } from '@/lib/google-maps';
import type { LoadCompositionSuggestionWithDetails } from '@/hooks/useLoadCompositionSuggestions';

export interface RouteVisualizationMapProps {
  suggestion: LoadCompositionSuggestionWithDetails;
  quotes: Array<{
    id: string;
    origin: string;
    destination: string;
    origin_cep?: string;
    destination_cep?: string;
    client_name?: string;
  }>;
  height?: string;
}

interface MapMarker {
  position: { lat: number; lng: number };
  label: string;
  type: 'origin' | 'stop' | 'destination';
}

export function RouteVisualizationMap({
  suggestion,
  quotes,
  height = '400px',
}: RouteVisualizationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const initializeMap = async () => {
      try {
        // Load Google Maps script
        await loadGoogleMapsScript();

        // Create map centered on Brazil
        const map = new window.google.maps.Map(mapContainer.current, {
          zoom: 10,
          center: { lat: -23.5505, lng: -46.6333 }, // São Paulo region
          mapTypeId: 'roadmap',
        });

        mapRef.current = map;

        // Clear previous markers
        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];

        // Add markers for each quote
        const infoWindows: google.maps.InfoWindow[] = [];

        // Default coordinates (São Paulo region as fallback)
        const defaultCoords: Record<string, { lat: number; lng: number }> = {
          navegantes: { lat: -26.9319, lng: -48.6658 },
          itajaí: { lat: -26.9243, lng: -48.6608 },
          'são paulo': { lat: -23.5505, lng: -46.6333 },
          blumenau: { lat: -26.8791, lng: -49.066 },
        };

        const getCoordinates = (cityName: string): { lat: number; lng: number } => {
          const normalized = cityName.toLowerCase();
          for (const [key, coords] of Object.entries(defaultCoords)) {
            if (normalized.includes(key)) {
              return coords;
            }
          }
          // Default to São Paulo
          return { lat: -23.5505, lng: -46.6333 };
        };

        // Add markers
        quotes.forEach((quote, index) => {
          const originCoords = getCoordinates(quote.origin || '');
          const destCoords = getCoordinates(quote.destination || '');

          // Origin marker (blue, only for first quote)
          if (index === 0) {
            const originMarker = new window.google.maps.Marker({
              position: originCoords,
              map,
              title: quote.origin,
              label: {
                text: 'O',
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold',
              },
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#1e40af',
                strokeWeight: 2,
              },
            });

            const originInfoWindow = new window.google.maps.InfoWindow({
              content: `<div class="font-semibold text-sm">${quote.origin}</div><div class="text-xs text-gray-600">📍 Origem</div>`,
            });

            originMarker.addListener('click', () => {
              infoWindows.forEach((iw) => iw.close());
              originInfoWindow.open(map, originMarker);
            });

            markersRef.current.push(originMarker);
            infoWindows.push(originInfoWindow);
          }

          // Destination marker (red)
          const markerIcon =
            index === 0
              ? '#ef4444' // Main destination
              : '#f97316'; // Secondary destinations

          const destMarker = new window.google.maps.Marker({
            position: destCoords,
            map,
            title: quote.destination,
            label: {
              text: String(index + 1),
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
            },
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: markerIcon,
              fillOpacity: 1,
              strokeColor: '#7c2d12',
              strokeWeight: 2,
            },
          });

          const clientName = quote.client_name || 'Cliente';
          const destInfoWindow = new window.google.maps.InfoWindow({
            content: `<div class="font-semibold text-sm">${quote.destination}</div><div class="text-xs text-gray-600">📦 ${clientName}</div><div class="text-xs text-gray-500">Parada ${index === 0 ? 'Principal' : index}</div>`,
          });

          destMarker.addListener('click', () => {
            infoWindows.forEach((iw) => iw.close());
            destInfoWindow.open(map, destMarker);
          });

          markersRef.current.push(destMarker);
          infoWindows.push(destInfoWindow);
        });

        // Draw polyline connecting all destinations
        if (quotes.length > 1) {
          const polylinePath = quotes.map((quote) => getCoordinates(quote.destination || ''));

          const polyline = new window.google.maps.Polyline({
            path: polylinePath,
            geodesic: true,
            strokeColor: '#4f46e5',
            strokeOpacity: 0.7,
            strokeWeight: 3,
            map,
          });

          // Fit bounds to show all markers
          const bounds = new window.google.maps.LatLngBounds();
          polylinePath.forEach((point) => {
            bounds.extend(point);
          });

          // Also include origin
          if (quotes.length > 0) {
            bounds.extend(getCoordinates(quotes[0].origin || ''));
          }

          map.fitBounds(bounds);
        }

        setLoading(false);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('[RouteVisualizationMap] Error:', err);
        setError(errorMsg);
        setLoading(false);
      }
    };

    initializeMap();

    return () => {
      // Cleanup
      markersRef.current.forEach((marker) => marker.setMap(null));
    };
  }, [quotes, suggestion]);

  return (
    <div className="space-y-2">
      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border border-gray-200">
          <Loader className="w-5 h-5 animate-spin text-gray-600 mr-2" />
          <span className="text-sm text-gray-600">Carregando mapa...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Erro ao carregar mapa</p>
            <p className="text-xs text-yellow-700 mt-1">{error}</p>
            <p className="text-xs text-yellow-600 mt-2">
              💡 Verifique se VITE_GOOGLE_MAPS_API_KEY está configurado em .env.local
            </p>
          </div>
        </div>
      )}

      {/* Map container */}
      {!error && (
        <>
          <div
            ref={mapContainer}
            style={{ height }}
            className="rounded-lg border border-gray-200 shadow-sm overflow-hidden"
          />

          {/* Legend */}
          <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-2">
            <div className="text-xs font-semibold text-blue-900">Legenda:</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 border border-blue-700"></div>
                <span className="text-gray-700">Origem</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 border border-red-700"></div>
                <span className="text-gray-700">Destino Principal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500 border border-orange-700"></div>
                <span className="text-gray-700">Paradas Secundárias</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-4 bg-indigo-500"></div>
                <span className="text-gray-700">Rota</span>
              </div>
            </div>
          </div>

          {/* Route summary */}
          <div className="bg-green-50 border border-green-200 rounded p-3 space-y-1">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-gray-600">Distância Total</div>
                <div className="font-semibold text-green-700">
                  {suggestion.composed_km_total
                    ? `${suggestion.composed_km_total.toFixed(0)}km`
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Delta</div>
                <div className="font-semibold text-green-700">
                  {suggestion.delta_km_percent !== null
                    ? `+${suggestion.delta_km_percent.toFixed(1)}%`
                    : '—'}
                </div>
              </div>
            </div>
            {suggestion.delta_km_abs !== null && (
              <div className="text-xs text-gray-600">
                Economia: <strong>+{suggestion.delta_km_abs.toFixed(0)}km</strong> versus rotas
                separadas
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
