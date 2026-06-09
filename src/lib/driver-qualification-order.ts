/** Paridade com supabase/functions/_shared/driver-qualification-order.ts */
export function normalizePlate(plate: string): string {
  return plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}
