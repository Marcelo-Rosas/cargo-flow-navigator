// src/lib/freightCalculator.ts
/**
 * ============================================
 * CALCULADORA DE FRETE - VERSÃO DEFINITIVA
 * ============================================
 * 
 * Regras:
 * - FOB Lotação (cost_per_ton)
 * - Impostos "por fora" (sem gross-up)
 * - DAS: 14% (Regras atualizadas)
 * - Markup: 30% sobre baseCost
 * - TSO substitui ad_valorem
 * - Compatível com frontend e backend
 */

import { Database } from '@/integrations/supabase/types';

type PriceTableRow = Database['public']['Tables']['price_table_rows']['Row'];

// ============================================
// CONSTANTS
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
// TYPES - INPUT
// ============================================

export interface FreightCalculationInput {
  // Localização
  originCity: string;          // ex: "Itajaí, SC"
  destinationCity: string;     // ex: "São Paulo, SP"
  kmDistance: number;
  
  // Carga
  weightKg: number;
  volumeM3: number;
  cargoValue: number;
  
  // Pedágio manual
  tollValue: number;
  
  // Linha da tabela de preços (já selecionada)
  priceTableRow: PriceTableRow | null;
  priceTableId?: string;       // Para referência
  
  // Alíquota ICMS (já normalizada em %)
  icmsRatePercent: number;     // ex: 7, 12, 18
  
  // Taxas NTC opcionais
  tdeEnabled?: boolean;
  tearEnabled?: boolean;
  
  // Overrides globais (opcional)
  dasPercent?: number;         // Default: 14
  markupPercent?: number;      // Default: 30
  overheadPercent?: number;    // Default: 15
  
  // Custos diretos (para rentabilidade - opcional)
  carreteiroPercent?: number;  // % sobre receita bruta
  descargaValue?: number;      // Valor fixo descarga
}

// ============================================
// TYPES - OUTPUT (compatível com QuoteDetailModal)
// ============================================

export interface FreightCalculationOutput {
  status: 'OK' | 'OUT_OF_RANGE' | 'MISSING_DATA';
  error?: string;
  
  // Meta (para badges e alertas)
  meta: {
    routeUfLabel: string | null;        // "SC→SP"
    kmBandLabel: string | null;         // "1-50"
    kmStatus: 'OK' | 'OUT_OF_RANGE';
    marginStatus: 'ABOVE_TARGET' | 'BELOW_TARGET' | 'AT_TARGET';
    marginPercent: number;              // Duplicado para fácil acesso
    cubageFactor: number;               // 300
    cubageWeightKg: number;
    billableWeightKg: number;
  };
  
  // Components (alinhado com QuoteDetailModal)
  components: {
    baseCost: number;          // ANTES do markup (para auditoria)
    baseFreight: number;       // APÓS markup (= baseCost * 1.30)
    toll: number;
    gris: number;
    tso: number;
    rctrc: number;             // RCTR-C (seguro)
    adValorem: number;         // Sempre 0 (legado)
    tde: number;
    tear: number;
  };
  
  // Rates usados (para exibir % na UI)
  rates: {
    dasPercent: number;
    icmsPercent: number;
    grisPercent: number;
    tsoPercent: number;
    costValuePercent: number;  // Para RCTR-C
    markupPercent: number;
    overheadPercent: number;
  };
  
  // Totals
  totals: {
    receitaBruta: number;      // Soma de components (exceto baseCost)
    das: number;
    icms: number;
    totalImpostos: number;     // das + icms
    totalCliente: number;      // receitaBruta + totalImpostos
  };
  
  // Profitability
  profitability: {
    custosCarreteiro: number;
    custosDescarga: number;
    custosDiretos: number;     // carreteiro + descarga
    margemBruta: number;       // receitaBruta - impostos - custos
    overhead: number;
    resultadoLiquido: number;
    margemPercent: number;     // % sobre receita bruta
  };
}

// ============================================
// STORED BREAKDOWN (para salvar em JSONB)
// ============================================

export interface StoredPricingBreakdown {
  calculatedAt: string;
  version: string;
  status: 'OK' | 'OUT_OF_RANGE' | 'MISSING_DATA';
  error?: string;
  
