/**
 * TSP Solver — Traveling Salesman Problem
 * Phase 1: Load Composition Engine
 *
 * Implements:
 * - Nearest Neighbor heuristic for initial route
 * - 2-opt local optimization
 * - Distance matrix calculation
 *
 * Used by Load Composition Engine to find optimal pickup/delivery routes
 */

import { haversineDistance } from './geo-utils';

/**
 * Location with coordinates
 */
export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  weight_kg?: number;
}

/**
 * Distance matrix entry
 */
export interface DistanceMatrix {
  locations: Location[];
  distances: number[][]; // distances[i][j] = distance from location i to j in km
  durations: number[][]; // durations[i][j] = duration from location i to j in minutes
}

/**
 * Route solution
 */
export interface RouteSolution {
  path: number[]; // indices of locations in optimal order
  totalDistance: number; // in km
  totalDuration: number; // in minutes
  legs: RouteLeg[];
}

/**
 * Individual leg of the route
 */
export interface RouteLeg {
  from: Location;
  to: Location;
  distanceKm: number;
  durationMin: number;
  sequenceNumber: number;
}

/**
 * TSP Solver configuration
 */
export interface TSPConfig {
  maxIterations?: number;
  maxDeviationPercent?: number; // max allowed increase in distance vs baseline
  includeOriginReturn?: boolean; // return to origin at end
}

const DEFAULT_CONFIG: TSPConfig = {
  maxIterations: 1000,
  maxDeviationPercent: 15,
  includeOriginReturn: true,
};

/**
 * Calculate haversine distance between two coordinates
 * @returns distance in kilometers
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate drive time using distance and average speed (60 km/h for urban)
 */
export function estimateDrivingTime(distanceKm: number, speedKmH: number = 60): number {
  return Math.round((distanceKm / speedKmH) * 60); // return minutes
}

/**
 * Build distance matrix from locations
 * Uses haversine formula (straight-line distance)
 * In production, use Google Maps API for actual routes
 */
export function buildDistanceMatrix(locations: Location[]): DistanceMatrix {
  const n = locations.length;
  const distances: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));
  const durations: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        distances[i][j] = 0;
        durations[i][j] = 0;
      } else {
        const dist = calculateHaversineDistance(
          locations[i].latitude,
          locations[i].longitude,
          locations[j].latitude,
          locations[j].longitude
        );
        distances[i][j] = dist;
        durations[i][j] = estimateDrivingTime(dist);
      }
    }
  }

  return { locations, distances, durations };
}

/**
 * Nearest Neighbor heuristic
 * Greedy algorithm: from current location, go to closest unvisited
 */
export function nearestNeighbor(matrix: DistanceMatrix, startIndex: number = 0): RouteSolution {
  const n = matrix.locations.length;
  const visited = Array(n).fill(false);
  const path: number[] = [startIndex];
  visited[startIndex] = true;
  let totalDistance = 0;
  let totalDuration = 0;

  let current = startIndex;

  // Build path
  for (let i = 1; i < n; i++) {
    let nearest = -1;
    let minDistance = Infinity;

    for (let j = 0; j < n; j++) {
      if (!visited[j] && matrix.distances[current][j] < minDistance) {
        minDistance = matrix.distances[current][j];
        nearest = j;
      }
    }

    if (nearest === -1) break;

    path.push(nearest);
    visited[nearest] = true;
    totalDistance += minDistance;
    totalDuration += matrix.durations[current][nearest];
    current = nearest;
  }

  // Return to origin if configured
  const legs = buildLegs(path, matrix);

  return {
    path,
    totalDistance,
    totalDuration,
    legs,
  };
}

/**
 * 2-opt swap optimization
 * Iteratively swap edges to reduce total distance
 * O(n²) per iteration, good for small-medium routes
 */
