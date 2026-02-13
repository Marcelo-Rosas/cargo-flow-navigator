/// <reference path="./deno.d.ts" />
import { serve } from "std/server";
import { createClient } from "supabase";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// =====================================================
// TYPES
// =====================================================

interface CalculateFreightInput {
  origin: string;
  destination: string;
  weight_kg: number;
  volume_m3: number;
  cargo_value: number;
  km_distance?: number;
  price_table_id?: string;
  vehicle_type_code?: string;
  payment_term_code?: string;
  conditional_fees?: string[];
  waiting_hours?: number;
  is_return?: boolean;
}

interface FreightBreakdown {
  weight_real: number;
  weight_cubed: number;
  weight_billable: number;
  base_freight: number;
  correction_factor: number;
  base_freight_adjusted: number;
  tac_adjustment: number;
  gris: number;
  ad_valorem: number;
  toll: number;
  waiting_time: number;
  conditional_fees: Record<string, number>;
  subtotal: number;
  payment_adjustment: number;
  icms_base: number;
  icms: number;
  total: number;
}

interface ParametersUsed {
  cubage_factor: number;
  correction_factor_inctf: number;
  icms_rate: number;
  tac_percent: number;
  diesel_variation_percent: number;
  tac_steps: number;
  payment_term: string;
  vehicle_type: string | null;
  waiting_free_hours: number;
}

interface CalculateFreightResponse {
  success: boolean;
  breakdown: FreightBreakdown;
  parameters_used: ParametersUsed;
  fallbacks_applied: string[];
  errors: string[];
}

// =====================================================
// FALLBACK CONSTANTS (NTC Planilha Referencial)
// =====================================================