  meta: {
    routeUfLabel: string | null;
    kmBandLabel: string | null;
    kmStatus: 'OK' | 'OUT_OF_RANGE';
    marginStatus: 'ABOVE_TARGET' | 'BELOW_TARGET' | 'AT_TARGET';
    marginPercent: number;
    // Optional fields for additional fees
    selectedConditionalFeeIds?: string[];
    waitingTimeEnabled?: boolean;
    waitingTimeHours?: number;
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
    gris: number;
    tso: number;
    rctrc: number;
    adValorem: number;
    tde: number;
    tear: number;
    // Optional fields for additional costs
    conditionalFeesTotal?: number;
    waitingTimeCost?: number;
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
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extrai UF de string "Cidade, SC" ou "Cidade - SC"
 */
export function extractUf(location: string): string | null {
  if (!location) return null;
  
  // Padrão 1: "Cidade, UF" ou "Cidade - UF"
  const match = location.match(/[,-]\s*([A-Z]{2})\s*$/i);
  if (match) {
    return match[1].toUpperCase();
  }
  
  // Fallback: últimos 2 caracteres se forem letras
  const trimmed = location.trim();
  const lastTwo = trimmed.slice(-2);
  if (/^[A-Z]{2}$/i.test(lastTwo)) {
    return lastTwo.toUpperCase();
  }
  
  return null;
}

/**
 * Formata rota "SC→SP"
 */
export function formatRouteUf(origin: string, destination: string): string | null {
  const originUf = extractUf(origin);
  const destUf = extractUf(destination);
  
  if (originUf && destUf) {
    return `${originUf}→${destUf}`;
  }
  
  return null;
}

/**
 * Normaliza taxa ICMS para escala percentual (3-25)
 * - 0.12 → 12 (×100)
 * - 0.7 → 7 (×10)
 * - 70 → 7 (÷10)
 */
export function normalizeIcmsRate(rate: number): number {
  if (rate === 0) return 0;
  
  // Já está na escala correta (3-25)
  if (rate >= 3 && rate <= 25) return rate;
  
  // Decimal pequeno: 0 < x < 1
  if (rate > 0 && rate < 1) {
    const times100 = rate * 100;
    if (times100 >= 3 && times100 <= 25) return times100;
    
    const times10 = rate * 10;
    if (times10 >= 3 && times10 <= 25) return times10;
  }
  
  // Entre 1 e 3: pode ser 1.2 = 12%
  if (rate >= 1 && rate < 3) {
    const times10 = rate * 10;
    if (times10 >= 3 && times10 <= 25) return times10;
  }
  
  // Muito alto: > 25
  if (rate > 25 && rate <= 250) {
    const divided = rate / 10;
    if (divided >= 3 && divided <= 25) return divided;
  }
  
  // Fallback: retorna o valor original (mesmo se fora da faixa)
  return rate;
}

// ============================================
// MAIN CALCULATION FUNCTION
// ============================================

export function calculateFreight(input: FreightCalculationInput): FreightCalculationOutput {
  // Defaults
  const dasPercent = input.dasPercent ?? FREIGHT_CONSTANTS.DEFAULT_DAS_PERCENT;
  const markupPercent = input.markupPercent ?? FREIGHT_CONSTANTS.DEFAULT_MARKUP_PERCENT;
  const overheadPercent = input.overheadPercent ?? FREIGHT_CONSTANTS.DEFAULT_OVERHEAD_PERCENT;
  const carreteiroPercent = input.carreteiroPercent ?? 0;
  const descargaValue = input.descargaValue ?? 0;
  
  // Normalize ICMS rate
  const icmsPercent = normalizeIcmsRate(input.icmsRatePercent);
  
  // Initialize result
  const result: FreightCalculationOutput = {
    status: 'OK',
    meta: {
      routeUfLabel: formatRouteUf(input.originCity, input.destinationCity),
      kmBandLabel: null,
      kmStatus: 'OK',
      marginStatus: 'AT_TARGET',
      marginPercent: 0,
      cubageFactor: FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3,
      cubageWeightKg: 0,
      billableWeightKg: 0,
    },
    components: {
      baseCost: 0,
      baseFreight: 0,
      toll: input.tollValue,
      gris: 0,
      tso: 0,
      rctrc: 0,
      adValorem: 0,
      tde: 0,
      tear: 0,
    },
    rates: {
      dasPercent,
      icmsPercent,
      grisPercent: 0,
      tsoPercent: 0,
      costValuePercent: 0,
      markupPercent,
      overheadPercent,
    },
    totals: {
      receitaBruta: 0,
      das: 0,
      icms: 0,
      totalImpostos: 0,
      totalCliente: 0,
    },
    profitability: {
      custosCarreteiro: 0,
      custosDescarga: descargaValue,
      custosDiretos: descargaValue,
      margemBruta: 0,
      overhead: 0,
      resultadoLiquido: 0,
      margemPercent: 0,
    },
  };
  
  // ============================================
  // VALIDATION: Price Table Row
  // ============================================
  
  if (!input.priceTableRow) {
    result.status = 'MISSING_DATA';
    result.error = 'Tabela de preços não selecionada';
    return result;
  }
  
  const row = input.priceTableRow;
  const kmFrom = Number(row.km_from);
  const kmTo = Number(row.km_to);
  
  // Verify km within range
  if (input.kmDistance < kmFrom || input.kmDistance > kmTo) {
    result.status = 'OUT_OF_RANGE';
    result.meta.kmStatus = 'OUT_OF_RANGE';
    result.meta.kmBandLabel = `${kmFrom}-${kmTo}`;
    result.error = `Distância ${input.kmDistance} km fora da faixa ${kmFrom}-${kmTo} km`;
    return result;
  }
  
  result.meta.kmBandLabel = `${kmFrom}-${kmTo}`;
  
  // ============================================
  // STEP 1: PESO FATURÁVEL
  // ============================================
  
  const cubageWeightKg = input.volumeM3 * FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3;
  const billableWeightKg = Math.max(input.weightKg, cubageWeightKg);
  
  result.meta.cubageWeightKg = cubageWeightKg;
  result.meta.billableWeightKg = billableWeightKg;
  
  // ============================================
  // STEP 2: FRETE BASE (com MARKUP)
  // ============================================
  
  const costPerTon = Number(row.cost_per_ton) || 0;
  
  // baseCost = (peso kg / 1000) * cost_per_ton
  const baseCost = (billableWeightKg / 1000) * costPerTon;
  
  // baseFreight = baseCost * (1 + markup/100)
  const baseFreight = baseCost * (1 + markupPercent / 100);
  
  result.components.baseCost = baseCost;
  result.components.baseFreight = baseFreight;
  
  // ============================================
  // STEP 3: COMPONENTES PERCENTUAIS SOBRE VALOR DA CARGA
  // ============================================
  
  const grisPercent = Number(row.gris_percent) || 0;
  const tsoPercent = Number(row.tso_percent) || 0;
  const costValuePercent = Number(row.cost_value_percent) || 0;
  
  result.rates.grisPercent = grisPercent;
  result.rates.tsoPercent = tsoPercent;
  result.rates.costValuePercent = costValuePercent;
  
  result.components.gris = input.cargoValue * (grisPercent / 100);
  result.components.tso = input.cargoValue * (tsoPercent / 100);
  result.components.rctrc = input.cargoValue * (costValuePercent / 100);
  result.components.adValorem = 0; // Sempre 0 (TSO substitui)
  
  // ============================================
  // STEP 4: TAXAS NTC (20% sobre baseFreight)
  // ============================================
  
  if (input.tdeEnabled) {
    result.components.tde = baseFreight * (FREIGHT_CONSTANTS.NTC_TDE_PERCENT / 100);
  }
  
  if (input.tearEnabled) {
    result.components.tear = baseFreight * (FREIGHT_CONSTANTS.NTC_TEAR_PERCENT / 100);
  }
  
  // ============================================
  // STEP 5: RECEITA BRUTA (soma de components exceto baseCost)
  // ============================================
  
  result.totals.receitaBruta =
    result.components.baseFreight +
    result.components.toll +
    result.components.gris +
    result.components.tso +
    result.components.rctrc +
    result.components.adValorem +
    result.components.tde +
    result.components.tear;
  
  // ============================================
  // STEP 6: IMPOSTOS "POR FORA" (sem gross-up)
  // ============================================
  
  result.totals.das = result.totals.receitaBruta * (dasPercent / 100);
  result.totals.icms = result.totals.receitaBruta * (icmsPercent / 100);
  result.totals.totalImpostos = result.totals.das + result.totals.icms;
  
  // ============================================
  // STEP 7: TOTAL CLIENTE
  // ============================================
  
  result.totals.totalCliente = result.totals.receitaBruta + result.totals.totalImpostos;
  
  // ============================================
  // STEP 8: RENTABILIDADE
  // ============================================
  
  result.profitability.custosCarreteiro = result.totals.receitaBruta * (carreteiroPercent / 100);
  result.profitability.custosDescarga = descargaValue;
  result.profitability.custosDiretos = result.profitability.custosCarreteiro + result.profitability.custosDescarga;
  
  result.profitability.margemBruta = 
    result.totals.receitaBruta - 
    result.totals.totalImpostos - 
    result.profitability.custosDiretos;
  
  result.profitability.overhead = result.profitability.margemBruta * (overheadPercent / 100);
  result.profitability.resultadoLiquido = result.profitability.margemBruta - result.profitability.overhead;
  
  result.profitability.margemPercent = result.totals.receitaBruta > 0
    ? (result.profitability.resultadoLiquido / result.totals.receitaBruta) * 100
    : 0;
  
  // ============================================
  // STEP 9: META STATUS
  // ============================================
  
  result.meta.marginPercent = result.profitability.margemPercent;
  
  if (result.profitability.margemPercent > FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT) {
    result.meta.marginStatus = 'ABOVE_TARGET';
  } else if (result.profitability.margemPercent < FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT) {
    result.meta.marginStatus = 'BELOW_TARGET';
  } else {
    result.meta.marginStatus = 'AT_TARGET';
  }
  
  return result;
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
    version: '3.0-fob-lotacao-markup',
    status: output.status,
    error: output.error,
    
    meta: {
      routeUfLabel: output.meta.routeUfLabel,
      kmBandLabel: output.meta.kmBandLabel,
      kmStatus: output.meta.kmStatus,
      marginStatus: output.meta.marginStatus,
      marginPercent: output.meta.marginPercent,
    },
    
    weights: {
      cubageWeight: output.meta.cubageWeightKg,
      billableWeight: output.meta.billableWeightKg,
      tonBillable: output.meta.billableWeightKg / 1000,
    },
    
    components: {
      baseCost: output.components.baseCost,
      baseFreight: output.components.baseFreight,
      toll: output.components.toll,
      gris: output.components.gris,
      tso: output.components.tso,
      rctrc: output.components.rctrc,
      adValorem: output.components.adValorem,
      tde: output.components.tde,
      tear: output.components.tear,
    },
    
    totals: {
      receitaBruta: output.totals.receitaBruta,
      das: output.totals.das,
      icms: output.totals.icms,
      totalImpostos: output.totals.totalImpostos,
      totalCliente: output.totals.totalCliente,
    },
    
    profitability: {
      custosCarreteiro: output.profitability.custosCarreteiro,
      custosDescarga: output.profitability.custosDescarga,
      custosDiretos: output.profitability.custosDiretos,
      margemBruta: output.profitability.margemBruta,
      overhead: output.profitability.overhead,
      resultadoLiquido: output.profitability.resultadoLiquido,
      margemPercent: output.profitability.margemPercent,
    },
    
    rates: {
      dasPercent: output.rates.dasPercent,
      icmsPercent: output.rates.icmsPercent,
      grisPercent: output.rates.grisPercent,
      tsoPercent: output.rates.tsoPercent,
      costValuePercent: output.rates.costValuePercent,
      markupPercent: output.rates.markupPercent,
      overheadPercent: output.rates.overheadPercent,
    },
  };
}
