/**
 * Tipos para paradas no roteiro da cotação (origem → paradas → destino).
 * Ref: docs/plans/análise-360-paradas-roteiro-multiplos-destinatários.md
 */

export type RouteStopType = 'origin' | 'stop' | 'destination';

export interface RouteStop {
  /** ID local (frontend) ou uuid (persistido) */
  id: string;
  sequence: number;
  stop_type: RouteStopType;
  cnpj?: string | null;
  name?: string | null;
  cep?: string | null;
  city_uf?: string | null;
  label?: string | null;
  planned_km_from_prev?: number | null;
  metadata?: Record<string, unknown> | null;
}

/** Waypoint para cálculo de km (ordem: origem, paradas, destino) */
export interface Waypoint {
  cep: string;
  city_uf?: string;
  label?: string;
}
