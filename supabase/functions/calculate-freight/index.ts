/// <reference path="deno.d.ts" />
import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '../_shared/cors.ts';
import { calculateFreightInputSchema } from '../_shared/freight-schema.ts';
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

type WaitingRuleRow = {
  free_hours?: number | null;
  rate_per_hour?: number | null;
  rate_per_day?: number | null;
  min_charge?: number | null;
};

// =====================================================
// MAIN HANDLER
// =====================================================

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use ANON_KEY + user JWT (respects RLS); requires verify_jwt = true

    // Use Deno.env only if running in Deno, fallback for other runtimes (e.g., Node test or local dev)
    const getEnvSafe = (key: string) => {
      if (typeof Deno !== 'undefined' && Deno.env && typeof Deno.env.get === 'function') {
        return Deno.env.get(key);
      } else if (typeof process !== 'undefined' && process.env) {
        return process.env[key];
      }
      return undefined;
    };

    const supabaseUrl = getEnvSafe('SUPABASE_URL');
    const supabaseAnonKey = getEnvSafe('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'SERVER_ERROR',
          errors: ['Environment variables SUPABASE_URL or SUPABASE_ANON_KEY not set'],
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'UNAUTHORIZED',
          errors: ['Authorization header obrigatório'],
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'UNAUTHORIZED',
          errors: ['Usuário não autenticado'],
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate payload with Zod
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'MISSING_DATA',
          errors: ['Payload JSON inválido'],
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parseResult = calculateFreightInputSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return new Response(JSON.stringify({ success: false, status: 'MISSING_DATA', errors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const input: CalculateFreightInput = parseResult.data;

    console.log(
      '[calculate-freight] Request:',
      input.origin,
      '→',
      input.destination,
      `${input.km_distance}km`
    );

    const fallbacksApplied: string[] = [];

    // =====================================================
    // GET GLOBAL PARAMETERS
    // =====================================================

    const { data: allParams } = await supabase.from('pricing_parameters').select('key, value');

    const paramsMap = new Map<string, number>();
    allParams?.forEach((p) => paramsMap.set(p.key, Number(p.value)));

    const cubageFactor = paramsMap.get('cubage_factor') ?? FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3;
    const dasPercent =
      input.das_percent ?? paramsMap.get('das_percent') ?? FREIGHT_CONSTANTS.DEFAULT_DAS_PERCENT;
    const markupPercent =
      input.markup_percent ??
      paramsMap.get('markup_percent') ??
      FREIGHT_CONSTANTS.DEFAULT_MARKUP_PERCENT;
    const overheadPercent =
      input.overhead_percent ??
      paramsMap.get('overhead_percent') ??
      FREIGHT_CONSTANTS.DEFAULT_OVERHEAD_PERCENT;
    const carreteiroPercent = input.carreteiro_percent ?? paramsMap.get('carreteiro_percent') ?? 0;
    const descargaValue = input.descarga_value ?? 0;

    const correctionFactor = paramsMap.get('correction_factor_inctf') ?? 1.0;

    // Regime tributário global: tabela pricing_parameters, key = tax_regime_simples.
    // 1 = Simples Nacional (ICMS 0%, DAS = provisão por frete). Default = 1 quando a chave não existe.
    const isSimples = (paramsMap.get('tax_regime_simples') ?? 1) === 1;
    const dasProvisionPercent =
      paramsMap.get('das_provision_percent') ?? FREIGHT_CONSTANTS.DEFAULT_DAS_PERCENT;
    const dasProvisionMinValue = paramsMap.get('das_provision_min_value') ?? 0;

    if (!paramsMap.has('das_percent'))
      fallbacksApplied.push(
        `das_percent: usando default ${FREIGHT_CONSTANTS.DEFAULT_DAS_PERCENT}%`
      );
    if (!paramsMap.has('markup_percent'))
      fallbacksApplied.push(
        `markup_percent: usando default ${FREIGHT_CONSTANTS.DEFAULT_MARKUP_PERCENT}%`
      );
    if (!paramsMap.has('correction_factor_inctf'))
      fallbacksApplied.push('correction_factor_inctf: não encontrado, usando 1.0');

    // NTC Lotação Dez/25: correctionFactor e markup não aplicados ao frete peso
    fallbacksApplied.push('ntc_mode: correctionFactor/markup ignored');

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
    let responseStatus: 'OK' | 'OUT_OF_RANGE' | 'MISSING_DATA' = 'OK';
    let responseError: string | undefined;
    let kmBandUsed: number | undefined;
    let priceTableRowId: string | undefined;

    if (!input.price_table_id) {
      responseStatus = 'MISSING_DATA';
      responseError = 'Tabela de preços não selecionada';
      fallbacksApplied.push('price_table: não informada');
    } else if (input.km_distance === undefined) {
      responseStatus = 'MISSING_DATA';
      responseError = 'Tabela de preços não selecionada';
      fallbacksApplied.push('price_table: km_distance ausente');
    } else {
      // Lotação: ceil para consistência de faixa (evitar cair em faixa errada por decimal)
      const kmBand = Math.ceil(Number(input.km_distance));
      kmBandUsed = kmBand;

      const { data: allRows, error: rowsError } = await supabase
        .from('price_table_rows')
        .select('*')
        .eq('price_table_id', input.price_table_id)
        .order('km_from', { ascending: true });

      if (rowsError) {
        kmStatus = 'OUT_OF_RANGE';
        responseStatus = 'MISSING_DATA';
        responseError = 'Erro ao consultar linhas da tabela de preços';
        fallbacksApplied.push(`price_table_row: ${rowsError.message}`);
      } else {
        const priceRow =
          allRows?.find(
            (r: { km_from: number; km_to: number }) => r.km_from <= kmBand && r.km_to >= kmBand
          ) ?? null;

        if (priceRow) {
          kmBandLabel = `${priceRow.km_from}-${priceRow.km_to}`;
          priceTableRowId = priceRow.id;

          const costPerTon = Number(priceRow.cost_per_ton) || 0;
          baseCost = (billableWeightKg / 1000) * costPerTon;

          grisPercent = Number(priceRow.gris_percent) || 0;
          tsoPercent = Number(priceRow.tso_percent) || 0;
          // NTC Lotação Dez/25: RCTR-C não compõe base de cálculo.
          // GRIS e TSO já cobrem seguro sobre valor da mercadoria.
          // cost_value_percent permanece na tabela para compatibilidade futura.
          costValuePercent = 0;

          console.log(
            `[calculate-freight] NTC Lotação Dez/25 | Faixa: ${kmBandLabel}, cost_per_ton: ${costPerTon}, frete_peso: ${baseCost}`
          );
        } else {
          kmStatus = 'OUT_OF_RANGE';
          responseStatus = 'OUT_OF_RANGE';
          responseError = `Não existe faixa para ${kmBandUsed} km nessa tabela`;
          fallbacksApplied.push(`price_table_row: nenhuma faixa para ${kmBandUsed} km`);
        }
      }
    }

    // =====================================================
    // NTC LOTAÇÃO DEZ/25 — Variáveis explícitas (sem correction/markup)
    // =====================================================

    const frete_peso = baseCost; // ton * cost_per_ton, sem correctionFactor
    const gris = input.cargo_value * (grisPercent / 100);
    const tso = input.cargo_value * (tsoPercent / 100);
    const frete_valor = input.cargo_value * (costValuePercent / 100); // rctrc no response = frete valor NTC
    const adValorem = 0; // Sempre 0 (TSO substitui)
    const ntc_base = frete_peso + frete_valor + gris + tso;

    // =====================================================
    // TOLL VALUE (manual)
    // =====================================================

    const toll = input.toll_value ?? 0;

    // =====================================================
    // NTC FEES (TDE/TEAR) — TODO: generalidades NTC depois; por ora 0
    // =====================================================

    const tde = 0;
    const tear = 0;

    // Base para taxas condicionais que aplicam sobre frete: mantém comportamento anterior
    // (correction + markup) para não alterar cobrança de fees já cadastrados
    const conditionalFeeFreightBase = frete_peso * correctionFactor * (1 + markupPercent / 100);

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
        const fee = fees?.find((f) => f.code === feeCode);

        if (fee) {
          let feeValue = 0;
          const feeBase =
            fee.applies_to === 'cargo_value' ? input.cargo_value : conditionalFeeFreightBase;

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
          if (fee.min_value != null && feeValue < Number(fee.min_value))
            feeValue = Number(fee.min_value);
          if (fee.max_value != null && feeValue > Number(fee.max_value))
            feeValue = Number(fee.max_value);

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
    let axesCount: number | null = null;

    if (input.vehicle_type_code) {
      const { data: vt } = await supabase
        .from('vehicle_types')
        .select('id, axes_count')
        .eq('code', input.vehicle_type_code)
        .eq('active', true)
        .maybeSingle();
      vehicleTypeId = vt?.id ?? null;
      axesCount = vt?.axes_count ?? null;
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
        const rule = waitingRule as WaitingRuleRow;
        const freeHours = Number(rule.free_hours) || 5; // NTC 2.3: 5h franquia
        const excessHours = Math.max(0, input.waiting_hours - freeHours);

        if (excessHours > 0) {
          const ratePerHour = Number(rule.rate_per_hour) || 146.44; // NTC: Truck
          const ratePerDay = rule.rate_per_day != null ? Number(rule.rate_per_day) : null;

          // NTC: se excede 24h da franquia, cobrar diária inteira
          if (ratePerDay && excessHours >= 24) {
            const fullDays = Math.ceil(excessHours / 24);
            waitingTimeCost = fullDays * ratePerDay;
          } else {
            waitingTimeCost = excessHours * ratePerHour;
          }

          if (rule.min_charge != null && waitingTimeCost < Number(rule.min_charge)) {
            waitingTimeCost = Number(rule.min_charge);
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
    // PISO ANTT (CARRETEIRO) — Tabela A, Carga Geral
    // Fórmula: km × CCD + CC (ida, sem retorno vazio)
    // =====================================================

    let pisoAnttCarreteiro = 0;

    if (axesCount != null && axesCount > 0 && input.km_distance != null && input.km_distance > 0) {
      const kmBand = Math.ceil(Number(input.km_distance));

      const { data: anttRate } = await supabase
        .from('antt_floor_rates')
        .select('ccd, cc')
        .eq('operation_table', 'A')
        .eq('cargo_type', 'carga_geral')
        .eq('axes_count', axesCount)
        .order('valid_from', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (anttRate?.ccd != null && anttRate?.cc != null) {
        pisoAnttCarreteiro = roundCurrency(kmBand * Number(anttRate.ccd) + Number(anttRate.cc));
      }
    }

    // =====================================================
    // GET ICMS RATE
    // =====================================================

    const originUf = extractUf(input.origin);
    const destUf = extractUf(input.destination);
    let icmsPercent: number = FREIGHT_CONSTANTS.DEFAULT_ICMS_PERCENT;

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
        fallbacksApplied.push(
          `icms_rates: ${originUf}→${destUf} não encontrada, usando ${FREIGHT_CONSTANTS.DEFAULT_ICMS_PERCENT}%`
        );
      }
    }

    // Validate ICMS rate to prevent invalid calculations
    if (icmsPercent >= 100) {
      fallbacksApplied.push(
        `icms_percent ${icmsPercent}% inválida (>= 100%), usando ${FREIGHT_CONSTANTS.DEFAULT_ICMS_PERCENT}%`
      );
      icmsPercent = FREIGHT_CONSTANTS.DEFAULT_ICMS_PERCENT;
    }

    // Simples Nacional: ICMS não incide no cálculo (linha continua visível com 0% e R$ 0,00)
    if (isSimples) icmsPercent = 0;

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
    const paymentTermCode = input.payment_term_code ?? 'D30';

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
      frete_peso +
      toll +
      gris +
      tso +
      frete_valor +
      adValorem +
      tde +
      tear +
      conditionalFeesTotal +
      waitingTimeCost;

    // =====================================================
    // APPLY TAC ADJUSTMENT (NTC 2.6: apenas sobre frete peso)
    // =====================================================

    const tacAdjustment = frete_peso * (tacPercent / 100);
    const receitaComTac = receitaBruta + tacAdjustment;

    // =====================================================
    // APPLY PAYMENT TERM ADJUSTMENT
    // =====================================================

    const paymentAdjustment = receitaComTac * (paymentAdjustmentPercent / 100);
    const receitaFinal = receitaComTac + paymentAdjustment;

    // =====================================================
    // CALCULATE TAXES "POR FORA" (no gross-up)
    // Provisão DAS = max(receita × das_provision_percent/100, das_provision_min_value).
    // No Simples: totals.das = provisão por frete (colchão); ICMS = 0.
    // =====================================================

    const baseProvisao = receitaFinal;
    const das = Math.max(baseProvisao * (dasProvisionPercent / 100), dasProvisionMinValue);
    const icms = receitaFinal * (icmsPercent / 100);
    const totalImpostos = das + icms;

    // =====================================================
    // CALCULATE TOTAL CLIENTE
    // =====================================================

    const totalCliente = receitaFinal + totalImpostos;

    // =====================================================
    // CALCULATE PROFITABILITY
    // Margem Bruta = Total Cliente - Piso ANTT - Carga/Descarga - Provisionamento DAS
    // Resultado Líquido = Margem Bruta - Overhead
    // Margem % = Resultado Líquido / Total Cliente
    // =====================================================

    const custosCarreteiro = pisoAnttCarreteiro; // Piso ANTT substitui % sobre receita
    const custosDescarga = descargaValue;
    const custosDiretos = custosCarreteiro + custosDescarga;

    const margemBruta = totalCliente - pisoAnttCarreteiro - custosDescarga - das;
    const overhead = margemBruta * (overheadPercent / 100);
    const resultadoLiquido = margemBruta - overhead;

    const margemPercent = totalCliente > 0 ? (resultadoLiquido / totalCliente) * 100 : 0;

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
      ...(kmBandUsed !== undefined && { km_band_used: kmBandUsed }),
      ...(priceTableRowId && { price_table_row_id: priceTableRowId }),
      ...(priceTableRowId && { ntc_base: roundCurrency(ntc_base) }),
      antt_piso_carreteiro: roundCurrency(pisoAnttCarreteiro),
    };

    const components: FreightComponents = {
      base_cost: roundCurrency(frete_peso),
      base_freight: roundCurrency(frete_peso),
      toll: roundCurrency(toll),
      gris: roundCurrency(gris),
      tso: roundCurrency(tso),
      rctrc: roundCurrency(frete_valor),
      ad_valorem: 0,
      tde: roundCurrency(tde),
      tear: roundCurrency(tear),
      conditional_fees_total: roundCurrency(conditionalFeesTotal),
      waiting_time_cost: roundCurrency(waitingTimeCost),
      das_provision: roundCurrency(das),
    };

    const rates: FreightRates = {
      das_percent: dasProvisionPercent,
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
      status: responseStatus,
      error: responseError,
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

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
