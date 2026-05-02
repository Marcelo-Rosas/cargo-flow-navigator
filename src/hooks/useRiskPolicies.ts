import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { filterSupabaseRows } from '@/lib/supabase-utils';

export interface RiskPolicy {
  id: string;
  code: string;
  name: string;
  policy_type: string;
  insurer: string | null;
  endorsement: string | null;
  risk_manager: string | null;
  valid_from: string | null;
  valid_until: string | null;
  coverage_limit: number | null;
  deductible: number | null;
  metadata: Record<string, unknown> | null;
  document_url: string | null;
  is_active: boolean;
}

/**
 * Busca apólices de seguro ativas da tabela risk_policies.
 * Retorna RCTR-C e RC-DC com dados de cobertura e prêmio.
 */
export function useActivePolicies() {
  return useQuery({
    queryKey: ['risk-policies', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('risk_policies')
        .select('*')
        .eq('is_active', true)
        .order('policy_type', { ascending: true });

      if (error) throw error;
      return filterSupabaseRows<RiskPolicy>(data);
    },
  });
}

/**
 * Calcula prêmio estimado de uma apólice com base no valor da carga.
 * Retorna o prêmio em R$ (não centavos).
 */
export function calculatePremium(policy: RiskPolicy, cargoValue: number): number {
  const premiumRate =
    (policy.metadata?.premium_rate_percent as number) ??
    (policy.metadata?.ad_valorem_rate_percent as number) ??
    0.015;
  return Math.round(cargoValue * (premiumRate / 100) * 100) / 100;
}

const RJ_UF = 'RJ';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

/**
 * Verifica se a carga está dentro da cobertura da apólice.
 * Aplica sublimites regionais do metadata.lmg_breakdown quando a rota passa pelo RJ metropolitano.
 */
export function validateCoverage(
  policy: RiskPolicy,
  cargoValue: number,
  context?: { destinationUf?: string }
): { ok: boolean; message?: string; appliedLimit: number } {
  const lmg = policy.metadata?.lmg_breakdown as Record<string, number> | null | undefined;
  const baseLimit = policy.coverage_limit ?? 0;

  // Sublimite RJ metropolitano (Berkley: R$ 600.000)
  const isRjRoute = context?.destinationUf?.toUpperCase() === RJ_UF;
  const rjLimit = lmg?.rj_metropolitano;
  const appliedLimit = isRjRoute && rjLimit ? rjLimit : baseLimit;

  if (!appliedLimit) return { ok: true, appliedLimit: 0 };

  if (cargoValue > appliedLimit) {
    const region = isRjRoute && rjLimit ? ' (sublimite RJ Metropolitano)' : '';
    return {
      ok: false,
      appliedLimit,
      message: `Valor da carga R$ ${fmt(cargoValue)} excede limite ${policy.policy_type}${region}: R$ ${fmt(appliedLimit)}`,
    };
  }
  return { ok: true, appliedLimit };
}

/**
 * Exposição agregada de um motorista: soma dos cargo_value de todas as OS ativas
 * no mesmo motorista, excluindo a OS atual.
 */
export function useDriverActiveExposure(
  driverId: string | null | undefined,
  currentOrderId: string
) {
  return useQuery({
    queryKey: ['driver-exposure', driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, cargo_value, os_number, stage')
        .eq('driver_id', driverId!)
        .in('stage', ['busca_motorista', 'documentacao', 'coleta_realizada', 'em_transito'])
        .neq('id', currentOrderId);
      if (error) throw error;
      const rows = (data ?? []) as {
        id: string;
        cargo_value: number | null;
        os_number: string;
        stage: string;
      }[];
      const totalOtherOrders = rows.reduce((s, r) => s + (r.cargo_value ?? 0), 0);
      return { rows, totalOtherOrders };
    },
    staleTime: 60_000,
  });
}

/**
 * Verifica se a apólice está vigente.
 */
export function validateValidity(policy: RiskPolicy): { ok: boolean; message?: string } {
  const today = new Date().toISOString().split('T')[0];
  if (policy.valid_until && policy.valid_until < today) {
    return {
      ok: false,
      message: `Apólice ${policy.policy_type} (${policy.code}) vencida em ${policy.valid_until}`,
    };
  }
  return { ok: true };
}

/**
 * Estima prazo de entrega (D+ dias úteis) com base na distância e modalidade.
 *
 * Referência mercado rodoviário BR:
 * - Lotação (dedicada): mais rápido, sem consolidação
 * - Fracionado: hub-and-spoke, consolidação em terminais
 */
export function estimateDeliveryDays(
  kmDistance: number,
  modality: 'lotacao' | 'fracionado' = 'lotacao'
): { min: number; max: number } {
  if (modality === 'lotacao') {
    if (kmDistance <= 500) return { min: 1, max: 2 };
    if (kmDistance <= 1000) return { min: 2, max: 3 };
    if (kmDistance <= 2000) return { min: 3, max: 5 };
    return { min: 5, max: 7 };
  }
  // fracionado
  if (kmDistance <= 500) return { min: 3, max: 5 };
  if (kmDistance <= 1000) return { min: 5, max: 7 };
  if (kmDistance <= 2000) return { min: 7, max: 10 };
  return { min: 10, max: 15 };
}
