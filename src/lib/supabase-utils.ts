/**
 * Type guard: filters out Supabase SelectQueryError from query results.
 * Use when strictNullChecks causes TS to see rows as Row | SelectQueryError union.
 */
export function isSupabaseRow<T>(row: unknown): row is T {
  return row != null && typeof row === 'object' && !('error' in row);
}

/** Filter query result to only valid rows (excludes error objects) */
export function filterSupabaseRows<T>(data: unknown): T[] {
  if (!data || !Array.isArray(data)) return [];
  return data.filter((row): row is T => isSupabaseRow<T>(row));
}

/** For maybeSingle(): return row or null (excludes error objects) */
export function filterSupabaseSingle<T>(data: unknown): T | null {
  if (!data || !isSupabaseRow<T>(data)) return null;
  return data;
}

/**
 * Escape hatch for Supabase .eq()/update/insert when generic inference is overly strict.
 * Use sparingly: .eq('id', asDb(id)) when id is string but TS expects literal union.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asDb<T>(value: T): any {
  return value;
}

/**
 * Escape hatch for insert/update payloads when Supabase Insert/Update types are overly strict.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asInsert<T>(payload: T): any {
  return payload;
}
