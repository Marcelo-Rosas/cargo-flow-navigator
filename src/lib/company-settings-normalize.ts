import type { Database } from '@/integrations/supabase/types';
import { fixMojibake } from '@/lib/fix-mojibake';

type CompanySettingsUpdate = Database['public']['Tables']['company_settings']['Update'];

const digits = (v: string) => v.replace(/\D/g, '');

/** CNPJ persistido: 14 dígitos, não placeholder (ex. zeros). */
export function isValidCompanyCnpj(value: string | null | undefined): boolean {
  const d = digits(String(value ?? ''));
  if (d.length !== 14) return false;
  if (/^0+$/.test(d)) return false;
  return true;
}

const text = (v: string | null | undefined) => fixMojibake(v ?? '').trim();

/** CPF opcional: vazio OK; mascarado da Receita (≠11 dígitos) persiste dígitos visíveis. */
export function normalizeRepresentativeCpf(value: string | null | undefined): string | null {
  const d = digits(String(value ?? ''));
  if (d.length === 0) return null;
  if (d.length > 11) return null;
  if (d.length < 11) return d;
  return d;
}

/** CPF para o formulário: só dígitos; partial da Receita (ex. `982984`) é preservado. */
export function formatRepresentativeCpfForForm(value: string | null | undefined): string {
  return digits(String(value ?? ''));
}

/** Normaliza payload do formulário (CNPJ/CEP/CPF só dígitos, textos trim, mojibake). */
export function normalizeCompanySettingsPayload(
  data: CompanySettingsUpdate & { id?: string }
): CompanySettingsUpdate {
  const { id: _id, ...rest } = data;
  return {
    ...rest,
    legal_name: text(rest.legal_name),
    trade_name: text(rest.trade_name) || '',
    cnpj: rest.cnpj ? digits(String(rest.cnpj)) : rest.cnpj,
    state_registration: text(rest.state_registration) || '',
    municipal_registration: text(rest.municipal_registration) || null,
    address_street: text(rest.address_street),
    address_number: text(rest.address_number),
    address_complement: text(rest.address_complement) || null,
    address_neighborhood: text(rest.address_neighborhood) || '',
    address_city: text(rest.address_city),
    address_state: text(rest.address_state).toUpperCase().slice(0, 2),
    address_zip: rest.address_zip ? digits(String(rest.address_zip)) : rest.address_zip,
    legal_representative_name: text(rest.legal_representative_name) || null,
    legal_representative_cpf: normalizeRepresentativeCpf(rest.legal_representative_cpf),
    legal_representative_role: text(rest.legal_representative_role) || null,
    bank_name: text(rest.bank_name) || null,
    bank_agency: text(rest.bank_agency) || null,
    bank_account: text(rest.bank_account) || null,
    bank_pix_key: text(rest.bank_pix_key) || null,
    default_jurisdiction: text(rest.default_jurisdiction) || 'Navegantes/SC',
    signature_city: text(rest.signature_city) || 'Navegantes',
    phone: text((rest as { phone?: string | null }).phone) || '',
    email: text((rest as { email?: string | null }).email) || '',
  };
}

export function mapCompanySettingsSaveError(error: { code?: string; message?: string }): string {
  if (error.code === 'PGRST116') {
    return 'Não foi possível salvar: sem permissão ou registro não encontrado. Confirme que você é admin.';
  }
  if (error.code === '42501') {
    return 'Sem permissão para alterar os dados da empresa (apenas administradores).';
  }
  if (error.code === '23505') {
    return 'Já existe um cadastro da empresa. Atualize a página e tente salvar novamente.';
  }
  return error.message ?? 'Erro ao salvar configurações';
}
