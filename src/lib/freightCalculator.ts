// src/lib/freightCalculator.ts
/**
 * Calculadora de Frete FOB - Lotação
 * Impostos "por fora" (sem gross-up)
 */

export type Uf = string;

// ============================================
// CONFIGURATION TYPES
// ============================================

export interface FreightConfig {
  dasPercent: number;          // default 14 (vem de Regras)
  markupPercent: number;       // default 30 (vem de Regras)
  overheadPercent: number;     // default 15 (vem de Regras)
  cubageFactorKgM3: number;    // default 300 (Regra NTC)
  targetMarginPercent?: number; // para o "dentro da margem prevista"
}

export interface FreightInput {
  // contexto
  originUF: Uf;
  destinationUF: Uf;
  kmDistance: number;
  
  // carga
  weightKg: number;
  volumeM3: number;
  cargoValue: number;
  
  // pedágio sempre manual
  toll: number;
  
  // NTC
  hasTde: boolean;
  hasTear: boolean;
  
  // custos diretos
  carreteiroCost: number;
  descargaCost: number;
  
  // overrides (se existirem)
  baseFreightOverride?: number;
  grisPercentOverride?: number;
  tsoPercentOverride?: number;
  rctrcPercentOverride?: number; // equivale ao cost_value_percent
  adValoremOverride?: number;    // default 0 (se existir)
  
  config: FreightConfig;
}

export interface PriceTableRow {
  km_from: number;
  km_to: number;
  cost_per_ton: number;
  gris_percent: number;
  tso_percent: number;
  cost_value_percent: number; // RCTR-C
}

// ============================================
// OUTPUT TYPES
// ============================================

export interface FreightOutput {
  badges: {
    routeUf: string;     // "SC→SP"
    kmRange: string;     // "1–50"
  };
  
  revenue: {
    baseFreight: number;
    toll: number;
    gris: number;
    tso: number;
    rctrc: number;
    adValorem: number;
    ntc: { tde: number; tear: number; total: number };
    receitaBruta: number;
  };
  
  taxes: {
    dasPercent: number;
    icmsPercent: number;
    das: number;
    icms: number;
    totalImpostos: number;
  };
  
  totals: {
    totalCliente: number;
  };
  
  profit: {
    custosDiretos: number;
    margemBruta: number;
    overhead: number;
    resultadoLiquido: number;
    margemPercent: number;
    withinTargetMargin?: boolean;
    targetMarginPercent?: number;
  };
  
  meta: {
    weightCubedKg: number;
    weightBillableKg: number;
    tonBillable: number;
    priceRowUsed: boolean;
  };
}

// ============================================
// ERROR TYPE
// ============================================

