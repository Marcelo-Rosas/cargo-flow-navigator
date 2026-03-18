/**
 * Geographic utilities for distance/location calculations
 */

/**
 * Calculate haversine distance between two coordinates
 * @param lat1 - Starting latitude
 * @param lon1 - Starting longitude
 * @param lat2 - Ending latitude
 * @param lon2 - Ending longitude
 * @returns Distance in kilometers
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
 * Convert address to approximate coordinates via geocoding
 * In production, use Google Maps Geocoding API
 */
export function approximateCoordinates(address: string): { latitude: number; longitude: number } {
  // Mock implementation - returns São Bernardo do Campo area
  // Real implementation would call Google Geocoding API
  const mockCoordinates: Record<string, { latitude: number; longitude: number }> = {
    'são bernardo do campo': { latitude: -23.6955, longitude: -46.5639 },
    barueri: { latitude: -23.5059, longitude: -46.8681 },
    itapevi: { latitude: -23.5947, longitude: -46.95 },
    diadema: { latitude: -23.6733, longitude: -46.6179 },
    'santo andré': { latitude: -23.6637, longitude: -46.5277 },
  };

  const normalized = address.toLowerCase();
  for (const [key, coords] of Object.entries(mockCoordinates)) {
    if (normalized.includes(key)) {
      return coords;
    }
  }

  // Default fallback (São Bernardo do Campo warehouse)
  return { latitude: -23.6955, longitude: -46.5639 };
}

/**
 * Estimate driving time based on distance and typical urban speed
 */
export function estimateDrivingTime(distanceKm: number, speedKmH: number = 60): number {
  return Math.round((distanceKm / speedKmH) * 60); // return in minutes
}

/**
 * Bearing between two coordinates (for visual direction)
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;

  return (bearing + 360) % 360; // normalize to 0-360
}

/**
 * Create bounding box from list of coordinates
 */
export function createBoundingBox(coordinates: Array<{ latitude: number; longitude: number }>): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} {
  let minLat = Infinity,
    maxLat = -Infinity;
  let minLon = Infinity,
    maxLon = -Infinity;

  for (const coord of coordinates) {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLon = Math.min(minLon, coord.longitude);
    maxLon = Math.max(maxLon, coord.longitude);
  }

  return { minLat, maxLat, minLon, maxLon };
}

/**
 * Center of bounding box
 */
export function getBoundingBoxCenter(bbox: ReturnType<typeof createBoundingBox>): {
  latitude: number;
  longitude: number;
} {
  return {
    latitude: (bbox.minLat + bbox.maxLat) / 2,
    longitude: (bbox.minLon + bbox.maxLon) / 2,
  };
}
