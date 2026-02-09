// src/lib/freight-calculator.ts
/**
 * Calculadora de Frete FOB - Lotação
 * 
 * Implementa a política de "impostos por fora" (sem gross-up)
 * conforme regras do Referencial.
 */

import { Database } from '@/integrations/supabase/types';

type PriceTableRow = Database['public']['Tables']['price_table_rows']['Row'];

// ============================================
// TYPES
// ============================================

export interface FreightCalculationInput {
  // Peso e volume
  weightKg: number;
  volumeM3: number;
  
  // Valores
  cargoValue: number; // Valor da mercadoria
  tollValue: number;  // Pedágio manual
  
  // Distância
  kmDistance: number;
  
  // Linha da tabela de preços (já selecionada)
  priceTableRow: PriceTableRow | null;
  
  // Alíquotas
  icmsRate: number; // Taxa ICMS do estado (ex: 12 para 12%)
  dasPercent?: number; // Default: 3.55%
  
  // Taxas NTC opcionais
  tdeEnabled?: boolean; // Taxa de Dificuldade de Entrega
  tearEnabled?: boolean; // Taxa de Entrega Agendada Restrita
  
  // Custos de rentabilidade (opcional)
  carreteiroPercent?: number; // % sobre receita bruta
  descargaValue?: number; // Valor fixo descarga
  overheadPercent?: number; // % sobre margem bruta
  targetMarginPercent?: number; // Margem alvo para validação
}

export interface FreightCalculationResult {
  status: 'OK' | 'OUT_OF_RANGE' | 'MISSING_DATA';
  error?: string;
  
  // Meta info para badges
  meta: {
    routeUfLabel: string | null; // Ex: "SC→SP"
    kmBandLabel: string | null;  // Ex: "1-50"
    kmStatus: 'OK' | 'OUT_OF_RANGE';
    marginStatus: 'OK' | 'BELOW_TARGET' | 'UNKNOWN';
  };
  
  // Peso
  cubageWeight: number;  // volume * 300
  billableWeight: number; // max(peso real, peso cubado)
  
  // Componentes do frete
  baseFreight: number;   // (billableWeight/1000) * cost_per_ton
  toll: number;
  rctrc: number;         // cargoValue * (cost_value_percent/100)
  gris: number;          // cargoValue * (gris_percent/100)
  tso: number;           // cargoValue * (tso_percent/100)
  adValorem: number;     // Default 0
  tde: number;           // 20% do baseFreight se ativado
  tear: number;          // 20% do baseFreight se ativado
  
  // Receita Bruta (FOB)
  receitaBruta: number;
  
  // Impostos "por fora"
  das: number;           // receitaBruta * (dasPercent/100)
  icms: number;          // receitaBruta * (icmsRate/100)
  totalImpostos: number; // das + icms
  
  // Total Cliente
  totalCliente: number;  // receitaBruta + totalImpostos
  
  // Rentabilidade
  custosCarreteiro: number;
  custosDescarga: number;
  custosDiretos: number;  // carreteiro + descarga
  margemBruta: number;    // receitaBruta - totalImpostos - custosDiretos
  overhead: number;       // margemBruta * (overheadPercent/100)
  resultadoLiquido: number; // margemBruta - overhead
  margemPercent: number;  // (resultadoLiquido / receitaBruta) * 100
  
  // Taxas usadas (para display)
  rates: {
    dasPercent: number;
    icmsPercent: number;
    grisPercent: number;
    tsoPercent: number;
    costValuePercent: number;
  };
}

// ============================================
// CONSTANTS
// ============================================

const CUBAGE_FACTOR = 300; // kg/m³
const DEFAULT_DAS_PERCENT = 3.55;
const DEFAULT_CARRETEIRO_PERCENT = 0; // % sobre receita bruta
const DEFAULT_OVERHEAD_PERCENT = 10;
const DEFAULT_TARGET_MARGIN = 15;
const NTC_TDE_PERCENT = 20;
const NTC_TEAR_PERCENT = 20;

// ============================================
// HELPER: Extrair UF de string "Cidade - UF"
// ============================================

