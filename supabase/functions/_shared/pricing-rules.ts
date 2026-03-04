import type { SupabaseClient } from '@supabase/supabase-js';
import { FREIGHT_CONSTANTS, type CalculateFreightInput } from './freight-types.ts';

type PricingRuleRow = {
  key: string;
  value: number;
  vehicle_type_id: string | null;
};

type PricingParameterRow = {
  key: string;
  value: number;
};

export interface DynamicFreightParams {
  cubageFactor: number;
  dasPercent: number;
  markupPercent: number;
  overheadPercent: number;
  profitMarginPercent: number;
  regimeSimplesNacional: boolean;
  excessoSublimite: boolean;
  carreteiroPercent: number;
  descargaValue: number;
  aluguelMaquinasValue: number;
  correctionFactor: number;
  isSimples: boolean;
}

/**
 * Lê todas as regras ativas da Central de Regras.
 */
export async function fetchPricingRulesConfig(
  supabase: SupabaseClient,
  activeOnly = true
): Promise<PricingRuleRow[]> {
  const query = supabase
    .from('pricing_rules_config')
    .select('key, value, vehicle_type_id')
    .eq('is_active', activeOnly);

  const { data, error } = await query;
  if (error || !data) return [];

  return data as PricingRuleRow[];
}

/**
 * Resolve regra com precedência: Veículo > Global > fallback.
 */
export function resolvePricingRuleBackend(
  rules: PricingRuleRow[] | undefined,
  key: string,
  vehicleTypeId?: string | null,
  fallback?: number
): number | undefined {
  if (!rules?.length) return fallback;

  const byKey = rules.filter((r) => r.key === key);
  if (byKey.length === 0) return fallback;

  const vehicleRule = vehicleTypeId ? byKey.find((r) => r.vehicle_type_id === vehicleTypeId) : null;
  const globalRule = byKey.find((r) => r.vehicle_type_id == null);
  const rule = vehicleRule ?? globalRule;

  const val = rule ? Number(rule.value) : undefined;
  return Number.isFinite(val as number) ? (val as number) : fallback;
}

/**
 * Constrói o conjunto consolidado de parâmetros financeiros para o cálculo de frete,
 * usando Central de Regras (`pricing_rules_config`) como fonte primária,
 * `pricing_parameters` como legado e `FREIGHT_CONSTANTS` apenas como último fallback.
 *
 * Também registra em `fallbacksApplied` quando defaults são usados.
 */
export async function buildDynamicFreightParams(
  supabase: SupabaseClient,
  input: CalculateFreightInput,
  fallbacksApplied: string[]
): Promise<{ params: DynamicFreightParams; vehicleTypeIdForRules: string | null }> {
  // Resolve ID de tipo de veículo para precedência nas regras
  let vehicleTypeIdForRules: string | null = null;

  if (input.vehicle_type_code) {
    const { data: vt } = await supabase
      .from('vehicle_types')
      .select('id')
      .eq('code', input.vehicle_type_code)
      .eq('active', true)
      .maybeSingle();

    vehicleTypeIdForRules = (vt as { id: string } | null)?.id ?? null;
  }

  const allRules = await fetchPricingRulesConfig(supabase, true);

  // Fallback legado: pricing_parameters
  const { data: allParams } = await supabase.from('pricing_parameters').select('key, value');
  const paramsMap = new Map<string, number>();
  (allParams as PricingParameterRow[] | null | undefined)?.forEach((p) =>
    paramsMap.set(p.key, Number(p.value))
  );

  const cubageFactor = paramsMap.get('cubage_factor') ?? FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3;

  const dasPercent =
    input.das_percent ??
    resolvePricingRuleBackend(allRules, 'das_percent', vehicleTypeIdForRules) ??
    paramsMap.get('das_percent') ??
    FREIGHT_CONSTANTS.DEFAULT_DAS_PERCENT;

  const markupPercent =
    input.markup_percent ??
    resolvePricingRuleBackend(allRules, 'markup_percent', vehicleTypeIdForRules) ??
    paramsMap.get('markup_percent') ??
    FREIGHT_CONSTANTS.DEFAULT_MARKUP_PERCENT;

  const overheadPercent =
    input.overhead_percent ??
    resolvePricingRuleBackend(allRules, 'overhead_percent', vehicleTypeIdForRules) ??
    paramsMap.get('overhead_percent') ??
    FREIGHT_CONSTANTS.DEFAULT_OVERHEAD_PERCENT;

  const profitMarginPercent =
    resolvePricingRuleBackend(allRules, 'profit_margin_percent', vehicleTypeIdForRules) ??
    paramsMap.get('profit_margin_percent') ??
    FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT;

  const regimeSimplesNacional =
    (resolvePricingRuleBackend(allRules, 'regime_simples_nacional', vehicleTypeIdForRules) ?? 1) ===
    1;

  const excessoSublimite =
    (resolvePricingRuleBackend(allRules, 'excesso_sublimite', vehicleTypeIdForRules) ?? 0) === 1;

  const carreteiroPercent = input.carreteiro_percent ?? paramsMap.get('carreteiro_percent') ?? 0;

  const descargaValue = input.descarga_value ?? 0;
  const aluguelMaquinasValue = input.aluguel_maquinas_value ?? 0;

  const correctionFactor = paramsMap.get('correction_factor_inctf') ?? 1.0;

  const isSimples = regimeSimplesNacional && !excessoSublimite;

  // Fallbacks auditáveis
  if (!paramsMap.has('das_percent') && !allRules.some((r) => r.key === 'das_percent')) {
    fallbacksApplied.push(`das_percent: usando default ${FREIGHT_CONSTANTS.DEFAULT_DAS_PERCENT}%`);
  }
  if (!paramsMap.has('markup_percent') && !allRules.some((r) => r.key === 'markup_percent')) {
    fallbacksApplied.push(
      `markup_percent: usando default ${FREIGHT_CONSTANTS.DEFAULT_MARKUP_PERCENT}%`
    );
  }
  if (!paramsMap.has('correction_factor_inctf')) {
    fallbacksApplied.push('correction_factor_inctf: não encontrado, usando 1.0');
  }

  // NTC Lotação Dez/25: correctionFactor e markup não aplicados ao frete peso
  fallbacksApplied.push('ntc_mode: correctionFactor/markup ignored');

  return {
    vehicleTypeIdForRules,
    params: {
      cubageFactor,
      dasPercent,
      markupPercent,
      overheadPercent,
      profitMarginPercent,
      regimeSimplesNacional,
      excessoSublimite,
      carreteiroPercent,
      descargaValue,
      aluguelMaquinasValue,
      correctionFactor,
      isSimples,
    },
  };
}
