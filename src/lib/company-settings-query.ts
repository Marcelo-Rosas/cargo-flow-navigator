import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { isValidCompanyCnpj } from '@/lib/company-settings-normalize';

type CompanySettingsRow = Database['public']['Tables']['company_settings']['Row'];

/** Prefer row with valid 14-digit CNPJ, then most recently updated. */
export async function fetchLatestCompanySettings(
  supabase: SupabaseClient
): Promise<CompanySettingsRow | null> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  if (!data?.length) return null;

  const validCnpj = data.find((row) => isValidCompanyCnpj(row.cnpj));
  return validCnpj ?? data[0] ?? null;
}
