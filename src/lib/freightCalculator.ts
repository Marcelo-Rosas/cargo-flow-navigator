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

  /** Piso ANTT carreteiro (R$). Quando fornecido, em lotação o custo motorista = MAX(frete_peso, pisoAntt). */
  pisoAnttCarreteiro?: number;

  // Alíquota ICMS (já normalizada em %). Ignorada quando kmByUf + icmsByUf presentes.
  icmsRatePercent: number;

  /** KM percorrido por UF (ex: { SP: 120, MG: 80 }). Quando presente, usa ICMS proporcional. */
  kmByUf?: Record<string, number>;

  /** Alíquota ICMS por UF em % (ex: { SP: 18, MG: 18 }). Usado com kmByUf. */
  icmsByUf?: Record<string, number>;

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
    /** Margem de lucro alvo (%) para Gross-up. Default 15. */
    profitMarginPercent?: number;
    /** Regime Simples Nacional (ICMS na DAS). Default true. */
    regimeSimplesNacional?: boolean;
    /** Excesso de Sublimite (ICMS separado). Default false. */
    excessoSublimite?: boolean;
    markupScope?: MarkupScope;
    tdePercent?: number;
    tearPercent?: number;
    grisPercent?: number;
    tsoPercent?: number;
    costValuePercent?: number;
    /** Ad Valorem Lotação (%). Substitui GRIS/TSO para FTL. Default 0.03 (RCTR-C + RC-DC). */
    adValoremLotacaoPercent?: number;
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
    /** Itens de carga/descarga (Central de Regras) para persistir em meta */
    unloadingCostItems?: Array<{
      id: string;
      name: string;
      code: string;
      quantity: number;
      unitValue: number;
      total: number;
    }>;
    /** Itens de aluguel de máquinas (Central de Regras) para persistir em meta */
    equipmentRentalItems?: Array<{
      id: string;
      name: string;
      code: string;
      selected: boolean;
      quantity: number;
      unitValue: number;
      total: number;
      description?: string;
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
    /** Breakdown de ICMS por UF (R$). Preenchido quando kmByUf + icmsByUf são usados. */
    icmsBreakdownByUf?: Record<string, number>;
    /** Trava 1t aplicada no fracionado (peso real < 1000 kg) */
    ltlMinWeightApplied?: boolean;
    /** Peso real informado (antes da trava 1t) */
    originalWeightKg?: number;
    /** MP 1.343/2026: Piso ANTT foi aplicado como custo motorista (lotação) */
    anttFloorApplied?: boolean;
    /** Frete peso original da tabela (antes do piso ANTT) */
    fretePesoOriginal?: number;
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
    profitMarginPercent: number;
    adValoremPercent: number;
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
    custoMotorista: number;
    custosCarreteiro: number;
    custosDescarga: number;
    custoServicos: number;
    custosDiretos: number;
    receitaLiquida: number;
    margemBruta: number;
    overhead: number;
    resultadoLiquido: number;
    margemPercent: number;
    profitMarginTarget: number;
    regimeFiscal: 'simples_nacional' | 'excesso_sublimite' | 'normal';
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

    /** KM por UF (para restauração e recálculo ICMS proporcional) */
    kmByUf?: Record<string, number>;

    /** Trava 1t aplicada no fracionado */
    ltlMinWeightApplied?: boolean;
    /** Peso real informado (antes da trava 1t) */
    originalWeightKg?: number;
    regimeSimplesNacional?: boolean;
    excessoSublimite?: boolean;

    /** Modo de cálculo ICMS: 'A' = alíquota fixa, 'B' = proporcional por UF */
    icmsMode?: 'A' | 'B';

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
      description?: string;
    }>;
    /** MP 1.343/2026: Piso ANTT foi aplicado como custo motorista (lotação) */
    anttFloorApplied?: boolean;
    /** Frete peso original da tabela de preços (antes do piso ANTT) */
    fretePesoOriginal?: number;

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
    tacAdjustment?: number;
    paymentAdjustment?: number;
    totalImpostos: number;
    totalCliente: number;
    /** Desconto comercial aplicado (R$). totalClienteFinal = totalCliente - discount */
    discount?: number;
  };

  profitability: {
    custoMotorista?: number;
    custosCarreteiro: number;
    custosDescarga: number;
    custoServicos?: number;
    custosDiretos: number;
    receitaLiquida?: number;
    margemBruta: number;
    overhead: number;
    resultadoLiquido: number;
    margemPercent: number;
    profitMarginTarget?: number;
    regimeFiscal?: 'simples_nacional' | 'excesso_sublimite' | 'normal';
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
    profitMarginPercent?: number;
    adValoremPercent?: number;
  };

  conditionalFeesBreakdown?: Record<string, number>;

  /** v5: Risk costs estimated by evaluate-risk Edge function */
  riskCosts?: {
    items: Array<{ code: string; name: string; cost: number }>;
    total: number;
    criticality?: string;
  };

  /** v5: Risk pass-through revenue (cobrados do cliente, repassados à seguradora) */
  riskPassThrough?: {
    gris: number;
    tso: number;
    rctrc: number;
    /** Lotação: Ad Valorem (substitui GRIS/TSO) */
    adValorem?: number;
    total: number;
  };
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
    profitMarginPercent: pp?.profitMarginPercent ?? FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT,
    regimeSimplesNacional: pp?.regimeSimplesNacional ?? true,
    excessoSublimite: pp?.excessoSublimite ?? false,
    markupScope: pp?.markupScope ?? ('BASE_ONLY' as MarkupScope),
    tdePercent: pp?.tdePercent ?? FREIGHT_CONSTANTS.NTC_TDE_PERCENT,
    tearPercent: pp?.tearPercent ?? FREIGHT_CONSTANTS.NTC_TEAR_PERCENT,
    grisPercent: pp?.grisPercent ?? 0.3,
    tsoPercent: pp?.tsoPercent ?? 0.15,
    costValuePercent: pp?.costValuePercent ?? 0.3,
    /** Ad Valorem Lotação: substitui GRIS/TSO para FTL. Default 0.03% (RCTR-C 0,015% + RC-DC 0,015%). */
    adValoremLotacaoPercent: pp?.adValoremLotacaoPercent ?? 0.03,
  };
}

