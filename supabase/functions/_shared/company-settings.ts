import type { SupabaseClient } from '@supabase/supabase-js';

function isValidCompanyCnpj(value: string | null | undefined): boolean {
  const d = String(value ?? '').replace(/\D/g, '');
  if (d.length !== 14) return false;
  if (/^0+$/.test(d)) return false;
  return true;
}

/** Prefer row with valid 14-digit CNPJ, then most recently updated. */
export async function fetchCompanySettings<
  T extends Record<string, unknown> = Record<string, unknown>,
>(supabase: SupabaseClient): Promise<T | null> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  if (!data?.length) return null;

  const rows = data as T[];
  const validCnpj = rows.find((row) => isValidCompanyCnpj(String(row.cnpj ?? '')));
  return validCnpj ?? rows[0] ?? null;
}
