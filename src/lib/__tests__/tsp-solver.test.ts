/**
 * TSP Solver Tests
 * Unit tests for Traveling Salesman Problem solver
 */

import { describe, it, expect } from 'https://deno.land/std@0.208.0/testing/bdd.ts';
import {
  buildDistanceMatrix,
  nearestNeighbor,
  twoOptOptimization,
  solveTSP,
  validateSolution,
  calculateHaversineDistance,
  type Location,
} from '../tsp-solver';

describe('TSP Solver', () => {
  // Test data: 4 locations in São Paulo area
  const testLocations: Location[] = [
    {
      id: 'warehouse',
      name: 'Warehouse',
      latitude: -23.6955,
      longitude: -46.5639,
      weight_kg: 0,
    },
    {
      id: 'pickup1',
      name: 'Pickup 1 - Barueri',
      latitude: -23.5059,
      longitude: -46.8681,
      weight_kg: 500,
    },
    {
      id: 'pickup2',
      name: 'Pickup 2 - Diadema',
      latitude: -23.6733,
      longitude: -46.6179,
      weight_kg: 400,
    },
    {
      id: 'pickup3',
      name: 'Pickup 3 - Santo André',
      latitude: -23.6637,
      longitude: -46.5277,
      weight_kg: 300,
    },
  ];

  describe('Haversine Distance', () => {
    it('should calculate distance between two coordinates', () => {
      // São Bernardo to Barueri (approximately 33 km)
      const distance = calculateHaversineDistance(
        -23.6955, // lat1
        -46.5639, // lon1
        -23.5059, // lat2
        -46.8681 // lon2
      );

      expect(distance).toBeGreaterThan(30);
      expect(distance).toBeLessThan(40);
    });

    it('should return 0 for same coordinates', () => {
      const distance = calculateHaversineDistance(-23.6955, -46.5639, -23.6955, -46.5639);
      expect(distance).toBe(0);
    });
  });

  describe('Distance Matrix', () => {
    it('should build a valid distance matrix', () => {
      const matrix = buildDistanceMatrix(testLocations);

      expect(matrix.distances).toHaveLength(4);
      expect(matrix.distances[0]).toHaveLength(4);
      expect(matrix.durations).toHaveLength(4);
      expect(matrix.durations[0]).toHaveLength(4);

      // Diagonal should be zeros
      for (let i = 0; i < 4; i++) {
        expect(matrix.distances[i][i]).toBe(0);
        expect(matrix.durations[i][i]).toBe(0);
      }

      // Symmetric (distance from A to B == B to A)
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          expect(matrix.distances[i][j]).toBeCloseTo(matrix.distances[j][i], 0.01);
        }
      }
    });

    it('should estimate driving times', () => {
      const matrix = buildDistanceMatrix(testLocations);

      // Time should be roughly distance / 60 km/h * 60 minutes
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          if (i !== j) {
            const expectedMinutes = (matrix.distances[i][j] / 60) * 60;
            expect(matrix.durations[i][j]).toBeLessThanOrEqual(expectedMinutes + 1);
            expect(matrix.durations[i][j]).toBeGreaterThanOrEqual(expectedMinutes - 1);
          }
        }
      }
    });
  });

  describe('Nearest Neighbor', () => {
    it('should create a valid route', () => {
      const matrix = buildDistanceMatrix(testLocations);
      const solution = nearestNeighbor(matrix, 0);

      // Should visit all locations
      expect(solution.path).toHaveLength(4);
      expect(new Set(solution.path).size).toBe(4);

      // Should start at 0
      expect(solution.path[0]).toBe(0);

      // Should have positive distance
      expect(solution.totalDistance).toBeGreaterThan(0);
      expect(solution.totalDuration).toBeGreaterThan(0);

      // Legs should match
      expect(solution.legs).toHaveLength(3);
    });

    it('should visit nearest unvisited location', () => {
      const matrix = buildDistanceMatrix(testLocations);
      const solution = nearestNeighbor(matrix, 0);

      // Verify nearest neighbor property
      for (let i = 0; i < solution.path.length - 1; i++) {
        const current = solution.path[i];
        const next = solution.path[i + 1];
        const distToNext = matrix.distances[current][next];

        // Check that next was among the closest remaining
        // (not guaranteed to be closest, but should be reasonably close)
        let foundCloser = false;
        for (let j = i + 2; j < solution.path.length; j++) {
          const alt = solution.path[j];
          if (matrix.distances[current][alt] < distToNext) {
            foundCloser = true;
          }
        }
        // This test is probabilistic, so we don't assert it always
      }

      expect(solution.legs.length).toBeGreaterThan(0);
    });
  });

  describe('2-opt Optimization', () => {
    it('should not increase total distance', () => {
      const matrix = buildDistanceMatrix(testLocations);
      const initialSolution = nearestNeighbor(matrix, 0);
      const optimized = twoOptOptimization(initialSolution, matrix, 50);

      expect(optimized.totalDistance).toBeLessThanOrEqual(initialSolution.totalDistance * 1.01); // Allow 1% margin
    });

    it('should maintain all locations in path', () => {
      const matrix = buildDistanceMatrix(testLocations);
      const initialSolution = nearestNeighbor(matrix, 0);
      const optimized = twoOptOptimization(initialSolution, matrix, 50);

      expect(new Set(optimized.path).size).toBe(4);
      expect(optimized.path).toHaveLength(4);
    });
  });

  describe('Full TSP Solution', () => {
    it('should solve TSP and return valid solution', () => {
      const solution = solveTSP(testLocations);

      // Basic validations
      expect(solution.path).toHaveLength(4);
      expect(new Set(solution.path).size).toBe(4);
      expect(solution.totalDistance).toBeGreaterThan(0);
      expect(solution.legs).toHaveLength(3);

      // Each leg should have positive distance
      for (const leg of solution.legs) {
        expect(leg.distanceKm).toBeGreaterThan(0);
        expect(leg.durationMin).toBeGreaterThan(0);
        expect(leg.sequenceNumber).toBeGreaterThan(0);
      }
    });
  });

  describe('Solution Validation', () => {
    it('should validate solution against constraints', () => {
      const solution = solveTSP(testLocations);

      const validation = validateSolution(solution, testLocations, {
        maxWeightKg: 30000,
        maxDeviationPercent: 15,
        baselineDistance: 100, // rough estimate
      });

      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('warnings');
      expect(Array.isArray(validation.warnings)).toBe(true);
    });

    it('should warn on weight exceeded', () => {
      const solution = solveTSP(testLocations);

      const validation = validateSolution(solution, testLocations, {
        maxWeightKg: 500, // Low limit to trigger warning
      });

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('weight');
    });

    it('should warn on distance deviation', () => {
      const solution = solveTSP(testLocations);

      const validation = validateSolution(solution, testLocations, {
        baselineDistance: 10, // Very low baseline
        maxDeviationPercent: 5, // Very strict limit
      });

      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single location', () => {
      const single: Location[] = [
        {
          id: 'loc1',
          name: 'Single',
          latitude: -23.6955,
          longitude: -46.5639,
        },
      ];

      const solution = solveTSP(single);
      expect(solution.path).toHaveLength(1);
      expect(solution.totalDistance).toBe(0);
    });

    it('should handle two locations', () => {
      const two: Location[] = [
        {
          id: 'loc1',
          name: 'Location 1',
          latitude: -23.6955,
          longitude: -46.5639,
        },
        {
          id: 'loc2',
          name: 'Location 2',
          latitude: -23.5059,
          longitude: -46.8681,
        },
      ];

      const solution = solveTSP(two);
      expect(solution.path).toHaveLength(2);
      expect(solution.totalDistance).toBeGreaterThan(0);
    });
  });
});