export function twoOptOptimization(
  initialSolution: RouteSolution,
  matrix: DistanceMatrix,
  maxIterations: number = 100
): RouteSolution {
  let currentPath = [...initialSolution.path];
  let improved = true;
  let iteration = 0;

  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;

    for (let i = 1; i < currentPath.length - 2; i++) {
      for (let j = i + 1; j < currentPath.length; j++) {
        // Calculate current distance (edges before and after swap)
        const distBefore =
          matrix.distances[currentPath[i - 1]][currentPath[i]] +
          matrix.distances[currentPath[j]][currentPath[(j + 1) % currentPath.length]];

        // Calculate distance after swap (reverse segment between i and j)
        const distAfter =
          matrix.distances[currentPath[i - 1]][currentPath[j]] +
          matrix.distances[currentPath[i]][currentPath[(j + 1) % currentPath.length]];

        // If swap improves, apply it
        if (distAfter < distBefore) {
          // Reverse path between i and j
          currentPath = [
            ...currentPath.slice(0, i),
            ...currentPath.slice(i, j + 1).reverse(),
            ...currentPath.slice(j + 1),
          ];
          improved = true;
        }
      }
    }
  }

  const legs = buildLegs(currentPath, matrix);
  const totalDistance = calculatePathDistance(currentPath, matrix);
  const totalDuration = calculatePathDuration(currentPath, matrix);

  return {
    path: currentPath,
    totalDistance,
    totalDuration,
    legs,
  };
}

/**
 * Calculate total distance for a path
 */
function calculatePathDistance(path: number[], matrix: DistanceMatrix): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += matrix.distances[path[i]][path[i + 1]];
  }
  return total;
}

/**
 * Calculate total duration for a path
 */
function calculatePathDuration(path: number[], matrix: DistanceMatrix): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += matrix.durations[path[i]][path[i + 1]];
  }
  return total;
}

/**
 * Convert path to leg objects
 */
function buildLegs(path: number[], matrix: DistanceMatrix): RouteLeg[] {
  const legs: RouteLeg[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const fromIdx = path[i];
    const toIdx = path[i + 1];
    legs.push({
      from: matrix.locations[fromIdx],
      to: matrix.locations[toIdx],
      distanceKm: matrix.distances[fromIdx][toIdx],
      durationMin: matrix.durations[fromIdx][toIdx],
      sequenceNumber: i + 1,
    });
  }
  return legs;
}

/**
 * Main solve function — applies heuristic + local optimization
 */
export function solveTSP(locations: Location[], config: TSPConfig = DEFAULT_CONFIG): RouteSolution {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Build distance matrix
  const matrix = buildDistanceMatrix(locations);

  // Step 1: Nearest Neighbor for initial solution
  const initialSolution = nearestNeighbor(matrix, 0);

  // Step 2: 2-opt improvement
  const optimizedSolution = twoOptOptimization(initialSolution, matrix, finalConfig.maxIterations);

  return optimizedSolution;
}

/**
 * Validate if solution respects constraints
 */
export function validateSolution(
  solution: RouteSolution,
  locations: Location[],
  constraints: {
    maxWeightKg?: number;
    maxDeviationPercent?: number;
    baselineDistance?: number;
  }
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check weight
  if (constraints.maxWeightKg) {
    const totalWeight = locations.reduce((sum, loc) => sum + (loc.weight_kg || 0), 0);
    if (totalWeight > constraints.maxWeightKg) {
      warnings.push(`Total weight ${totalWeight}kg exceeds limit ${constraints.maxWeightKg}kg`);
    }
  }

  // Check distance deviation
  if (constraints.baselineDistance && constraints.maxDeviationPercent) {
    const deviation =
      ((solution.totalDistance - constraints.baselineDistance) / constraints.baselineDistance) *
      100;
    if (deviation > constraints.maxDeviationPercent) {
      warnings.push(
        `Route is ${deviation.toFixed(1)}% longer than baseline (max ${constraints.maxDeviationPercent}%)`
      );
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

/**
 * Encode polyline for mapping (simplified version)
 * For production, use polyline npm package
 */
export function encodePolyline(lat: number, lon: number): string {
  return `${lat.toFixed(6)},${lon.toFixed(6)}`;
}
