import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
}

interface FreightBreakdown {
  weight_real: number;
  weight_cubed: number;
  weight_billable: number;
  base_freight: number;
  gris: number;
  ad_valorem: number;
  toll: number;
  tac_adjustment: number;
  icms: number;
  waiting_time: number;
  conditional_fees: Record<string, number>;
  payment_adjustment: number;
  subtotal: number;
  total: number;
}

interface ParametersUsed {
  cubage_factor: number;
  icms_rate: number;
  tac_percent: number;
  payment_term: string;
  vehicle_type: string | null;
}

interface CalculateFreightResponse {
  success: boolean;
  breakdown: FreightBreakdown;
  parameters_used: ParametersUsed;
  fallbacks_applied: string[];
  errors: string[];
}

// =====================================================
// FALLBACK CONSTANTS
// =====================================================

const FALLBACK = {
  CUBAGE_FACTOR: 300,
  ICMS_RATE: 12,
  TAC_PERCENT: 0,
  WAITING_FREE_HOURS: 6,
  WAITING_RATE_PER_HOUR: 50,
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

    // Validate required fields
    const errors: string[] = [];
    if (!input.origin) errors.push('Campo "origin" é obrigatório');
    if (!input.destination) errors.push('Campo "destination" é obrigatório');
    if (input.weight_kg === undefined || input.weight_kg < 0) errors.push('Campo "weight_kg" é obrigatório e deve ser >= 0');
    if (input.volume_m3 === undefined || input.volume_m3 < 0) errors.push('Campo "volume_m3" é obrigatório e deve ser >= 0');
    if (input.cargo_value === undefined || input.cargo_value < 0) errors.push('Campo "cargo_value" é obrigatório e deve ser >= 0');

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ success: false, errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fallbacksApplied: string[] = [];

    // =====================================================
    // 1. GET CUBAGE FACTOR
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

    // Calculate weights
    const weightReal = input.weight_kg;
    const weightCubed = input.volume_m3 * cubageFactor;
    const weightBillable = Math.max(weightReal, weightCubed);

    // =====================================================
    // 2. GET PRICE TABLE ROW (base freight calculation)
    // =====================================================
    let baseFreight = 0;
    let grisPercent = 0;
    let adValoremPercent = 0;

    if (input.price_table_id && input.km_distance !== undefined) {
      const { data: priceRow } = await supabase
        .from('price_table_rows')
        .select('*')
        .eq('price_table_id', input.price_table_id)
        .lte('km_from', input.km_distance)
        .gte('km_to', input.km_distance)
        .maybeSingle();

      if (priceRow) {
        // Calculate base freight based on weight
        if (priceRow.cost_per_kg) {
          baseFreight = weightBillable * Number(priceRow.cost_per_kg);
        } else if (priceRow.cost_per_ton) {
          baseFreight = (weightBillable / 1000) * Number(priceRow.cost_per_ton);
        }

        grisPercent = priceRow.gris_percent ? Number(priceRow.gris_percent) : 0;
        adValoremPercent = priceRow.ad_valorem_percent ? Number(priceRow.ad_valorem_percent) : 0;
      } else {
        fallbacksApplied.push(`price_table_row: nenhuma faixa encontrada para ${input.km_distance} km`);
      }
    } else {
      fallbacksApplied.push('price_table: não informada ou km_distance ausente');
    }

    // Calculate GRIS and Ad Valorem
    const grisValue = (input.cargo_value * grisPercent) / 100;
    const adValoremValue = (input.cargo_value * adValoremPercent) / 100;

    // =====================================================
    // 3. GET TOLL VALUE
    // =====================================================
    let tollValue = 0;
    const originState = extractStateFromLocation(input.origin);
    const originCity = extractCityFromLocation(input.origin);
    const destState = extractStateFromLocation(input.destination);
    const destCity = extractCityFromLocation(input.destination);

    if (originState && destState) {
      // Try exact match first (with cities)
      let { data: tollRoute } = await supabase
        .from('toll_routes')
        .select('toll_value')
        .eq('origin_state', originState)
        .eq('destination_state', destState)
        .or(`origin_city.eq.${originCity},origin_city.is.null`)
        .or(`destination_city.eq.${destCity},destination_city.is.null`)
        .order('origin_city', { ascending: false, nullsFirst: false })
        .order('destination_city', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (tollRoute?.toll_value) {
        tollValue = Number(tollRoute.toll_value);
      } else {
        fallbacksApplied.push(`toll_routes: rota ${originState} → ${destState} não encontrada, usando 0`);
      }
    }

    // =====================================================
    // 4. GET TAC (diesel adjustment)
    // =====================================================
    let tacPercent = FALLBACK.TAC_PERCENT;
    const today = new Date().toISOString().split('T')[0];

    const { data: tacRate } = await supabase
      .from('tac_rates')
      .select('adjustment_percent')
      .lte('reference_date', today)
      .order('reference_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tacRate?.adjustment_percent !== undefined) {
      tacPercent = Number(tacRate.adjustment_percent);
    } else {
      fallbacksApplied.push(`tac_rates: sem registro válido, usando ${FALLBACK.TAC_PERCENT}%`);
    }

    // =====================================================
    // 5. GET ICMS RATE
    // =====================================================
    let icmsRate = FALLBACK.ICMS_RATE;

    if (originState && destState) {
      const { data: icmsRow } = await supabase
        .from('icms_rates')
        .select('rate_percent')
        .eq('origin_state', originState)
        .eq('destination_state', destState)
        .maybeSingle();

      if (icmsRow?.rate_percent !== undefined) {
        icmsRate = Number(icmsRow.rate_percent);
      } else {
        fallbacksApplied.push(`icms_rates: ${originState} → ${destState} não encontrada, usando ${FALLBACK.ICMS_RATE}%`);
      }
    }

    // =====================================================
    // 6. GET WAITING TIME COST
    // =====================================================
    let waitingTimeCost = 0;
    let vehicleTypeId: string | null = null;

    if (input.vehicle_type_code) {
      const { data: vehicleType } = await supabase
        .from('vehicle_types')
        .select('id')
        .eq('code', input.vehicle_type_code)
        .eq('active', true)
        .maybeSingle();
      vehicleTypeId = vehicleType?.id || null;
    }

    if (input.waiting_hours !== undefined && input.waiting_hours > 0) {
      // Try to find specific rule for vehicle type
      let waitingRule = null;
      
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
        const excessHours = Math.max(0, input.waiting_hours - freeHours);
        
        if (excessHours > 0) {
          const ratePerHour = Number(waitingRule.rate_per_hour) || FALLBACK.WAITING_RATE_PER_HOUR;
          waitingTimeCost = excessHours * ratePerHour;
          
          // Apply minimum charge if configured
          if (waitingRule.min_charge && waitingTimeCost < Number(waitingRule.min_charge)) {
            waitingTimeCost = Number(waitingRule.min_charge);
          }
        }
      } else {
        // Use fallback values
        const excessHours = Math.max(0, input.waiting_hours - FALLBACK.WAITING_FREE_HOURS);
        waitingTimeCost = excessHours * FALLBACK.WAITING_RATE_PER_HOUR;
        fallbacksApplied.push(`waiting_time_rules: usando fallback ${FALLBACK.WAITING_FREE_HOURS}h franquia + R$${FALLBACK.WAITING_RATE_PER_HOUR}/h`);
      }
    }

    // =====================================================
    // 7. GET CONDITIONAL FEES
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
          const baseValue = fee.applies_to === 'cargo_value' ? input.cargo_value : baseFreight;

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

          // Apply min/max limits
          if (fee.min_value && feeValue < Number(fee.min_value)) {
            feeValue = Number(fee.min_value);
          }
          if (fee.max_value && feeValue > Number(fee.max_value)) {
            feeValue = Number(fee.max_value);
          }

          conditionalFeesBreakdown[feeCode] = Math.round(feeValue * 100) / 100;
          conditionalFeesTotal += feeValue;
        } else {
          fallbacksApplied.push(`conditional_fee: "${feeCode}" não encontrada ou inativa, ignorada`);
        }
      }
    }

    // =====================================================
    // 8. GET PAYMENT TERM ADJUSTMENT
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
    // 9. CALCULATE TOTALS
    // =====================================================
    
    // Subtotal before ICMS and payment adjustment
    const subtotalBeforeICMS = baseFreight + grisValue + adValoremValue + tollValue + waitingTimeCost + conditionalFeesTotal;
    
    // Apply TAC adjustment
    const tacAdjustment = (subtotalBeforeICMS * tacPercent) / 100;
    const subtotalWithTAC = subtotalBeforeICMS + tacAdjustment;
    
    // Apply payment term adjustment
    const paymentAdjustment = (subtotalWithTAC * paymentAdjustmentPercent) / 100;
    const subtotalWithPayment = subtotalWithTAC + paymentAdjustment;
    
    // Calculate ICMS (grossing up: value / (1 - icms_rate/100))
    const icmsMultiplier = 1 / (1 - icmsRate / 100);
    const totalWithICMS = subtotalWithPayment * icmsMultiplier;
    const icmsValue = totalWithICMS - subtotalWithPayment;

    // Round all values to 2 decimal places
    const breakdown: FreightBreakdown = {
      weight_real: Math.round(weightReal * 100) / 100,
      weight_cubed: Math.round(weightCubed * 100) / 100,
      weight_billable: Math.round(weightBillable * 100) / 100,
      base_freight: Math.round(baseFreight * 100) / 100,
      gris: Math.round(grisValue * 100) / 100,
      ad_valorem: Math.round(adValoremValue * 100) / 100,
      toll: Math.round(tollValue * 100) / 100,
      tac_adjustment: Math.round(tacAdjustment * 100) / 100,
      icms: Math.round(icmsValue * 100) / 100,
      waiting_time: Math.round(waitingTimeCost * 100) / 100,
      conditional_fees: conditionalFeesBreakdown,
      payment_adjustment: Math.round(paymentAdjustment * 100) / 100,
      subtotal: Math.round(subtotalWithPayment * 100) / 100,
      total: Math.round(totalWithICMS * 100) / 100,
    };

    const parametersUsed: ParametersUsed = {
      cubage_factor: cubageFactor,
      icms_rate: icmsRate,
      tac_percent: tacPercent,
      payment_term: paymentTermCode,
      vehicle_type: input.vehicle_type_code || null,
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
    console.error('[calculate-freight] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        errors: [`Erro interno: ${error.message}`],
        breakdown: null,
        parameters_used: null,
        fallbacks_applied: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
