// src/lib/freightCalculator.ts
/**
 * ============================================
 * CALCULADORA DE FRETE - v4.0
 * ============================================
 *
 * Regras:
 * - FOB Lotação (cost_per_ton)
 * - Impostos "por fora" (sem gross-up)
 * - Parâmetros dinâmicos via pricingParams
 * - Markup com escopo configurável (BASE_ONLY | BASE_PLUS_INSURANCE | ALL_PERCENT_COMPONENTS)
 * - Receita bruta inclui conditional fees + waiting time
 * - Custos diretos em R$ e/ou %
 * - Arredondamento round2 para paridade com backend
 * - Compatível com frontend e backend
 */

import { Database } from '@/integrations/supabase/types';

type PriceTableRow = Database['public']['Tables']['price_table_rows']['Row'];

// ============================================
// CONSTANTS (fallbacks only)
// ============================================

export const FREIGHT_CONSTANTS = {
  CUBAGE_FACTOR_KG_M3: 300,
  DEFAULT_DAS_PERCENT: 14,
  DEFAULT_MARKUP_PERCENT: 30,
  DEFAULT_OVERHEAD_PERCENT: 15,
  TARGET_MARGIN_PERCENT: 15,
  NTC_TDE_PERCENT: 20,
  NTC_TEAR_PERCENT: 20,
} as const;

// ============================================
// HELPERS
// ============================================

/** Arredonda para 2 casas decimais (paridade com backend) */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ============================================
// TYPES - MARKUP SCOPE
// ============================================

export type MarkupScope = 'BASE_ONLY' | 'BASE_PLUS_INSURANCE' | 'ALL_PERCENT_COMPONENTS';

// ============================================
// TYPES - INPUT
// ============================================

export interface FreightCalculationInput {
  // Localização
  originCity: string;
  destinationCity: string;
  kmDistance: number;

  // Carga
  weightKg: number;
  volumeM3: number;
  cargoValue: number;

  // Pedágio manual
  tollValue: number;

  // Aluguel de máquinas (valor fixo cobrado ao cliente)
  aluguelMaquinasValue?: number;

  // Linha da tabela de preços (já selecionada, pode ser null)
  priceTableRow: PriceTableRow | null;
  priceTableId?: string;

  // Modalidade da tabela (lotacao | fracionado)
  modality?: 'lotacao' | 'fracionado';

  // Parâmetros LTL (fracionado) — mínimos NTC
  ltlParams?: {
    minFreight: number;
    minFreightCargoLimit: number;
    minTso: number;
    grisPercent: number;
    grisMin: number;
    grisMinCargoLimit: number;
    dispatchFee: number;
  };

  // Alíquota ICMS (já normalizada em %)
  icmsRatePercent: number;

  // Taxas NTC opcionais
  tdeEnabled?: boolean;
  tearEnabled?: boolean;

  // Parâmetros dinâmicos de pricing_parameters
  pricingParams?: {
    cubageFactor?: number;
    dasPercent?: number;
    dasProvisionMinValue?: number;
    /** 1 = Simples Nacional (ICMS 0%), 0 = Normal. Default 1. */
    taxRegimeSimples?: number;
    markupPercent?: number;
    overheadPercent?: number;
    targetMarginPercent?: number;
    markupScope?: MarkupScope;
  };

  // Custos diretos (valores fixos em R$ e/ou %)
  directCosts?: {
    carreteiroValue?: number;
    carreteiroPercent?: number;
    descargaValue?: number;
  };

  // Extras: taxas condicionais e estadia
  extras?: {
    waitingTimeCost?: number;
    waitingTimeHours?: number;
    waitingTimeEnabled?: boolean;
    conditionalFees?: {
      ids: string[];
      total: number;
      breakdown?: Record<string, number>;
    };
    /** Itens de carga/descarga (tabela unloading_cost_rates) para persistir em meta */
    unloadingCostItems?: Array<{
      id: string;
      name: string;
      code: string;
      quantity: number;
      unitValue: number;
      total: number;
    }>;
    /** Itens de aluguel de máquinas (tabela equipment_rental_rates) para persistir em meta */
    equipmentRentalItems?: Array<{
      id: string;
      name: string;
      code: string;
      selected: boolean;
      quantity: number;
      unitValue: number;
      total: number;
    }>;
  };

