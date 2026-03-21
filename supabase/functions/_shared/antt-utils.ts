/**
 * Shared ANTT utilities for Edge Functions.
 *
 * - Infer vehicle axes from consolidated weight via `vehicle_types` table
 * - Fetch CCD/CC floor rates from `antt_floor_rates` table
 * - Calculate ANTT minimum floor: km × CCD + CC
 *
 * Used by analyze-load-composition for real-cost savings estimation.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VehicleInference {
  axes_count: number;
  vehicle_code: string;
  capacity_kg: number;
}

export interface AnttFloorRate {
  ccd: number; // R$/km
  cc: number; // R$ fixed
}

export interface AnttCostBreakdown {
  /** Total ANTT floor cost in centavos */
  total_centavos: number;
  /** CCD component: km × ccd (centavos) */
  ccd_component_centavos: number;
  /** CC component: fixed cost (centavos) */
  cc_component_centavos: number;
  /** Rate used */
  ccd: number;
  cc: number;
  axes_count: number;
  vehicle_code: string;
}

// ---------------------------------------------------------------------------
// Hardcoded fallback (if vehicle_types table is empty)
// ---------------------------------------------------------------------------

const FALLBACK_VEHICLES: VehicleInference[] = [
  { vehicle_code: 'VUC', axes_count: 2, capacity_kg: 3500 },
  { vehicle_code: 'TOCO', axes_count: 2, capacity_kg: 6000 },
  { vehicle_code: 'TRUCK', axes_count: 3, capacity_kg: 14000 },
  { vehicle_code: 'BI_TRUCK', axes_count: 4, capacity_kg: 18000 },
  { vehicle_code: 'CARRETA_3', axes_count: 5, capacity_kg: 25000 },
  { vehicle_code: 'CARRETA_4', axes_count: 6, capacity_kg: 30000 },
  { vehicle_code: 'RODOTREM', axes_count: 9, capacity_kg: 57000 },
];

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Infer the smallest vehicle that fits the given weight.
 * Prefers the DB table; falls back to hardcoded list if empty.
 */
export async function inferAxesFromWeight(
  supabase: SupabaseClient,
  weightKg: number
): Promise<VehicleInference> {
  const { data, error } = await supabase
    .from('vehicle_types')
    .select('code, axes_count, capacity_kg')
    .eq('active', true)
    .gte('capacity_kg', weightKg)
    .order('capacity_kg', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!error && data && data.axes_count && data.capacity_kg) {
    return {
      axes_count: Number(data.axes_count),
      vehicle_code: String(data.code),
      capacity_kg: Number(data.capacity_kg),
    };
  }

  // Fallback to hardcoded list
  const match = FALLBACK_VEHICLES.find((v) => v.capacity_kg >= weightKg);
  if (match) return match;

  // If weight exceeds all vehicles, use the largest
  return FALLBACK_VEHICLES[FALLBACK_VEHICLES.length - 1];
}

/**
 * Get axes_count directly from a vehicle_type_id (when quote already has one).
 */
export async function getAxesFromVehicleTypeId(
  supabase: SupabaseClient,
  vehicleTypeId: string
): Promise<VehicleInference | null> {
  const { data, error } = await supabase
    .from('vehicle_types')
    .select('code, axes_count, capacity_kg')
    .eq('id', vehicleTypeId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    axes_count: Number(data.axes_count),
    vehicle_code: String(data.code),
    capacity_kg: Number(data.capacity_kg),
  };
}

/**
 * Fetch CCD/CC from antt_floor_rates for given axes count.
 * Defaults to Table A, Carga Geral.
 */
export async function getAnttFloorRate(
  supabase: SupabaseClient,
  axesCount: number,
  cargoType = 'carga_geral',
  operationTable = 'A'
): Promise<AnttFloorRate | null> {
  const { data, error } = await supabase
    .from('antt_floor_rates')
    .select('ccd, cc')
    .eq('operation_table', operationTable)
    .eq('cargo_type', cargoType)
    .eq('axes_count', axesCount)
    .order('valid_from', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.warn(
      `[antt-utils] No rate found for axes=${axesCount}, cargo=${cargoType}, table=${operationTable}`
    );
    return null;
  }

  return {
    ccd: Number(data.ccd),
    cc: Number(data.cc),
  };
}

/**
 * Calculate ANTT minimum floor cost in centavos.
 * Formula: (km × CCD + CC) × 100
 */
export function calculateAnttFloor(km: number, ccd: number, cc: number): number {
  const brl = km * ccd + cc;
  return Math.round(brl * 100);
}

/**
 * Full cost breakdown for a set of trips (separated or consolidated).
 *
 * @param trips Array of { km } for each individual trip
 * @param vehicle Vehicle inference (axes_count, code)
 * @param rate ANTT CCD/CC rate
 * @returns Total cost in centavos + per-trip breakdown
 */
export function calculateSeparateCost(
  trips: { km: number }[],
  rate: AnttFloorRate
): { total_centavos: number; per_trip: number[] } {
  const perTrip = trips.map((t) => calculateAnttFloor(t.km, rate.ccd, rate.cc));
  return {
    total_centavos: perTrip.reduce((a, b) => a + b, 0),
    per_trip: perTrip,
  };
}

/**
 * Calculate consolidated cost (1 trip, 1 CC).
 */
export function calculateConsolidatedCost(totalKm: number, rate: AnttFloorRate): number {
  return calculateAnttFloor(totalKm, rate.ccd, rate.cc);
}
