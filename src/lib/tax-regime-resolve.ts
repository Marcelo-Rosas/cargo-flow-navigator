import type { PricingRuleConfig } from '@/hooks/usePricingRules';
import { resolvePricingRule } from '@/hooks/usePricingRules';

export interface ResolvedTaxRegimeFlags {
  regimeLucroPresumido: boolean;
  regimeSimplesNacional: boolean;
  excessoSublimite: boolean;
  pisPercent: number;
  cofinsPercent: number;
  irpjEffectivePercent: number;
  csllEffectivePercent: number;
}

/**
 * Resolve regime tributário (Central de Regras + fallback legado em pricing_parameters).
 * Evita estado órfão: Simples=0 e Lucro Presumido=0 → "Regime Normal" sem PIS/COFINS.
 */
export function resolveTaxRegimeFlags(params: {
  pricingRules?: PricingRuleConfig[];
  vehicleTypeId?: string | null;
  taxRegimeLucroPresumidoParam?: number | null;
}): ResolvedTaxRegimeFlags {
  const vtId = params.vehicleTypeId ?? undefined;
  const rules = params.pricingRules;

  const pisPercent = resolvePricingRule(rules, 'pis_percent', vtId, 0) ?? 0;
  const cofinsPercent = resolvePricingRule(rules, 'cofins_percent', vtId, 0) ?? 0;
  const irpjEffectivePercent = resolvePricingRule(rules, 'irpj_effective_percent', vtId, 0) ?? 0;
  const csllEffectivePercent = resolvePricingRule(rules, 'csll_effective_percent', vtId, 0) ?? 0;

  const regimeLucroFromRule =
    (resolvePricingRule(rules, 'regime_lucro_presumido', vtId, 0) ?? 0) === 1;
  const regimeLucroFromParam =
    params.taxRegimeLucroPresumidoParam != null &&
    Number(params.taxRegimeLucroPresumidoParam) === 1;
  const hasLpRates = pisPercent > 0 || cofinsPercent > 0;
  const regimeSimplesRaw =
    (resolvePricingRule(rules, 'regime_simples_nacional', vtId, 1) ?? 1) === 1;

  let regimeLucroPresumido = regimeLucroFromRule || regimeLucroFromParam;
  if (!regimeLucroPresumido && !regimeSimplesRaw && hasLpRates) {
    regimeLucroPresumido = true;
  }

  const excessoVal = resolvePricingRule(rules, 'excesso_sublimite', vtId, 0);
  return {
    regimeLucroPresumido,
    regimeSimplesNacional: regimeLucroPresumido ? false : regimeSimplesRaw,
    excessoSublimite: regimeLucroPresumido ? false : (excessoVal ?? 0) === 1,
    pisPercent,
    cofinsPercent,
    irpjEffectivePercent,
    csllEffectivePercent,
  };
}