  // Legacy overrides (backwards compat, pricingParams takes precedence)
  dasPercent?: number;
  markupPercent?: number;
  overheadPercent?: number;
  carreteiroPercent?: number;
  descargaValue?: number;
}

// ============================================
// TYPES - OUTPUT
// ============================================

export interface FreightCalculationOutput {
  status: 'OK' | 'OUT_OF_RANGE' | 'MISSING_DATA';
  error?: string;

  meta: {
    routeUfLabel: string | null;
    kmBandLabel: string | null;
    kmStatus: 'OK' | 'OUT_OF_RANGE';
    marginStatus: 'ABOVE_TARGET' | 'BELOW_TARGET' | 'AT_TARGET' | 'UNKNOWN';
    marginPercent: number;
    cubageFactor: number;
    cubageWeightKg: number;
    billableWeightKg: number;
    /** KM inteiro usado no cálculo (paridade com backend km_band_used) */
    kmBandUsed?: number;
  };

  components: {
    baseCost: number;
    baseFreight: number;
    toll: number;
    aluguelMaquinas: number;
    gris: number;
    tso: number;
    rctrc: number;
    adValorem: number;
    tde: number;
    tear: number;
    dispatchFee: number;
    conditionalFeesTotal: number;
    waitingTimeCost: number;
    dasProvision: number;
  };

  rates: {
    dasPercent: number;
    icmsPercent: number;
    grisPercent: number;
    tsoPercent: number;
    costValuePercent: number;
    markupPercent: number;
    overheadPercent: number;
    targetMarginPercent: number;
    markupScope: MarkupScope;
  };

  totals: {
    receitaBruta: number;
    das: number;
    icms: number;
    totalImpostos: number;
    totalCliente: number;
  };

  profitability: {
    custosCarreteiro: number;
    custosDescarga: number;
    custosDiretos: number;
    margemBruta: number;
    overhead: number;
    resultadoLiquido: number;
    margemPercent: number;
  };

  conditionalFeesBreakdown: Record<string, number>;
}

// ============================================
// STORED BREAKDOWN (para salvar em JSONB)
// ============================================

export interface TollPlaza {
  nome: string;
  cidade: string;
  uf: string;
  valor: number;
  valorTag: number;
  ordemPassagem: number;
}

export interface StoredPricingBreakdown {
  calculatedAt: string;
  version: string;
  status: 'OK' | 'OUT_OF_RANGE' | 'MISSING_DATA';
  error?: string;

  meta: {
    routeUfLabel: string | null;
    kmBandLabel: string | null;
    kmStatus: 'OK' | 'OUT_OF_RANGE';
    marginStatus: 'ABOVE_TARGET' | 'BELOW_TARGET' | 'AT_TARGET' | 'UNKNOWN';
    marginPercent: number;
    kmBandUsed?: number;
    inputWeightUnit?: 'kg' | 'ton';
    selectedConditionalFeeIds?: string[];
    waitingTimeEnabled?: boolean;
    waitingTimeHours?: number;
    markupScope?: MarkupScope;

    // Praças de pedágio retornadas pelo WebRouter
    tollPlazas?: TollPlaza[];

    /** Itens de carga/descarga (tabela) para herança na OS */
    unloadingCost?: Array<{
      id: string;
      name: string;
      code: string;
      quantity: number;
      unitValue: number;
      total: number;
    }>;
    /** Itens de aluguel de máquinas (tabela) para herança na OS */
    equipmentRental?: Array<{
      id: string;
      name: string;
      code: string;
      selected: boolean;
      quantity: number;
      unitValue: number;
      total: number;
    }>;
    // ANTT piso mínimo (memória de cálculo) - opcional
    antt?: {
      operationTable: 'A' | 'B' | 'C' | 'D';
      cargoType: string;
      axesCount: number;
      kmDistance: number;
      ccd: number;
      cc: number;
      ida: number;
      retornoVazio: number;
      total: number;
      calculatedAt: string;
    };
  };