export class FreightCalculationError extends Error {
  constructor(
    message: string,
    public readonly code: 'OUT_OF_RANGE' | 'MISSING_DATA' | 'INVALID_INPUT'
  ) {
    super(message);
    this.name = 'FreightCalculationError';
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normaliza taxa ICMS para escala percentual
 * CSV pode ter 0.7 para 7%, 0.12 para 12%, etc.
 */
export function normalizeIcmsRate(ratePercent: number): number {
  if (ratePercent === 0) return 0;
  if (ratePercent > 0 && ratePercent <= 0.25) return ratePercent * 100; // 0.12 => 12
  if (ratePercent > 0.25 && ratePercent <= 1) return ratePercent * 10;  // 0.7  => 7
  return ratePercent; // já percentual
}

/**
 * Extrai UF de string "Cidade - UF"
 */
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

/**
 * Formata rota UF "SC→SP"
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
 * Seleciona linha da tabela de preços por faixa de KM
 * REGRA: km_from <= km_distance <= km_to
 * Retorna erro se não encontrar faixa correspondente
 */
export function pickPriceRowByKm(rows: PriceTableRow[], km: number): PriceTableRow {
  const row = rows.find(r => km >= r.km_from && km <= r.km_to);
  
  if (!row) {
    throw new FreightCalculationError(
      `KM fora das faixas da tabela (km=${km}). Verifique a tabela de preços.`,
      'OUT_OF_RANGE'
    );
  }
  
  return row;
}

// ============================================
// MAIN CALCULATION FUNCTION
// ============================================

export function calculateFreightLocal(params: {
  input: FreightInput;
  priceRows: PriceTableRow[];   // da tabela selecionada
  icmsRatePercent: number;      // vindo do banco por UF origem/destino
}): FreightOutput {
  const { input, priceRows, icmsRatePercent } = params;
  
  // Seleciona linha da tabela por faixa de KM
  const row = pickPriceRowByKm(priceRows, input.kmDistance);
  
  // ============================================
  // STEP 1: Peso Faturável
  // ============================================
  
  const cubageFactor = input.config.cubageFactorKgM3 || 300;
  const weightCubedKg = (input.volumeM3 || 0) * cubageFactor;
  const weightBillableKg = Math.max(input.weightKg || 0, weightCubedKg);
  const tonBillable = weightBillableKg / 1000;
  
  // ============================================
  // STEP 2: Componentes do Frete
  // ============================================
  
  // Base Cost (custo base sem markup)
  const baseCost = tonBillable * row.cost_per_ton;
  
  // Markup (aplicado sobre o custo base)
  const markupPercent = input.config.markupPercent ?? 30;
  
  // Base Freight (com markup aplicado, ou override)
  const baseFreight = input.baseFreightOverride ?? (baseCost * (1 + markupPercent / 100));
  
  // Percentuais (override ou da tabela)
  const grisPct = input.grisPercentOverride ?? row.gris_percent ?? 0;
  const tsoPct = input.tsoPercentOverride ?? row.tso_percent ?? 0;
  const rctrcPct = input.rctrcPercentOverride ?? row.cost_value_percent ?? 0;
  
  // Valores calculados
  const gris = (input.cargoValue || 0) * (grisPct / 100);
  const tso = (input.cargoValue || 0) * (tsoPct / 100);
  const rctrc = (input.cargoValue || 0) * (rctrcPct / 100);
  
  // Ad Valorem: default 0 (regra atual)
  const adValorem = input.adValoremOverride ?? 0;
  
  // NTC: TDE e TEAR = 20% cada sobre baseFreight quando ativados
  const tde = input.hasTde ? baseFreight * 0.20 : 0;
  const tear = input.hasTear ? baseFreight * 0.20 : 0;
  const ntcTotal = tde + tear;
  
  // ============================================
  // STEP 3: Receita Bruta (FOB)
  // ============================================
  
  const receitaBruta = 
    baseFreight + 
    (input.toll || 0) + 
    gris + 
    tso + 
    rctrc + 
    adValorem + 
    ntcTotal;
  
  // ============================================
  // STEP 4: Impostos "por fora" (SEM GROSS-UP)
  // ============================================
  
  const dasPercent = input.config.dasPercent ?? 14;
  const icmsPercent = normalizeIcmsRate(icmsRatePercent);
  
  const das = receitaBruta * (dasPercent / 100);
  const icms = receitaBruta * (icmsPercent / 100);
  const totalImpostos = das + icms;
  
  // Total Cliente = Receita Bruta + Impostos (por fora)
  const totalCliente = receitaBruta + totalImpostos;
  
  // ============================================
  // STEP 5: Rentabilidade
  // ============================================
  
  const custosDiretos = (input.carreteiroCost || 0) + (input.descargaCost || 0);
  const margemBruta = receitaBruta - totalImpostos - custosDiretos;
  
  const overheadPercent = input.config.overheadPercent ?? 0;
  const overhead = margemBruta * (overheadPercent / 100);
  
  const resultadoLiquido = margemBruta - overhead;
  const margemPercent = receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0;
  
  // Comparação com margem alvo
  const targetMarginPercent = input.config.targetMarginPercent;
  const withinTargetMargin = typeof targetMarginPercent === 'number' 
    ? margemPercent >= targetMarginPercent 
    : undefined;
  
  // ============================================
  // RETURN
  // ============================================
  
  return {
    badges: {
      routeUf: `${input.originUF}→${input.destinationUF}`,
      kmRange: `${row.km_from}–${row.km_to}`,
    },
    
    revenue: {
      baseFreight,
      toll: input.toll || 0,
      gris,
      tso,
      rctrc,
      adValorem,
      ntc: { tde, tear, total: ntcTotal },
      receitaBruta,
    },
    
    taxes: {
      dasPercent,
      icmsPercent,
      das,
      icms,
      totalImpostos,
    },
    
    totals: {
      totalCliente,
    },
    
    profit: {
      custosDiretos,
      margemBruta,
      overhead,
      resultadoLiquido,
      margemPercent,
      withinTargetMargin,
      targetMarginPercent,
    },
    
    meta: {
      weightCubedKg,
      weightBillableKg,
      tonBillable,
      priceRowUsed: true,
    },
  };
}

// ============================================
// SAFE CALCULATION (returns result or error state)
// ============================================

export type SafeFreightResult = 
  | { success: true; output: FreightOutput }
  | { success: false; error: string; code: 'OUT_OF_RANGE' | 'MISSING_DATA' | 'INVALID_INPUT' };

export function calculateFreightSafe(params: {
  input: FreightInput;
  priceRows: PriceTableRow[];
  icmsRatePercent: number;
}): SafeFreightResult {
  try {
    const output = calculateFreightLocal(params);
    return { success: true, output };
  } catch (error) {
    if (error instanceof FreightCalculationError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido', 
      code: 'INVALID_INPUT' 
    };
  }
}

// ============================================
// PRICING BREAKDOWN FOR STORAGE (JSONB)
// ============================================

export interface StoredPricingBreakdown {
  calculatedAt: string;
  version: string;
  status: 'OK' | 'OUT_OF_RANGE' | 'MISSING_DATA';
  error?: string;
  
  meta: {
    routeUfLabel: string;
    kmBandLabel: string;
    kmStatus: 'OK' | 'OUT_OF_RANGE';
    marginStatus: 'OK' | 'BELOW_TARGET' | 'UNKNOWN';
    marginPercent: number;
    // Additional fees selection stored in meta
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
    conditionalFeesTotal: number;
    waitingTimeCost: number;
  };
  
  totals: {
    receitaBruta: number;
    das: number;
    icms: number;
    totalImpostos: number;
    totalCliente: number;
  };
  
  profitability: {
    custosDiretos: number;
    margemBruta: number;
    overhead: number;
    resultadoLiquido: number;
    margemPercent: number;
  };
  
  rates: {
    dasPercent: number;
    markupPercent: number;
    icmsPercent: number;
    grisPercent: number;
    tsoPercent: number;
    costValuePercent: number;
    overheadPercent: number;
  };
}

export function buildStoredBreakdown(
  output: FreightOutput,
  input: FreightInput,
  priceRow: PriceTableRow,
  targetMarginPercent?: number,
  additionalFees?: { conditionalFeesTotal: number; selectedFeeIds: string[]; waitingTimeEnabled: boolean; waitingTimeHours: number; waitingTimeCost: number }
): StoredPricingBreakdown {
  const marginStatus = targetMarginPercent !== undefined
    ? (output.profit.margemPercent >= targetMarginPercent ? 'OK' : 'BELOW_TARGET')
    : 'UNKNOWN';
  
  const markupPercent = input.config.markupPercent ?? 30;
  const overheadPercent = input.config.overheadPercent ?? 15;
  
  // Calculate baseCost (before markup)
  const baseCost = output.meta.tonBillable * priceRow.cost_per_ton;
  
  return {
    calculatedAt: new Date().toISOString(),
    version: '2.1-fob-lotacao',
    status: 'OK',
    
    meta: {
      routeUfLabel: output.badges.routeUf,
      kmBandLabel: output.badges.kmRange,
      kmStatus: 'OK',
      marginStatus,
      marginPercent: output.profit.margemPercent,
      selectedConditionalFeeIds: additionalFees?.selectedFeeIds,
      waitingTimeEnabled: additionalFees?.waitingTimeEnabled,
      waitingTimeHours: additionalFees?.waitingTimeHours,
    },
    
    weights: {
      cubageWeight: output.meta.weightCubedKg,
      billableWeight: output.meta.weightBillableKg,
      tonBillable: output.meta.tonBillable,
    },
    
    components: {
      baseCost,
      baseFreight: output.revenue.baseFreight,
      toll: output.revenue.toll,
      gris: output.revenue.gris,
      tso: output.revenue.tso,
      rctrc: output.revenue.rctrc,
      adValorem: output.revenue.adValorem,
      tde: output.revenue.ntc.tde,
      tear: output.revenue.ntc.tear,
      conditionalFeesTotal: additionalFees?.conditionalFeesTotal ?? 0,
      waitingTimeCost: additionalFees?.waitingTimeCost ?? 0,
    },
    
    totals: {
      receitaBruta: output.revenue.receitaBruta,
      das: output.taxes.das,
      icms: output.taxes.icms,
      totalImpostos: output.taxes.totalImpostos,
      totalCliente: output.totals.totalCliente,
    },
    
    profitability: {
      custosDiretos: output.profit.custosDiretos,
      margemBruta: output.profit.margemBruta,
      overhead: output.profit.overhead,
      resultadoLiquido: output.profit.resultadoLiquido,
      margemPercent: output.profit.margemPercent,
    },
    
    rates: {
      dasPercent: output.taxes.dasPercent,
      markupPercent,
      icmsPercent: output.taxes.icmsPercent,
      grisPercent: priceRow.gris_percent,
      tsoPercent: priceRow.tso_percent,
      costValuePercent: priceRow.cost_value_percent,
      overheadPercent,
    },
  };
}