export function extractUf(location: string): string | null {
  if (!location) return null;
  
  // Padrão: "Cidade - UF"
  const match = location.match(/[-–]\s*([A-Z]{2})\s*$/i);
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

export function formatRouteUf(origin: string, destination: string): string | null {
  const originUf = extractUf(origin);
  const destUf = extractUf(destination);
  
  if (originUf && destUf) {
    return `${originUf}→${destUf}`;
  }
  
  return null;
}

/**
 * Normaliza taxa ICMS para escala percentual
 * CSV pode ter 0.7 para 7%, 0.12 para 12%, etc.
 */
function normalizeIcmsRate(ratePercent: number): number {
  if (ratePercent === 0) return 0;
  if (ratePercent > 0 && ratePercent <= 0.25) return ratePercent * 100; // 0.12 => 12
  if (ratePercent > 0.25 && ratePercent <= 1) return ratePercent * 10;  // 0.7  => 7
  return ratePercent; // já percentual
}

// ============================================
// MAIN CALCULATION FUNCTION
// ============================================

export function calculateFreightLocal(input: FreightCalculationInput): FreightCalculationResult {
  const {
    weightKg,
    volumeM3,
    cargoValue,
    tollValue,
    kmDistance,
    priceTableRow,
    icmsRate,
    dasPercent = DEFAULT_DAS_PERCENT,
    tdeEnabled = false,
    tearEnabled = false,
    carreteiroPercent = DEFAULT_CARRETEIRO_PERCENT,
    descargaValue = 0,
    overheadPercent = DEFAULT_OVERHEAD_PERCENT,
    targetMarginPercent = DEFAULT_TARGET_MARGIN,
  } = input;
  
  // Initialize result with defaults
  const result: FreightCalculationResult = {
    status: 'OK',
    meta: {
      routeUfLabel: null,
      kmBandLabel: null,
      kmStatus: 'OK',
      marginStatus: 'UNKNOWN',
    },
    cubageWeight: 0,
    billableWeight: 0,
    baseFreight: 0,
    toll: tollValue || 0,
    rctrc: 0,
    gris: 0,
    tso: 0,
    adValorem: 0,
    tde: 0,
    tear: 0,
    receitaBruta: 0,
    das: 0,
    icms: 0,
    totalImpostos: 0,
    totalCliente: 0,
    custosCarreteiro: 0,
    custosDescarga: descargaValue,
    custosDiretos: descargaValue,
    margemBruta: 0,
    overhead: 0,
    resultadoLiquido: 0,
    margemPercent: 0,
    rates: {
      dasPercent,
      icmsPercent: normalizeIcmsRate(icmsRate),
      grisPercent: 0,
      tsoPercent: 0,
      costValuePercent: 0,
    },
  };
  
  // Check for missing price table row
  if (!priceTableRow) {
    result.status = 'MISSING_DATA';
    result.error = 'Tabela de preços não selecionada ou linha não encontrada';
    return result;
  }
  
  // Verify km is within range
  const kmFrom = Number(priceTableRow.km_from);
  const kmTo = Number(priceTableRow.km_to);
  
  if (kmDistance < kmFrom || kmDistance > kmTo) {
    result.status = 'OUT_OF_RANGE';
    result.meta.kmStatus = 'OUT_OF_RANGE';
    result.error = `Distância ${kmDistance} km fora da faixa ${kmFrom}-${kmTo}`;
    return result;
  }
  
  // Set km band label
  result.meta.kmBandLabel = `${kmFrom}–${kmTo}`;
  
  // ============================================
  // STEP 1: Peso Faturável
  // ============================================
  
  result.cubageWeight = volumeM3 * CUBAGE_FACTOR;
  result.billableWeight = Math.max(weightKg, result.cubageWeight);
  
  // ============================================
  // STEP 2: Componentes do Frete
  // ============================================
  
  const costPerTon = Number(priceTableRow.cost_per_ton) || 0;
  const grisPercent = Number(priceTableRow.gris_percent) || 0;
  const tsoPercent = Number(priceTableRow.tso_percent) || 0;
  const costValuePercent = Number(priceTableRow.cost_value_percent) || 0;
  
  // Store rates for display
  result.rates.grisPercent = grisPercent;
  result.rates.tsoPercent = tsoPercent;
  result.rates.costValuePercent = costValuePercent;
  
  // Base Freight = (peso faturável em kg / 1000) * cost_per_ton
  result.baseFreight = (result.billableWeight / 1000) * costPerTon;
  
  // RCTR-C = cargoValue * (cost_value_percent / 100)
  result.rctrc = cargoValue * (costValuePercent / 100);
  
  // GRIS = cargoValue * (gris_percent / 100)
  result.gris = cargoValue * (grisPercent / 100);
  
  // TSO = cargoValue * (tso_percent / 100)
  result.tso = cargoValue * (tsoPercent / 100);
  
  // Ad Valorem = 0 (default, pode ser override manual futuro)
  result.adValorem = 0;
  
  // TDE = 20% do baseFreight se ativado
  if (tdeEnabled) {
    result.tde = result.baseFreight * (NTC_TDE_PERCENT / 100);
  }
  
  // TEAR = 20% do baseFreight se ativado
  if (tearEnabled) {
    result.tear = result.baseFreight * (NTC_TEAR_PERCENT / 100);
  }
  
  // ============================================
  // STEP 3: Receita Bruta (FOB)
  // ============================================
  
  result.receitaBruta = 
    result.baseFreight + 
    result.toll + 
    result.rctrc +
    result.gris + 
    result.tso + 
    result.adValorem +
    result.tde +
    result.tear;
  
  // ============================================
  // STEP 4: Impostos "por fora" (SEM GROSS-UP)
  // ============================================
  
  // DAS = receitaBruta * (dasPercent / 100)
  result.das = result.receitaBruta * (dasPercent / 100);
  
  // ICMS = receitaBruta * (icmsRate / 100) - normalized
  result.icms = result.receitaBruta * (result.rates.icmsPercent / 100);
  
  // Total Impostos = DAS + ICMS
  result.totalImpostos = result.das + result.icms;
  
  // ============================================
  // STEP 5: Total Cliente
  // ============================================
  
  result.totalCliente = result.receitaBruta + result.totalImpostos;
  
  // ============================================
  // STEP 6: Rentabilidade
  // ============================================
  
  // Custos Carreteiro = receitaBruta * (carreteiroPercent / 100)
  result.custosCarreteiro = result.receitaBruta * (carreteiroPercent / 100);
  
  // Custos Diretos = carreteiro + descarga
  result.custosDiretos = result.custosCarreteiro + result.custosDescarga;
  
  // Margem Bruta = receitaBruta - totalImpostos - custosDiretos
  result.margemBruta = result.receitaBruta - result.totalImpostos - result.custosDiretos;
  
  // Overhead = margemBruta * (overheadPercent / 100)
  result.overhead = result.margemBruta * (overheadPercent / 100);
  
  // Resultado Líquido = margemBruta - overhead
  result.resultadoLiquido = result.margemBruta - result.overhead;
  
  // Margem % = (resultadoLiquido / receitaBruta) * 100
  result.margemPercent = result.receitaBruta > 0 
    ? (result.resultadoLiquido / result.receitaBruta) * 100 
    : 0;
  
  // Check margin status
  result.meta.marginStatus = result.margemPercent >= targetMarginPercent ? 'OK' : 'BELOW_TARGET';
  
  return result;
}

// ============================================
// PRICING BREAKDOWN FOR STORAGE
// ============================================

export interface PricingBreakdown {
  // Meta
  calculatedAt: string;
  version: string;
  status: 'OK' | 'OUT_OF_RANGE' | 'MISSING_DATA';
  error?: string;
  
  meta: {
    routeUfLabel: string | null;
    kmBandLabel: string | null;
    kmStatus: 'OK' | 'OUT_OF_RANGE';
    marginStatus: 'OK' | 'BELOW_TARGET' | 'UNKNOWN';
    marginPercent: number;
  };
  
  // Input snapshot
  input: {
    weightKg: number;
    volumeM3: number;
    cargoValue: number;
    tollValue: number;
    kmDistance: number;
    priceTableRowId: string | null;
  };
  
  // Calculated values
  weights: {
    cubageWeight: number;
    billableWeight: number;
  };
  
  components: {
    baseFreight: number;
    toll: number;
    rctrc: number;
    gris: number;
    tso: number;
    adValorem: number;
    tde: number;
    tear: number;
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
  };
}

export function buildPricingBreakdown(
  result: FreightCalculationResult,
  input: FreightCalculationInput
): PricingBreakdown {
  return {
    calculatedAt: new Date().toISOString(),
    version: '2.0-fob-lotacao',
    status: result.status,
    error: result.error,
    
    meta: {
      routeUfLabel: result.meta.routeUfLabel,
      kmBandLabel: result.meta.kmBandLabel,
      kmStatus: result.meta.kmStatus,
      marginStatus: result.meta.marginStatus,
      marginPercent: result.margemPercent,
    },
    
    input: {
      weightKg: input.weightKg,
      volumeM3: input.volumeM3,
      cargoValue: input.cargoValue,
      tollValue: input.tollValue,
      kmDistance: input.kmDistance,
      priceTableRowId: input.priceTableRow?.id || null,
    },
    
    weights: {
      cubageWeight: result.cubageWeight,
      billableWeight: result.billableWeight,
    },
    
    components: {
      baseFreight: result.baseFreight,
      toll: result.toll,
      rctrc: result.rctrc,
      gris: result.gris,
      tso: result.tso,
      adValorem: result.adValorem,
      tde: result.tde,
      tear: result.tear,
    },
    
    totals: {
      receitaBruta: result.receitaBruta,
      das: result.das,
      icms: result.icms,
      totalImpostos: result.totalImpostos,
      totalCliente: result.totalCliente,
    },
    
    profitability: {
      custosCarreteiro: result.custosCarreteiro,
      custosDescarga: result.custosDescarga,
      custosDiretos: result.custosDiretos,
      margemBruta: result.margemBruta,
      overhead: result.overhead,
      resultadoLiquido: result.resultadoLiquido,
      margemPercent: result.margemPercent,
    },
    
    rates: result.rates,
  };
}