/** Regime fiscal para Gross-up */
export type RegimeFiscal = 'simples_nacional' | 'excesso_sublimite' | 'normal';

/**
 * Calcula Total Cliente via Gross-up Híbrido (Asset-Light).
 * Simples: divisor = 1 - (Overhead% + DAS% + Lucro%)/100, ICMS=0.
 * Sublimite: divisor = 1 - (Overhead% + DAS% + ICMS% + Lucro%)/100.
 */
function calculateGrossUpHibrido(
  custosDiretos: number,
  overheadPercent: number,
  dasPercent: number,
  profitMarginPercent: number,
  icmsPercent: number,
  regimeSimples: boolean,
  excessoSublimite: boolean
): {
  totalCliente: number;
  receitaBruta: number;
  das: number;
  icms: number;
  regimeFiscal: RegimeFiscal;
} {
  let regimeFiscal: RegimeFiscal;
  let icmsNoDivisor: boolean;

  if (regimeSimples && !excessoSublimite) {
    regimeFiscal = 'simples_nacional';
    icmsNoDivisor = false;
  } else if (regimeSimples && excessoSublimite) {
    regimeFiscal = 'excesso_sublimite';
    icmsNoDivisor = true;
  } else {
    regimeFiscal = 'normal';
    icmsNoDivisor = true;
  }

  const taxaBruta = icmsNoDivisor
    ? (overheadPercent + dasPercent + icmsPercent + profitMarginPercent) / 100
    : (overheadPercent + dasPercent + profitMarginPercent) / 100;

  if (taxaBruta >= 1) {
    throw new Error(
      `Soma de Overhead (${overheadPercent}%) + DAS (${dasPercent}%) + ` +
        `${icmsNoDivisor ? `ICMS (${icmsPercent}%) + ` : ''}` +
        `Lucro (${profitMarginPercent}%) não pode ser >= 100%`
    );
  }

  const totalCliente = round2(custosDiretos / (1 - taxaBruta));
  const das = round2(totalCliente * (dasPercent / 100));
  const icms = regimeFiscal === 'simples_nacional' ? 0 : round2(totalCliente * (icmsPercent / 100));
  const receitaBruta = round2(totalCliente - das - icms);

  return { totalCliente, receitaBruta, das, icms, regimeFiscal };
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
// ICMS BASE CALCULATION
// ============================================

/**
 * Calcula a base e o valor de ICMS a partir do breakdown armazenado.
 * Mode A: alíquota fixa (rates.icmsPercent).
 * Mode B: proporcional por UF (meta.kmByUf + rates por UF).
 * Default: mode A.
 */
export function calcularBaseICMS(breakdown: StoredPricingBreakdown): {
  mode: 'A' | 'B';
  icmsPercent: number;
  icmsValue: number;
  baseCalculo: number;
} {
  const mode = breakdown.meta?.icmsMode ?? 'A';
  const totalCliente = breakdown.totals?.totalCliente ?? 0;
  const icmsPercent = breakdown.rates?.icmsPercent ?? 0;
  const icmsValue = breakdown.totals?.icms ?? 0;

  return {
    mode,
    icmsPercent,
    icmsValue,
    baseCalculo: totalCliente,
  };
}

// ============================================
// MAIN CALCULATION FUNCTION
// ============================================

export function calculateFreight(input: FreightCalculationInput): FreightCalculationOutput {
  const params = resolveParams(input);
  let icmsPercent = normalizeIcmsRate(input.icmsRatePercent);
  // Simples Nacional sem excesso: ICMS na DAS (não incide separadamente)
  if (params.regimeSimplesNacional && !params.excessoSublimite) {
    icmsPercent = 0;
  }
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
      aluguelMaquinas: 0,
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
      profitMarginPercent: 0,
      adValoremPercent: 0,
    },
    totals: { receitaBruta: 0, das: 0, icms: 0, totalImpostos: 0, totalCliente: 0 },
    profitability: {
      custoMotorista: 0,
      custosCarreteiro: 0,
      custosDescarga: 0,
      custoServicos: 0,
      custosDiretos: 0,
      receitaLiquida: 0,
      margemBruta: 0,
      overhead: 0,
      resultadoLiquido: 0,
      margemPercent: 0,
      profitMarginTarget: 0,
      regimeFiscal: 'simples_nacional' as const,
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
  let billableWeightKg = Math.max(input.weightKg, cubageWeightKg);

  // Trava Fracionado: mínimo 1.000 kg para viabilidade
  const ltlMinWeightApplied = input.modality === 'fracionado' && billableWeightKg < 1000;
  if (ltlMinWeightApplied) {
    billableWeightKg = 1000;
  }
  const originalWeightKg = input.weightKg;

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
  const toFiniteNumber = (value: unknown): number | undefined => {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  };
  const centralGrisPercent = toFiniteNumber(params.grisPercent);
  const centralTsoPercent = toFiniteNumber(params.tsoPercent);
  const centralCostValuePercent = toFiniteNumber(params.costValuePercent);
  const rowGrisPercent = toFiniteNumber(row.gris_percent);
  const rowTsoPercent = toFiniteNumber(row.tso_percent);
  const rowCostValuePercent = toFiniteNumber(row.cost_value_percent);

  let grisPercent: number;
  let tsoPercent: number;
  const costValuePercent = centralCostValuePercent ?? rowCostValuePercent ?? 0.3;

  // Ad Valorem para Lotação: substitui GRIS/TSO como componente único de custo de risco
  let adValorem = 0;
  let adValoremPercent = 0;

  if (!isLtl) {
    // LOTAÇÃO: Ad Valorem cobre seguro (RCTR-C + RC-DC) + custos GR
    adValoremPercent = params.adValoremLotacaoPercent;
    adValorem = round2(input.cargoValue * (adValoremPercent / 100));
    // Lotação: GRIS e TSO zerados (cobertos pelo Ad Valorem)
    grisPercent = 0;
    tsoPercent = 0;
  } else {
    // FRACIONADO: mantém GRIS/TSO com percentuais NTC de mercado
    tsoPercent = centralTsoPercent ?? rowTsoPercent ?? 0.15;
    if (input.ltlParams) {
      grisPercent =
        centralGrisPercent ?? rowGrisPercent ?? toFiniteNumber(input.ltlParams.grisPercent) ?? 0.3;
    } else {
      grisPercent = centralGrisPercent ?? rowGrisPercent ?? 0.3;
    }
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

  // ---- STEP 5: TAXAS NTC (TDE/TEAR desativadas no cálculo) ----
  // Mantidas apenas para compatibilidade de tipos, mas o motor financeiro 360°
  // não aplica mais TDE/TEAR como taxas NTC — elas são representadas via
  // conditional_fees (TEAR/TPD) conforme seleção do usuário.
  const tde = 0;
  const tear = 0;

  // ---- STEP 6: EXTRAS ----
  const conditionalFeesTotal = round2(input.extras?.conditionalFees?.total ?? 0);
  const waitingTimeCost = round2(input.extras?.waitingTimeCost ?? 0);

  // ---- STEP 7: CUSTOS DIRETOS (Asset-Light) ----
  // MP 1.343/2026: em lotação, custo motorista não pode ser inferior ao Piso ANTT
  const pisoAntt = input.pisoAnttCarreteiro ?? 0;
  const anttFloorApplied = !isLtl && pisoAntt > 0 && pisoAntt > baseCost;
  const custoMotorista = anttFloorApplied ? pisoAntt : baseCost;
  const aluguelMaquinas = round2(input.aluguelMaquinasValue ?? 0);
  const custoServicos = round2(
    input.tollValue +
      aluguelMaquinas +
      adValorem + // Lotação: custo risco (seguro + GR); Fracionado: 0
      gris +
      tso +
      rctrc +
      dispatchFee +
      conditionalFeesTotal +
      waitingTimeCost
  );
  const { descargaValue } = resolveDirectCosts(input, 0);
  const custosDiretos = round2(custoMotorista + custoServicos + descargaValue);

  // ICMS percent médio (proporcional por UF quando kmByUf + icmsByUf)
  let icmsPercentForGrossUp = icmsPercent;
  if (
    input.kmByUf &&
    Object.keys(input.kmByUf).length > 0 &&
    input.icmsByUf &&
    Object.keys(input.icmsByUf).length > 0
  ) {
    const totalKm = Object.values(input.kmByUf).reduce((a, b) => a + b, 0);
    if (totalKm > 0) {
      icmsPercentForGrossUp = round2(
        Object.entries(input.kmByUf).reduce((sum, [uf, km]) => {
          const pct = input.icmsByUf?.[uf] ?? icmsPercent;
          return sum + (km / totalKm) * pct;
        }, 0)
      );
    }
  }

  // ---- STEP 8: GROSS-UP HÍBRIDO (Asset-Light) ----
  const profitMarginPercent = params.profitMarginPercent ?? FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT;
  const regimeSimples = params.regimeSimplesNacional ?? true;
  const excessoSublimite = params.excessoSublimite ?? false;

  const { totalCliente, das, icms, regimeFiscal } = calculateGrossUpHibrido(
    custosDiretos,
    params.overheadPercent,
    params.dasPercent,
    profitMarginPercent,
    icmsPercentForGrossUp,
    regimeSimples,
    excessoSublimite
  );

  // receitaBruta = totalCliente (gross revenue); receitaLiquida = totalCliente - impostos
  const totalImpostos = round2(das + icms);
  const receitaLiquida = round2(totalCliente - totalImpostos);

  // ICMS breakdown por UF (para exibição)
  let icmsBreakdownByUf: Record<string, number> | undefined;
  if (
    regimeFiscal !== 'simples_nacional' &&
    input.kmByUf &&
    Object.keys(input.kmByUf).length > 0 &&
    icms > 0
  ) {
    const totalKm = Object.values(input.kmByUf).reduce((a, b) => a + b, 0);
    if (totalKm > 0) {
      icmsBreakdownByUf = {};
      Object.entries(input.kmByUf).forEach(([uf, km]) => {
        icmsBreakdownByUf![uf] = round2((km / totalKm) * icms);
      });
    }
  }

  // ---- STEP 9: DRE ASSET-LIGHT ----
  const dasProvision = das;
  const overhead = round2(receitaLiquida * (params.overheadPercent / 100));
  const resultadoLiquido = round2(receitaLiquida - overhead - custosDiretos);
  const margemBruta = round2(receitaLiquida - overhead - custoMotorista - custoServicos);
  const margemPercent = totalCliente > 0 ? round2((resultadoLiquido / totalCliente) * 100) : 0;

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
      icmsBreakdownByUf,
      ltlMinWeightApplied: ltlMinWeightApplied || undefined,
      originalWeightKg,
      anttFloorApplied: anttFloorApplied || undefined,
      fretePesoOriginal: anttFloorApplied ? baseCost : undefined,
    },
    components: {
      baseCost: custoMotorista,
      baseFreight: custoMotorista,
      toll: round2(input.tollValue),
      aluguelMaquinas,
      gris,
      tso,
      rctrc,
      adValorem,
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
      adValoremPercent,
      markupPercent: params.markupPercent,
      overheadPercent: params.overheadPercent,
      targetMarginPercent: params.targetMarginPercent,
      profitMarginPercent,
      markupScope: params.markupScope,
    },
    totals: {
      receitaBruta: totalCliente,
      das,
      icms,
      totalImpostos,
      totalCliente,
    },
    profitability: {
      custoMotorista,
      custosCarreteiro: custoMotorista,
      custosDescarga: descargaValue,
      custoServicos,
      custosDiretos,
      receitaLiquida,
      margemBruta,
      overhead,
      resultadoLiquido,
      margemPercent,
      profitMarginTarget: profitMarginPercent,
      regimeFiscal,
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
    version: '5.0-risk-aware',
    status: output.status,
    error: output.error,

    meta: {
      routeUfLabel: output.meta.routeUfLabel,
      kmBandLabel: output.meta.kmBandLabel,
      kmStatus: output.meta.kmStatus,
      marginStatus: output.meta.marginStatus,
      marginPercent: output.meta.marginPercent,
      kmBandUsed: output.meta.kmBandUsed,
      ltlMinWeightApplied: output.meta.ltlMinWeightApplied,
      originalWeightKg: output.meta.originalWeightKg,
      regimeSimplesNacional: input.pricingParams?.regimeSimplesNacional,
      excessoSublimite: input.pricingParams?.excessoSublimite,
      selectedConditionalFeeIds: input.extras?.conditionalFees?.ids,
      waitingTimeEnabled: input.extras?.waitingTimeEnabled,
      waitingTimeHours: input.extras?.waitingTimeHours,
      markupScope: output.rates.markupScope,
      unloadingCost: input.extras?.unloadingCostItems,
      equipmentRental: input.extras?.equipmentRentalItems,
      kmByUf: input.kmByUf,
      icmsMode: input.kmByUf && Object.keys(input.kmByUf).length > 0 ? 'B' : 'A',
      anttFloorApplied: output.meta.anttFloorApplied,
      fretePesoOriginal: output.meta.fretePesoOriginal,
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
      profitMarginPercent: (output.rates as { profitMarginPercent?: number }).profitMarginPercent,
      adValoremPercent: output.rates.adValoremPercent || undefined,
    },

    // v5: conditional_fees managed via Taxas Adicionais (pricing_rules)
    conditionalFeesBreakdown: undefined,

    // v5: risk pass-through (cobrado do cliente, repassado à seguradora)
    // Lotação: ad_valorem substitui GRIS/TSO; Fracionado: GRIS+TSO+RCTR-C
    riskPassThrough: {
      gris: output.components.gris,
      tso: output.components.tso,
      rctrc: output.components.rctrc,
      adValorem: output.components.adValorem,
      total: round2(
        output.components.gris +
          output.components.tso +
          output.components.rctrc +
          output.components.adValorem
      ),
    },
  };
}