const FALLBACK = {
  CUBAGE_FACTOR: 300,          // kg/m³ (NTC 2.1)
  ICMS_RATE: 12,               // % padrão interestadual
  CORRECTION_FACTOR: 1.0,      // sem correção se não encontrar
  WAITING_FREE_HOURS: 5,       // NTC 2.3: franquia 5h estadia
  WAITING_RATE_PER_HOUR: 146.44, // NTC: Caminhão Truck hora parada
  WAITING_RATE_PER_DAY: 1317.95, // NTC: Caminhão Truck diária
  PAYMENT_TERM_CODE: 'D30',
  PAYMENT_TERM_ADJUSTMENT: 1.5,
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function extractStateFromLocation(location: string): string | null {
  const match = location.match(/\s*-\s*([A-Z]{2})\s*$/i);
  return match ? match[1].toUpperCase() : null;
}

function extractCityFromLocation(location: string): string | null {
  const match = location.match(/^(.+?)\s*-\s*[A-Z]{2}\s*$/i);
  return match ? match[1].trim() : null;
}

function sanitizeCityName(city: string | null): string | null {
  if (!city) return null;
  return city.replace(/[,()]/g, '');
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const input: CalculateFreightInput = await req.json();
    console.log('[calculate-freight] Input:', JSON.stringify(input));

    // =====================================================
    // VALIDATION
    // =====================================================
    const errors: string[] = [];
    if (!input.origin) errors.push('Campo "origin" é obrigatório');
    if (!input.destination) errors.push('Campo "destination" é obrigatório');
    if (input.weight_kg === undefined || input.weight_kg < 0) errors.push('Campo "weight_kg" é obrigatório e deve ser >= 0');
    if (input.volume_m3 === undefined || input.volume_m3 < 0) errors.push('Campo "volume_m3" é obrigatório e deve ser >= 0');
    if (input.cargo_value === undefined || input.cargo_value < 0) errors.push('Campo "cargo_value" é obrigatório e deve ser >= 0');
    if (input.weight_kg === 0 && input.volume_m3 === 0) errors.push('weight_kg e volume_m3 não podem ser ambos zero');
    if (!input.price_table_id) errors.push('Campo "price_table_id" é obrigatório para cálculo do frete base');
    if (input.km_distance === undefined || input.km_distance <= 0) errors.push('Campo "km_distance" é obrigatório e deve ser > 0');

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ success: false, errors, breakdown: null, parameters_used: null, fallbacks_applied: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fallbacksApplied: string[] = [];
    const today = new Date().toISOString().split('T')[0];

    // =====================================================
    // 1. CUBAGEM (NTC 2.1)
    // Peso Cubado = volume × 300 kg/m³
    // Peso Cobrável = MAX(real, cubado)
    // =====================================================
    let cubageFactor = FALLBACK.CUBAGE_FACTOR;
    const { data: cubageParam } = await supabase
      .from('pricing_parameters')
      .select('value')
      .eq('key', 'cubage_factor')
      .maybeSingle();

    if (cubageParam?.value) {
      cubageFactor = Number(cubageParam.value);
    } else {
      fallbacksApplied.push(`cubage_factor: usando fallback ${FALLBACK.CUBAGE_FACTOR} kg/m³`);
    }

    const weightReal = input.weight_kg;
    const weightCubed = input.volume_m3 * cubageFactor;
    const weightBillable = Math.max(weightReal, weightCubed);

    // =====================================================
    // 2. FRETE BASE (por tabela de preço × faixa de km)
    // =====================================================
    let baseFreight = 0;
    let grisPercent = 0;
    let adValoremPercent = 0;

    const { data: priceRows, error: priceError } = await supabase
      .from('price_table_rows')
      .select('*')
      .eq('price_table_id', input.price_table_id)
      .lte('km_from', input.km_distance!)
      .gte('km_to', input.km_distance!);

    if (priceError) {
      fallbacksApplied.push(`price_table_rows: erro na consulta - ${priceError.message}`);
    } else if (priceRows && priceRows.length > 0) {
      const priceRow = priceRows[0];

      if (priceRow.cost_per_kg) {
        baseFreight = weightBillable * Number(priceRow.cost_per_kg);
      } else if (priceRow.cost_per_ton) {
        baseFreight = (weightBillable / 1000) * Number(priceRow.cost_per_ton);
      }

      grisPercent = priceRow.gris_percent != null ? Number(priceRow.gris_percent) : 0;
      adValoremPercent = priceRow.ad_valorem_percent != null ? Number(priceRow.ad_valorem_percent) : 0;

      if (priceRows.length > 1) {
        fallbacksApplied.push(`price_table_rows: ${priceRows.length} faixas sobrepostas para ${input.km_distance} km, usando primeira`);
      }
    } else {
      fallbacksApplied.push(`price_table_row: nenhuma faixa encontrada para ${input.km_distance} km`);
    }

    // =====================================================
    // 3. FATOR DE CORREÇÃO INCTF (NTC seção 4)
    // Frete base ajustado = frete base × fator
    // =====================================================
    let correctionFactor = FALLBACK.CORRECTION_FACTOR;
    const { data: correctionParam } = await supabase
      .from('pricing_parameters')
      .select('value')
      .eq('key', 'correction_factor_inctf')
      .maybeSingle();

    if (correctionParam?.value) {
      correctionFactor = Number(correctionParam.value);
    } else {
      fallbacksApplied.push('correction_factor_inctf: não encontrado, usando 1.0 (sem correção)');
    }

    const baseFreightAdjusted = baseFreight * correctionFactor;

    // =====================================================
    // 4. TAC — Taxa de Acompanhamento de Combustível (NTC 2.6)
    // Fórmula NTC: para cada 5% de variação do diesel → 1,75% sobre frete peso
    // Base: frete peso ajustado (EXCLUI pedágio, GRIS, ad valorem, espera)
    // =====================================================
    let tacPercent = 0;
    let dieselVariationPercent = 0;
    let tacSteps = 0;

    const { data: tacRate } = await supabase
      .from('tac_rates')
      .select('variation_percent')
      .lte('reference_date', today)
      .order('reference_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tacRate?.variation_percent != null) {
      dieselVariationPercent = Number(tacRate.variation_percent);
      if (dieselVariationPercent >= 5) {
        tacSteps = Math.floor(dieselVariationPercent / 5);
        tacPercent = tacSteps * 1.75;
      }
    } else {
      fallbacksApplied.push('tac_rates: sem registro válido, TAC = 0%');
    }

    const tacValue = round2((baseFreightAdjusted * tacPercent) / 100);

    // =====================================================
    // 5. GRIS e Ad Valorem (sobre valor da carga)
    // =====================================================
    const grisValue = round2((input.cargo_value * grisPercent) / 100);
    const adValoremValue = round2((input.cargo_value * adValoremPercent) / 100);

    // =====================================================
    // 6. PEDÁGIO (NTC seção 5 — reembolso, separado)
    // =====================================================
    let tollValue = 0;
    const originState = extractStateFromLocation(input.origin);
    const safeOriginCity = sanitizeCityName(extractCityFromLocation(input.origin));
    const destState = extractStateFromLocation(input.destination);
    const safeDestCity = sanitizeCityName(extractCityFromLocation(input.destination));

    if (originState && destState) {
      const { data: tollRoute } = await supabase
        .from('toll_routes')
        .select('toll_value')
        .eq('origin_state', originState)
        .eq('destination_state', destState)
        .or(safeOriginCity ? `origin_city.eq.${safeOriginCity},origin_city.is.null` : 'origin_city.is.null')
        .or(safeDestCity ? `destination_city.eq.${safeDestCity},destination_city.is.null` : 'destination_city.is.null')
        .order('origin_city', { ascending: false, nullsFirst: false })
        .order('destination_city', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (tollRoute?.toll_value != null) {
        tollValue = Number(tollRoute.toll_value);
      } else {
        fallbacksApplied.push(`toll_routes: rota ${originState} → ${destState} não encontrada, usando 0`);
      }
    }

    // =====================================================
    // 7. ESTADIA / HORA PARADA (NTC 2.3)
    // Franquia: 5 horas
    // Cobrança: por hora ou diária, conforme tipo de veículo
    // =====================================================
    let waitingTimeCost = 0;
    let vehicleTypeId: string | null = null;
    let waitingFreeHours = FALLBACK.WAITING_FREE_HOURS;

    if (input.vehicle_type_code) {
      const { data: vehicleType } = await supabase
        .from('vehicle_types')
        .select('id')
        .eq('code', input.vehicle_type_code)
        .eq('active', true)
        .maybeSingle();
      vehicleTypeId = vehicleType?.id || null;
    }

    if (input.waiting_hours != null && input.waiting_hours > 0) {
      let waitingRule = null;

      // Try vehicle-specific rule first
      if (vehicleTypeId) {
        const { data } = await supabase
          .from('waiting_time_rules')
          .select('*')
          .eq('vehicle_type_id', vehicleTypeId)
          .maybeSingle();
        waitingRule = data;
      }

      // Fallback to default rule (vehicle_type_id IS NULL)
      if (!waitingRule) {
        const { data } = await supabase
          .from('waiting_time_rules')
          .select('*')
          .is('vehicle_type_id', null)
          .maybeSingle();
        waitingRule = data;
      }

      if (waitingRule) {
        const freeHours = Number(waitingRule.free_hours) || FALLBACK.WAITING_FREE_HOURS;
        waitingFreeHours = freeHours;
        const excessHours = Math.max(0, input.waiting_hours - freeHours);

        if (excessHours > 0) {
          const ratePerHour = Number(waitingRule.rate_per_hour) || FALLBACK.WAITING_RATE_PER_HOUR;
          const ratePerDay = waitingRule.rate_per_day != null ? Number(waitingRule.rate_per_day) : null;

          // NTC: se excede 24h da franquia, cobrar diária inteira
          if (ratePerDay && excessHours >= 24) {
            const fullDays = Math.ceil(excessHours / 24);
            waitingTimeCost = fullDays * ratePerDay;
          } else {
            waitingTimeCost = excessHours * ratePerHour;
          }

          // Apply minimum charge
          if (waitingRule.min_charge != null && waitingTimeCost < Number(waitingRule.min_charge)) {
            waitingTimeCost = Number(waitingRule.min_charge);
          }
        }
      } else {
        // Fallback NTC values
        const excessHours = Math.max(0, input.waiting_hours - FALLBACK.WAITING_FREE_HOURS);
        waitingTimeCost = excessHours * FALLBACK.WAITING_RATE_PER_HOUR;
        fallbacksApplied.push(`waiting_time_rules: usando fallback NTC ${FALLBACK.WAITING_FREE_HOURS}h franquia + R$${FALLBACK.WAITING_RATE_PER_HOUR}/h`);
      }
    }

    // =====================================================
    // 8. TAXAS CONDICIONAIS (NTC 2.4, 2.5, 2.7, 3.1, 3.2)
    // Base: frete base ajustado (para taxas 'freight')
    // =====================================================
    const conditionalFeesBreakdown: Record<string, number> = {};
    let conditionalFeesTotal = 0;

    if (input.conditional_fees && input.conditional_fees.length > 0) {
      const { data: fees } = await supabase
        .from('conditional_fees')
        .select('*')
        .in('code', input.conditional_fees)
        .eq('active', true);

      for (const feeCode of input.conditional_fees) {
        const fee = fees?.find(f => f.code === feeCode);

        if (fee) {
          let feeValue = 0;

          // Determine base value based on applies_to
          let baseValue: number;
          switch (fee.applies_to) {
            case 'cargo_value':
              baseValue = input.cargo_value;
              break;
            case 'freight':
              baseValue = baseFreightAdjusted; // NTC: % sobre frete base ajustado
              break;
            case 'total':
              baseValue = baseFreightAdjusted + tacValue + grisValue + adValoremValue;
              break;
            default:
              baseValue = baseFreightAdjusted;
          }

          switch (fee.fee_type) {
            case 'percentage':
              feeValue = (baseValue * Number(fee.fee_value)) / 100;
              break;
            case 'fixed':
              feeValue = Number(fee.fee_value);
              break;
            case 'per_kg':
              feeValue = weightBillable * Number(fee.fee_value);
              break;
          }

          // Apply min/max limits (fix: use != null instead of falsy check)
          if (fee.min_value != null && feeValue < Number(fee.min_value)) {
            feeValue = Number(fee.min_value);
          }
          if (fee.max_value != null && feeValue > Number(fee.max_value)) {
            feeValue = Number(fee.max_value);
          }

          const roundedFee = round2(feeValue);
          conditionalFeesBreakdown[feeCode] = roundedFee;
          conditionalFeesTotal += roundedFee;
        } else {
          fallbacksApplied.push(`conditional_fee: "${feeCode}" não encontrada ou inativa, ignorada`);
        }
      }
    }

    // =====================================================
    // 9. PRAZO DE PAGAMENTO
    // =====================================================
    let paymentTermCode = input.payment_term_code || FALLBACK.PAYMENT_TERM_CODE;
    let paymentAdjustmentPercent = FALLBACK.PAYMENT_TERM_ADJUSTMENT;

    const { data: paymentTerm } = await supabase
      .from('payment_terms')
      .select('code, adjustment_percent')
      .eq('code', paymentTermCode)
      .eq('active', true)
      .maybeSingle();

    if (paymentTerm) {
      paymentAdjustmentPercent = Number(paymentTerm.adjustment_percent);
      paymentTermCode = paymentTerm.code;
    } else {
      if (input.payment_term_code) {
        fallbacksApplied.push(`payment_term: "${input.payment_term_code}" não encontrada, usando ${FALLBACK.PAYMENT_TERM_CODE}`);
      }
      paymentTermCode = FALLBACK.PAYMENT_TERM_CODE;
    }

    // =====================================================
    // 10. ICMS RATE
    // =====================================================
    let icmsRate = FALLBACK.ICMS_RATE;

    if (originState && destState) {
      const { data: icmsRow } = await supabase
        .from('icms_rates')
        .select('rate_percent')
        .eq('origin_state', originState)
        .eq('destination_state', destState)
        .maybeSingle();

      if (icmsRow?.rate_percent != null) {
        icmsRate = Number(icmsRow.rate_percent);
      } else {
        fallbacksApplied.push(`icms_rates: ${originState} → ${destState} não encontrada, usando ${FALLBACK.ICMS_RATE}%`);
      }
    }

    // Validate ICMS rate to prevent division by zero
    if (icmsRate >= 100) {
      fallbacksApplied.push(`icms_rate ${icmsRate}% é inválida (>= 100%), usando fallback ${FALLBACK.ICMS_RATE}%`);
      icmsRate = FALLBACK.ICMS_RATE;
    }

    // =====================================================
    // 11. CÁLCULO FINAL (NTC — Nova Ordem)
    //
    // 1. Frete base ajustado = frete base × fator correção INCTF
    // 2. TAC = frete base ajustado × tac% (só sobre frete peso)
    // 3. GRIS + Ad Valorem sobre valor da carga
    // 4. Estadia por tipo de veículo
    // 5. Taxas condicionais sobre frete base ajustado
    // 6. Pedágio = reembolso separado
    // 7. Subtotal = soma de tudo
    // 8. Ajuste prazo pagamento sobre subtotal
    // 9. ICMS "por dentro" sobre (subtotal + ajuste - pedágio)
    // 10. Total = subtotal + ajuste + ICMS
    // =====================================================

    // Subtotal (all components)
    const subtotal = round2(
      baseFreightAdjusted +
      tacValue +
      grisValue +
      adValoremValue +
      tollValue +
      waitingTimeCost +
      conditionalFeesTotal
    );

    // Payment term adjustment on subtotal
    const paymentAdjustment = round2((subtotal * paymentAdjustmentPercent) / 100);
    const subtotalWithPayment = round2(subtotal + paymentAdjustment);

    // ICMS base = subtotal with payment EXCLUDING toll (pedágio é reembolso)
    const icmsBase = round2(subtotalWithPayment - tollValue);

    // ICMS "por dentro" (gross-up): base / (1 - rate/100) - base
    const icmsValue = round2(icmsBase / (1 - icmsRate / 100) - icmsBase);

    // Total final
    const total = round2(subtotalWithPayment + icmsValue);

    // =====================================================
    // BUILD RESPONSE
    // =====================================================
    const breakdown: FreightBreakdown = {
      weight_real: round2(weightReal),
      weight_cubed: round2(weightCubed),
      weight_billable: round2(weightBillable),
      base_freight: round2(baseFreight),
      correction_factor: correctionFactor,
      base_freight_adjusted: round2(baseFreightAdjusted),
      tac_adjustment: tacValue,
      gris: grisValue,
      ad_valorem: adValoremValue,
      toll: round2(tollValue),
      waiting_time: round2(waitingTimeCost),
      conditional_fees: conditionalFeesBreakdown,
      subtotal,
      payment_adjustment: paymentAdjustment,
      icms_base: icmsBase,
      icms: icmsValue,
      total,
    };

    const parametersUsed: ParametersUsed = {
      cubage_factor: cubageFactor,
      correction_factor_inctf: correctionFactor,
      icms_rate: icmsRate,
      tac_percent: tacPercent,
      diesel_variation_percent: dieselVariationPercent,
      tac_steps: tacSteps,
      payment_term: paymentTermCode,
      vehicle_type: input.vehicle_type_code || null,
      waiting_free_hours: waitingFreeHours,
    };

    const response: CalculateFreightResponse = {
      success: true,
      breakdown,
      parameters_used: parametersUsed,
      fallbacks_applied: fallbacksApplied,
      errors: [],
    };

    console.log('[calculate-freight] Response:', JSON.stringify(response));

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[calculate-freight] Error:', message);
    return new Response(
      JSON.stringify({
        success: false,
        errors: [`Erro interno: ${message}`],
        breakdown: null,
        parameters_used: null,
        fallbacks_applied: [],
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
