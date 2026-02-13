import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';
import {
  FREIGHT_CONSTANTS,
  type CalculateFreightInput,
  type CalculateFreightResponse,
  type FreightMeta,
  type FreightComponents,
  type FreightRates,
  type FreightTotals,
  type FreightProfitability,
  extractUf,
  extractCity,
  formatRouteUf,
  normalizeIcmsRate,
  calculateCubageWeight,
  calculateBillableWeight,
  roundCurrency,
  getMarginStatus,
} from '../_shared/freight-types.ts';

// =====================================================
// MAIN HANDLER
// =====================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const input: CalculateFreightInput = await req.json();
    console.log('[calculate-freight] Request:', input.origin, '→', input.destination, `${input.km_distance}km`);

    const fallbacksApplied: string[] = [];
    const errors: string[] = [];

    // =====================================================
    // VALIDATION
    // =====================================================
    
    if (!input.origin) errors.push('Campo "origin" é obrigatório');
    if (!input.destination) errors.push('Campo "destination" é obrigatório');
    if (input.weight_kg === undefined || input.weight_kg < 0) errors.push('Campo "weight_kg" inválido');
    if (input.volume_m3 === undefined || input.volume_m3 < 0) errors.push('Campo "volume_m3" inválido');
    if (input.cargo_value === undefined || input.cargo_value < 0) errors.push('Campo "cargo_value" inválido');
    if (input.weight_kg === 0 && input.volume_m3 === 0) errors.push('weight_kg e volume_m3 não podem ser ambos zero');

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ success: false, status: 'MISSING_DATA', errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // GET GLOBAL PARAMETERS
    // =====================================================
    
    const { data: allParams } = await supabase
      .from('pricing_parameters')
      .select('key, value');

    const paramsMap = new Map<string, number>();
    allParams?.forEach(p => paramsMap.set(p.key, Number(p.value)));

    const cubageFactor = paramsMap.get('cubage_factor') ?? FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3;
    const dasPercent = input.das_percent ?? paramsMap.get('das_percent') ?? FREIGHT_CONSTANTS.DEFAULT_DAS_PERCENT;
    const markupPercent = input.markup_percent ?? paramsMap.get('markup_percent') ?? FREIGHT_CONSTANTS.DEFAULT_MARKUP_PERCENT;
    const overheadPercent = input.overhead_percent ?? paramsMap.get('overhead_percent') ?? FREIGHT_CONSTANTS.DEFAULT_OVERHEAD_PERCENT;
    const carreteiroPercent = input.carreteiro_percent ?? paramsMap.get('carreteiro_percent') ?? 0;
    const descargaValue = input.descarga_value ?? 0;

    const correctionFactor = paramsMap.get('correction_factor_inctf') ?? 1.0;

    if (!paramsMap.has('das_percent')) fallbacksApplied.push(`das_percent: usando default ${FREIGHT_CONSTANTS.DEFAULT_DAS_PERCENT}%`);
    if (!paramsMap.has('markup_percent')) fallbacksApplied.push(`markup_percent: usando default ${FREIGHT_CONSTANTS.DEFAULT_MARKUP_PERCENT}%`);
    if (!paramsMap.has('correction_factor_inctf')) fallbacksApplied.push('correction_factor_inctf: não encontrado, usando 1.0');

    // =====================================================
    // CALCULATE WEIGHTS
    // =====================================================
    
    const cubageWeightKg = input.volume_m3 * cubageFactor;
    const billableWeightKg = Math.max(input.weight_kg, cubageWeightKg);

    // =====================================================
    // GET PRICE TABLE ROW
    // =====================================================
    
    let baseCost = 0;
    let grisPercent = 0;
    let tsoPercent = 0;
    let costValuePercent = 0;
    let kmBandLabel: string | null = null;
    let kmStatus: 'OK' | 'OUT_OF_RANGE' = 'OK';

    if (input.price_table_id && input.km_distance !== undefined) {
      const { data: priceRow } = await supabase
        .from('price_table_rows')
        .select('*')
        .eq('price_table_id', input.price_table_id)
        .lte('km_from', input.km_distance)
        .gte('km_to', input.km_distance)
        .maybeSingle();

      if (priceRow) {
        kmBandLabel = `${priceRow.km_from}-${priceRow.km_to}`;
        
        // FOB Lotação: usar cost_per_ton
        const costPerTon = Number(priceRow.cost_per_ton) || 0;
        baseCost = (billableWeightKg / 1000) * costPerTon;

        grisPercent = Number(priceRow.gris_percent) || 0;
        tsoPercent = Number(priceRow.tso_percent) || 0;
        costValuePercent = Number(priceRow.cost_value_percent) || 0;

        console.log(`[calculate-freight] Faixa: ${kmBandLabel}, cost_per_ton: ${costPerTon}, baseCost: ${baseCost}`);
      } else {
        kmStatus = 'OUT_OF_RANGE';
        fallbacksApplied.push(`price_table_row: nenhuma faixa para ${input.km_distance} km`);
      }
    } else {
      fallbacksApplied.push('price_table: não informada');
    }

    // =====================================================
    // CALCULATE BASE FREIGHT (with INCTF correction + MARKUP)
    // =====================================================

    const baseCostAdjusted = baseCost * correctionFactor;
    const baseFreight = baseCostAdjusted * (1 + markupPercent / 100);

    // =====================================================
    // CALCULATE COMPONENTS ON CARGO VALUE
    // =====================================================
    
    const gris = input.cargo_value * (grisPercent / 100);
    const tso = input.cargo_value * (tsoPercent / 100);
    const rctrc = input.cargo_value * (costValuePercent / 100);
    const adValorem = 0; // Sempre 0 (TSO substitui)

    // =====================================================
    // TOLL VALUE (manual)
    // =====================================================
    
    const toll = input.toll_value ?? 0;

    // =====================================================
    // NTC FEES (TDE/TEAR - 20% sobre baseFreight)
    // =====================================================
    
    const tde = input.tde_enabled ? baseFreight * (FREIGHT_CONSTANTS.NTC_TDE_PERCENT / 100) : 0;
    const tear = input.tear_enabled ? baseFreight * (FREIGHT_CONSTANTS.NTC_TEAR_PERCENT / 100) : 0;

    // =====================================================
    // CONDITIONAL FEES
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
          const feeBase = fee.applies_to === 'cargo_value' ? input.cargo_value : baseFreight;

          switch (fee.fee_type) {
            case 'percentage':
              feeValue = (feeBase * Number(fee.fee_value)) / 100;
              break;
            case 'fixed':
              feeValue = Number(fee.fee_value);
              break;
            case 'per_kg':
              feeValue = billableWeightKg * Number(fee.fee_value);
              break;
          }

          // Apply min/max (use != null to avoid falsy-zero bug)
          if (fee.min_value != null && feeValue < Number(fee.min_value)) feeValue = Number(fee.min_value);
          if (fee.max_value != null && feeValue > Number(fee.max_value)) feeValue = Number(fee.max_value);

          conditionalFeesBreakdown[feeCode] = roundCurrency(feeValue);
          conditionalFeesTotal += feeValue;
        } else {
          fallbacksApplied.push(`conditional_fee: "${feeCode}" não encontrada`);
        }
      }
    }

    // =====================================================
    // WAITING TIME
    // =====================================================
    
    let waitingTimeCost = 0;
    let vehicleTypeId: string | null = null;

    if (input.vehicle_type_code) {
      const { data: vt } = await supabase
        .from('vehicle_types')
        .select('id')
        .eq('code', input.vehicle_type_code)
        .eq('active', true)
        .maybeSingle();
      vehicleTypeId = vt?.id ?? null;
    }

    if (input.waiting_hours !== undefined && input.waiting_hours > 0) {
      let waitingRule = null;

      if (vehicleTypeId) {
        const { data } = await supabase
          .from('waiting_time_rules')
          .select('*')
          .eq('vehicle_type_id', vehicleTypeId)
          .maybeSingle();
        waitingRule = data;
      }

      if (!waitingRule) {
        const { data } = await supabase
          .from('waiting_time_rules')
          .select('*')
          .is('vehicle_type_id', null)
          .maybeSingle();
        waitingRule = data;
      }

      if (waitingRule) {
        const freeHours = Number(waitingRule.free_hours) || 5; // NTC 2.3: 5h franquia
        const excessHours = Math.max(0, input.waiting_hours - freeHours);

        if (excessHours > 0) {
          const ratePerHour = Number(waitingRule.rate_per_hour) || 146.44; // NTC: Truck
          const ratePerDay = waitingRule.rate_per_day != null ? Number(waitingRule.rate_per_day) : null;

          // NTC: se excede 24h da franquia, cobrar diária inteira
          if (ratePerDay && excessHours >= 24) {
            const fullDays = Math.ceil(excessHours / 24);
            waitingTimeCost = fullDays * ratePerDay;
          } else {
            waitingTimeCost = excessHours * ratePerHour;
          }

          if (waitingRule.min_charge != null && waitingTimeCost < Number(waitingRule.min_charge)) {
            waitingTimeCost = Number(waitingRule.min_charge);
          }
        }
      } else {
        // NTC fallback: 5h franquia, R$146.44/h (Caminhão Truck)
        const excessHours = Math.max(0, input.waiting_hours - 5);
        waitingTimeCost = excessHours * 146.44;
        fallbacksApplied.push('waiting_time_rules: usando fallback NTC 5h + R$146,44/h');
      }
    }

    // =====================================================
    // GET ICMS RATE
    // =====================================================
    
    const originUf = extractUf(input.origin);
    const destUf = extractUf(input.destination);
    let icmsPercent = FREIGHT_CONSTANTS.DEFAULT_ICMS_PERCENT;

    if (originUf && destUf) {
      const { data: icmsRow } = await supabase
        .from('icms_rates')
        .select('rate_percent')
        .eq('origin_state', originUf)
        .eq('destination_state', destUf)
        .maybeSingle();

      if (icmsRow?.rate_percent !== undefined) {
        icmsPercent = normalizeIcmsRate(Number(icmsRow.rate_percent));
      } else {
        fallbacksApplied.push(`icms_rates: ${originUf}→${destUf} não encontrada, usando ${FREIGHT_CONSTANTS.DEFAULT_ICMS_PERCENT}%`);
      }
    }

    // Validate ICMS rate to prevent invalid calculations
    if (icmsPercent >= 100) {
      fallbacksApplied.push(`icms_percent ${icmsPercent}% inválida (>= 100%), usando ${FREIGHT_CONSTANTS.DEFAULT_ICMS_PERCENT}%`);
      icmsPercent = FREIGHT_CONSTANTS.DEFAULT_ICMS_PERCENT;
    }

    // =====================================================
    // GET TAC RATE — NTC 2.6: Temporal formula
    // Para cada 5% de variação do diesel → 1,75% sobre frete peso
    // Base: frete base (EXCLUI pedágio, GRIS, etc.)
    // =====================================================

    let tacPercent = 0;
    let dieselVariationPercent = 0;
    let tacSteps = 0;
    const today = new Date().toISOString().split('T')[0];

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
    }

    // =====================================================
    // GET PAYMENT TERM ADJUSTMENT (optional)
    // =====================================================
    
    let paymentAdjustmentPercent = 0;
    let paymentTermCode = input.payment_term_code ?? 'D30';

    const { data: paymentTerm } = await supabase
      .from('payment_terms')
      .select('code, adjustment_percent')
      .eq('code', paymentTermCode)
      .eq('active', true)
      .maybeSingle();

    if (paymentTerm) {
      paymentAdjustmentPercent = Number(paymentTerm.adjustment_percent);
    }

    // =====================================================
    // CALCULATE RECEITA BRUTA
    // =====================================================
    
    const receitaBruta = 
      baseFreight + 
      toll + 
      gris + 
      tso + 
      rctrc + 
      adValorem + 
      tde + 
      tear + 
      conditionalFeesTotal + 
      waitingTimeCost;

    // =====================================================
    // APPLY TAC ADJUSTMENT (NTC: only on base freight, not full receita)
    // =====================================================

    const tacAdjustment = baseFreight * (tacPercent / 100);
    const receitaComTac = receitaBruta + tacAdjustment;

    // =====================================================
    // APPLY PAYMENT TERM ADJUSTMENT
    // =====================================================
    
    const paymentAdjustment = receitaComTac * (paymentAdjustmentPercent / 100);
    const receitaFinal = receitaComTac + paymentAdjustment;

    // =====================================================
    // CALCULATE TAXES "POR FORA" (no gross-up)
    // =====================================================
    
    const das = receitaFinal * (dasPercent / 100);
    const icms = receitaFinal * (icmsPercent / 100);
    const totalImpostos = das + icms;

    // =====================================================
    // CALCULATE TOTAL CLIENTE
    // =====================================================
    
    const totalCliente = receitaFinal + totalImpostos;

    // =====================================================
    // CALCULATE PROFITABILITY
    // =====================================================
    
    const custosCarreteiro = receitaFinal * (carreteiroPercent / 100);
    const custosDescarga = descargaValue;
    const custosDiretos = custosCarreteiro + custosDescarga;

    const margemBruta = receitaFinal - totalImpostos - custosDiretos;
    const overhead = margemBruta * (overheadPercent / 100);
    const resultadoLiquido = margemBruta - overhead;

    const margemPercent = receitaFinal > 0 
      ? (resultadoLiquido / receitaFinal) * 100 
      : 0;

    // =====================================================
    // BUILD RESPONSE
    // =====================================================
    
    const routeUfLabel = formatRouteUf(input.origin, input.destination);
    const marginStatus = getMarginStatus(margemPercent);

    const meta: FreightMeta = {
      route_uf_label: routeUfLabel,
      km_band_label: kmBandLabel,
      km_status: kmStatus,
      margin_status: marginStatus,
      margin_percent: roundCurrency(margemPercent),
      cubage_factor: cubageFactor,
      cubage_weight_kg: roundCurrency(cubageWeightKg),
      billable_weight_kg: roundCurrency(billableWeightKg),
    };

    const components: FreightComponents = {
      base_cost: roundCurrency(baseCostAdjusted),
      base_freight: roundCurrency(baseFreight),
      toll: roundCurrency(toll),
      gris: roundCurrency(gris),
      tso: roundCurrency(tso),
      rctrc: roundCurrency(rctrc),
      ad_valorem: 0,
      tde: roundCurrency(tde),
      tear: roundCurrency(tear),
      conditional_fees_total: roundCurrency(conditionalFeesTotal),
      waiting_time_cost: roundCurrency(waitingTimeCost),
    };

    const rates: FreightRates = {
      das_percent: dasPercent,
      icms_percent: icmsPercent,
      gris_percent: grisPercent,
      tso_percent: tsoPercent,
      cost_value_percent: costValuePercent,
      markup_percent: markupPercent,
      overhead_percent: overheadPercent,
      tac_percent: tacPercent,
      payment_adjustment_percent: paymentAdjustmentPercent,
    };

    const totals: FreightTotals = {
      receita_bruta: roundCurrency(receitaFinal),
      das: roundCurrency(das),
      icms: roundCurrency(icms),
      tac_adjustment: roundCurrency(tacAdjustment),
      payment_adjustment: roundCurrency(paymentAdjustment),
      total_impostos: roundCurrency(totalImpostos),
      total_cliente: roundCurrency(totalCliente),
    };

    const profitability: FreightProfitability = {
      custos_carreteiro: roundCurrency(custosCarreteiro),
      custos_descarga: roundCurrency(custosDescarga),
      custos_diretos: roundCurrency(custosDiretos),
      margem_bruta: roundCurrency(margemBruta),
      overhead: roundCurrency(overhead),
      resultado_liquido: roundCurrency(resultadoLiquido),
      margem_percent: roundCurrency(margemPercent),
    };

    const response: CalculateFreightResponse = {
      success: true,
      status: kmStatus === 'OUT_OF_RANGE' ? 'OUT_OF_RANGE' : 'OK',
      error: kmStatus === 'OUT_OF_RANGE' ? `Distância ${input.km_distance} km fora da faixa` : undefined,
      meta,
      components,
      rates,
      totals,
      profitability,
      conditional_fees_breakdown: conditionalFeesBreakdown,
      fallbacks_applied: fallbacksApplied,
      errors: [],
    };

    console.log('[calculate-freight] Complete:', {
      total: totalCliente,
      margin: margemPercent.toFixed(2) + '%',
      status: response.status,
    });

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[calculate-freight] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({
        success: false,
        status: 'MISSING_DATA',
        errors: [`Erro interno: ${errorMessage}`],
        meta: null,
        components: null,
        rates: null,
        totals: null,
        profitability: null,
        conditional_fees_breakdown: {},
        fallbacks_applied: [],
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