  weights: {
    cubageWeight: number;
    billableWeight: number;
    tonBillable: number;
  };

  components: {
    baseCost: number;
    baseFreight: number;
    toll: number;
    aluguelMaquinas: number;
    gris: number;
    tso: number;
    rctrc: number;
    adValorem: number;
    tde: number;
    tear: number;
    dispatchFee: number;
    conditionalFeesTotal: number;
    waitingTimeCost: number;
    dasProvision: number;
  };

  totals: {
    receitaBruta: number;
    das: number;
    icms: number;
    totalImpostos: number;
    totalCliente: number;
  };

  profitability: {
    custosCarreteiro: number;
    custosDescarga: number;
    custosDiretos: number;
    margemBruta: number;
    overhead: number;
    resultadoLiquido: number;
    margemPercent: number;
  };

  rates: {
    dasPercent: number;
    icmsPercent: number;
    grisPercent: number;
    tsoPercent: number;
    costValuePercent: number;
    markupPercent: number;
    overheadPercent: number;
    targetMarginPercent: number;
  };

  conditionalFeesBreakdown?: Record<string, number>;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const CEP_UF_RANGES = [
  { uf: 'SP', min: 1000000, max: 19999999 },
  { uf: 'RJ', min: 20000000, max: 28999999 },
  { uf: 'ES', min: 29000000, max: 29999999 },
  { uf: 'MG', min: 30000000, max: 39999999 },
  { uf: 'BA', min: 40000000, max: 48999999 },
  { uf: 'SE', min: 49000000, max: 49999999 },
  { uf: 'PE', min: 50000000, max: 56999999 },
  { uf: 'AL', min: 57000000, max: 57999999 },
  { uf: 'PB', min: 58000000, max: 58999999 },
  { uf: 'RN', min: 59000000, max: 59999999 },
  { uf: 'CE', min: 60000000, max: 63999999 },
  { uf: 'PI', min: 64000000, max: 64999999 },
  { uf: 'MA', min: 65000000, max: 65999999 },
  { uf: 'PA', min: 66000000, max: 68899999 },
  { uf: 'AP', min: 68900000, max: 68999999 },
  { uf: 'AM', min: 69000000, max: 69299999 },
  { uf: 'RR', min: 69300000, max: 69399999 },
  { uf: 'AM', min: 69400000, max: 69899999 },
  { uf: 'AC', min: 69900000, max: 69999999 },
  { uf: 'DF', min: 70000000, max: 72799999 },
  { uf: 'GO', min: 72800000, max: 76799999 },
  { uf: 'RO', min: 76800000, max: 76999999 },
  { uf: 'TO', min: 77000000, max: 77999999 },
  { uf: 'MT', min: 78000000, max: 78899999 },
  { uf: 'MS', min: 79000000, max: 79999999 },
  { uf: 'PR', min: 80000000, max: 87999999 },
  { uf: 'SC', min: 88000000, max: 89999999 },
  { uf: 'RS', min: 90000000, max: 99999999 },
] as const;

/** Extrai UF a partir de CEP de 8 digitos usando faixas dos Correios. */
export function ufFromCep(cep: string | number | null | undefined): string | null {
  if (!cep) return null;
  const clean = String(cep).replace(/\D/g, '');
  if (clean.length !== 8) return null;
  const num = Number.parseInt(clean, 10);
  const found = CEP_UF_RANGES.find((range) => num >= range.min && num <= range.max);
  return found ? found.uf : null;
}

export function extractUf(location: string): string | null {
  if (!location) return null;
  const match = location.match(/[,-]\s*([A-Z]{2})\s*$/i);
  if (match) return match[1].toUpperCase();
  const trimmed = location.trim();
  const lastTwo = trimmed.slice(-2);
  if (/^[A-Z]{2}$/i.test(lastTwo)) return lastTwo.toUpperCase();
  return null;
}

export function formatRouteUf(origin: string, destination: string): string | null {
  const originUf = extractUf(origin);
  const destUf = extractUf(destination);
  if (originUf && destUf) return `${originUf}→${destUf}`;
  return null;
}

export function normalizeIcmsRate(rate: number): number {
  if (rate === 0) return 0;
  if (rate >= 3 && rate <= 25) return rate;
  if (rate > 0 && rate < 1) {
    const times100 = rate * 100;
    if (times100 >= 3 && times100 <= 25) return times100;
    const times10 = rate * 10;
    if (times10 >= 3 && times10 <= 25) return times10;
  }
  if (rate >= 1 && rate < 3) {
    const times10 = rate * 10;
    if (times10 >= 3 && times10 <= 25) return times10;
  }
  if (rate > 25 && rate <= 250) {
    const divided = rate / 10;
    if (divided >= 3 && divided <= 25) return divided;
  }
  return rate;
}

// ============================================
// RESOLVE PARAMS (merge pricingParams + legacy)
// ============================================

function resolveParams(input: FreightCalculationInput) {
  const pp = input.pricingParams;
  return {
    cubageFactor: pp?.cubageFactor ?? FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3,
    dasPercent: pp?.dasPercent ?? input.dasPercent ?? FREIGHT_CONSTANTS.DEFAULT_DAS_PERCENT,
    dasProvisionMinValue: pp?.dasProvisionMinValue ?? 0,
    taxRegimeSimples: pp?.taxRegimeSimples ?? 1,
    markupPercent:
      pp?.markupPercent ?? input.markupPercent ?? FREIGHT_CONSTANTS.DEFAULT_MARKUP_PERCENT,
    overheadPercent:
      pp?.overheadPercent ?? input.overheadPercent ?? FREIGHT_CONSTANTS.DEFAULT_OVERHEAD_PERCENT,
    targetMarginPercent: pp?.targetMarginPercent ?? FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT,
    markupScope: pp?.markupScope ?? ('BASE_ONLY' as MarkupScope),
  };
}

function resolveDirectCosts(input: FreightCalculationInput, receitaBruta: number) {
  const dc = input.directCosts;
  // Carreteiro: prefer fixed value, fallback to percent
  let carreteiroValue = dc?.carreteiroValue ?? 0;
  if (carreteiroValue === 0) {
    const pct = dc?.carreteiroPercent ?? input.carreteiroPercent ?? 0;
    carreteiroValue = round2(receitaBruta * (pct / 100));
  }
  const descargaValue = dc?.descargaValue ?? input.descargaValue ?? 0;
  return { carreteiroValue: round2(carreteiroValue), descargaValue: round2(descargaValue) };
}

// ============================================
// LTL WEIGHT COLUMN HELPER
// ============================================

function getLtlWeightColumn(weightKg: number): string | null {
  if (weightKg <= 10) return 'weight_rate_10';
  if (weightKg <= 20) return 'weight_rate_20';
  if (weightKg <= 30) return 'weight_rate_30';
  if (weightKg <= 50) return 'weight_rate_50';
  if (weightKg <= 70) return 'weight_rate_70';
  if (weightKg <= 100) return 'weight_rate_100';
  if (weightKg <= 150) return 'weight_rate_150';
  if (weightKg <= 200) return 'weight_rate_200';
  return null; // acima de 200 kg → usa weight_rate_above_200 × kg
}

// ============================================
// MAIN CALCULATION FUNCTION
// ============================================

export function calculateFreight(input: FreightCalculationInput): FreightCalculationOutput {
  const params = resolveParams(input);
  let icmsPercent = normalizeIcmsRate(input.icmsRatePercent);
  // Simples Nacional: ICMS não incide (linha visível 0% / R$ 0,00)
  if (params.taxRegimeSimples === 1) icmsPercent = 0;
  const kmBandUsed = Math.round(Number(input.kmDistance || 0));

  // Empty result factory
  const makeEmpty = (
    status: 'MISSING_DATA' | 'OUT_OF_RANGE',
    error: string
  ): FreightCalculationOutput => ({
    status,
    error,
    meta: {
      routeUfLabel: formatRouteUf(input.originCity, input.destinationCity),
      kmBandLabel: null,
      kmStatus: status === 'OUT_OF_RANGE' ? 'OUT_OF_RANGE' : 'OK',
      marginStatus: 'AT_TARGET',
      marginPercent: 0,
      cubageFactor: params.cubageFactor,
      cubageWeightKg: 0,
      billableWeightKg: 0,
      kmBandUsed,
    },
    components: {
      baseCost: 0,
      baseFreight: 0,
      toll: 0,
      gris: 0,
      tso: 0,
      rctrc: 0,
      adValorem: 0,
      tde: 0,
      tear: 0,
      dispatchFee: 0,
      conditionalFeesTotal: 0,
      waitingTimeCost: 0,
      dasProvision: 0,
    },
    rates: {
      dasPercent: params.dasPercent,
      icmsPercent,
      grisPercent: 0,
      tsoPercent: 0,
      costValuePercent: 0,
      markupPercent: params.markupPercent,
      overheadPercent: params.overheadPercent,
      targetMarginPercent: params.targetMarginPercent,
      markupScope: params.markupScope,
    },
    totals: { receitaBruta: 0, das: 0, icms: 0, totalImpostos: 0, totalCliente: 0 },
    profitability: {
      custosCarreteiro: 0,
      custosDescarga: 0,
      custosDiretos: 0,
      margemBruta: 0,
      overhead: 0,
      resultadoLiquido: 0,
      margemPercent: 0,
    },
    conditionalFeesBreakdown: {},
  });

  // ---- VALIDATION ----
  if (!input.priceTableRow) {
    // Distinguish MISSING_DATA vs OUT_OF_RANGE
    if (input.priceTableId && kmBandUsed > 0) {
      return makeEmpty(
        'OUT_OF_RANGE',
        `Distância ${kmBandUsed} km não encontrou faixa na tabela selecionada`
      );
    }
    return makeEmpty('MISSING_DATA', 'Tabela de preços não selecionada');
  }

  const row = input.priceTableRow;
  const kmFrom = Number(row.km_from);
  const kmTo = Number(row.km_to);

  if (kmBandUsed < kmFrom || kmBandUsed > kmTo) {
    const r = makeEmpty(
      'OUT_OF_RANGE',
      `Distância ${kmBandUsed} km fora da faixa ${kmFrom}-${kmTo} km`
    );
    r.meta.kmBandLabel = `${kmFrom}-${kmTo}`;
    return r;
  }

  // ---- STEP 1: PESO FATURÁVEL ----
  const cubageWeightKg = round2(input.volumeM3 * params.cubageFactor);
  const billableWeightKg = Math.max(input.weightKg, cubageWeightKg);

  // ---- STEP 2: BASE COST (branch por modalidade) ----
  const isLtl = input.modality === 'fracionado';
  let baseCost: number;
  let dispatchFee = 0;

  if (isLtl) {
    // NTC Fracionado (LTL): R$/kg × peso em todas as faixas (proporcional)
    const weightCol = getLtlWeightColumn(billableWeightKg);
    if (weightCol) {
      // ≤ 200 kg: peso × R$/kg da faixa
      const ratePerKg = Number((row as Record<string, unknown>)[weightCol]) || 0;
      baseCost = round2(billableWeightKg * ratePerKg);
    } else {
      // > 200 kg: peso × R$/kg
      const ratePerKg = Number((row as Record<string, unknown>).weight_rate_above_200) || 0;
      baseCost = round2(billableWeightKg * ratePerKg);
    }
    dispatchFee = input.ltlParams?.dispatchFee ?? 102.9;
  } else {
    // Lotação (FTL): cost_per_ton → cost_per_kg fallback
    const costPerTon = Number(row.cost_per_ton) || 0;
    const costPerKg = Number(row.cost_per_kg) || 0;
    baseCost =
      costPerTon > 0
        ? round2((billableWeightKg / 1000) * costPerTon)
        : round2(billableWeightKg * costPerKg);
  }

  // ---- STEP 3: COMPONENTES PERCENTUAIS SOBRE VALOR DA CARGA ----
  let grisPercent: number;
  const tsoPercent = Number(row.tso_percent) || 0;
  const costValuePercent = Number(row.cost_value_percent) || 0;

  if (isLtl && input.ltlParams) {
    // Fracionado: GRIS vem de ltl_parameters
    grisPercent = input.ltlParams.grisPercent;
  } else {
    grisPercent = Number(row.gris_percent) || 0;
  }

  let gris = round2(input.cargoValue * (grisPercent / 100));
  let tso = round2(input.cargoValue * (tsoPercent / 100));
  const rctrc = round2(input.cargoValue * (costValuePercent / 100));

  // Fracionado: aplicar mínimos NTC
  if (isLtl && input.ltlParams) {
    if (input.cargoValue <= input.ltlParams.grisMinCargoLimit && gris < input.ltlParams.grisMin) {
      gris = input.ltlParams.grisMin;
    }
    if (tso < input.ltlParams.minTso) {
      tso = input.ltlParams.minTso;
    }
  }

  // ---- STEP 4: MARKUP (com escopo configurável) ----
  let markupBase = baseCost;
  if (params.markupScope === 'BASE_PLUS_INSURANCE') {
    markupBase = baseCost + tso + rctrc;
  } else if (params.markupScope === 'ALL_PERCENT_COMPONENTS') {
    markupBase = baseCost + gris + tso + rctrc;
  }
  const baseFreight = isLtl
    ? baseCost // Fracionado: sem markup sobre frete peso (NTC referência)
    : round2(markupBase * (1 + params.markupPercent / 100));

  // ---- STEP 5: TAXAS NTC (20% sobre baseFreight) ----
  const tde = input.tdeEnabled
    ? round2(baseFreight * (FREIGHT_CONSTANTS.NTC_TDE_PERCENT / 100))
    : 0;
  const tear = input.tearEnabled
    ? round2(baseFreight * (FREIGHT_CONSTANTS.NTC_TEAR_PERCENT / 100))
    : 0;

  // ---- STEP 6: EXTRAS ----
  const conditionalFeesTotal = round2(input.extras?.conditionalFees?.total ?? 0);
  const waitingTimeCost = round2(input.extras?.waitingTimeCost ?? 0);

  // ---- STEP 7: RECEITA BRUTA ----
  const aluguelMaquinas = round2(input.aluguelMaquinasValue ?? 0);
  const receitaBruta = round2(
    baseFreight +
      input.tollValue +
      aluguelMaquinas +
      gris +
      tso +
      rctrc +
      0 + // adValorem always 0
      tde +
      tear +
      dispatchFee +
      conditionalFeesTotal +
      waitingTimeCost
  );

  // ---- STEP 8: IMPOSTOS POR FORA (provisão DAS com mínimo) ----
  const dasProvision = round2(
    Math.max(receitaBruta * (params.dasPercent / 100), params.dasProvisionMinValue)
  );
  const das = dasProvision;
  const icms = round2(receitaBruta * (icmsPercent / 100));
  const totalImpostos = round2(das + icms);
  const totalCliente = round2(receitaBruta + totalImpostos);

  // ---- STEP 9: RENTABILIDADE ----
  const { carreteiroValue, descargaValue } = resolveDirectCosts(input, receitaBruta);
  const custosDiretos = round2(carreteiroValue + descargaValue);
  const margemBruta = round2(receitaBruta - totalImpostos - custosDiretos);
  const overhead = round2(margemBruta * (params.overheadPercent / 100));
  const resultadoLiquido = round2(margemBruta - overhead);
  const margemPercent = receitaBruta > 0 ? round2((resultadoLiquido / receitaBruta) * 100) : 0;

  // ---- STEP 10: META STATUS ----
  let marginStatus: 'ABOVE_TARGET' | 'BELOW_TARGET' | 'AT_TARGET' = 'AT_TARGET';
  if (margemPercent > params.targetMarginPercent) marginStatus = 'ABOVE_TARGET';
  else if (margemPercent < params.targetMarginPercent) marginStatus = 'BELOW_TARGET';

  return {
    status: 'OK',
    meta: {
      routeUfLabel: formatRouteUf(input.originCity, input.destinationCity),
      kmBandLabel: `${kmFrom}-${kmTo}`,
      kmStatus: 'OK',
      marginStatus,
      marginPercent: margemPercent,
      cubageFactor: params.cubageFactor,
      cubageWeightKg,
      billableWeightKg,
      kmBandUsed,
    },
    components: {
      baseCost,
      baseFreight,
      toll: round2(input.tollValue),
      aluguelMaquinas,
      gris,
      tso,
      rctrc,
      adValorem: 0,
      tde,
      tear,
      dispatchFee,
      conditionalFeesTotal,
      waitingTimeCost,
      dasProvision,
    },
    rates: {
      dasPercent: params.dasPercent,
      icmsPercent,
      grisPercent,
      tsoPercent,
      costValuePercent,
      markupPercent: params.markupPercent,
      overheadPercent: params.overheadPercent,
      targetMarginPercent: params.targetMarginPercent,
      markupScope: params.markupScope,
    },
    totals: { receitaBruta, das, icms, totalImpostos, totalCliente },
    profitability: {
      custosCarreteiro: carreteiroValue,
      custosDescarga: descargaValue,
      custosDiretos,
      margemBruta,
      overhead,
      resultadoLiquido,
      margemPercent,
    },
    conditionalFeesBreakdown: input.extras?.conditionalFees?.breakdown ?? {},
  };
}

// ============================================
// BUILDER: Stored Breakdown (para salvar em DB)
// ============================================

export function buildStoredBreakdown(
  output: FreightCalculationOutput,
  input: FreightCalculationInput
): StoredPricingBreakdown {
  return {
    calculatedAt: new Date().toISOString(),
    version: '4.0-fob-lotacao-markup-scope',
    status: output.status,
    error: output.error,

    meta: {
      routeUfLabel: output.meta.routeUfLabel,
      kmBandLabel: output.meta.kmBandLabel,
      kmStatus: output.meta.kmStatus,
      marginStatus: output.meta.marginStatus,
      marginPercent: output.meta.marginPercent,
      kmBandUsed: output.meta.kmBandUsed,
      selectedConditionalFeeIds: input.extras?.conditionalFees?.ids,
      waitingTimeEnabled: input.extras?.waitingTimeEnabled,
      waitingTimeHours: input.extras?.waitingTimeHours,
      markupScope: output.rates.markupScope,
      unloadingCost: input.extras?.unloadingCostItems,
      equipmentRental: input.extras?.equipmentRentalItems,
    },

    weights: {
      cubageWeight: output.meta.cubageWeightKg,
      billableWeight: output.meta.billableWeightKg,
      tonBillable: round2(output.meta.billableWeightKg / 1000),
    },

    components: {
      baseCost: output.components.baseCost,
      baseFreight: output.components.baseFreight,
      toll: output.components.toll,
      aluguelMaquinas: output.components.aluguelMaquinas,
      gris: output.components.gris,
      tso: output.components.tso,
      rctrc: output.components.rctrc,
      adValorem: output.components.adValorem,
      tde: output.components.tde,
      tear: output.components.tear,
      dispatchFee: output.components.dispatchFee,
      conditionalFeesTotal: output.components.conditionalFeesTotal,
      waitingTimeCost: output.components.waitingTimeCost,
      dasProvision: output.components.dasProvision,
    },

    totals: { ...output.totals },
    profitability: { ...output.profitability },

    rates: {
      dasPercent: output.rates.dasPercent,
      icmsPercent: output.rates.icmsPercent,
      grisPercent: output.rates.grisPercent,
      tsoPercent: output.rates.tsoPercent,
      costValuePercent: output.rates.costValuePercent,
      markupPercent: output.rates.markupPercent,
      overheadPercent: output.rates.overheadPercent,
      targetMarginPercent: output.rates.targetMarginPercent,
    },

    conditionalFeesBreakdown:
      Object.keys(output.conditionalFeesBreakdown).length > 0
        ? output.conditionalFeesBreakdown
        : undefined,
  };
}
