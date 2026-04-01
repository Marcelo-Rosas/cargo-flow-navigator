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
    // GET PARAMETERS (pricing_rules_config with fallback to pricing_parameters)
    // =====================================================

    let vehicleTypeIdForRules: string | null = null;
    if (input.vehicle_type_code) {
      const { data: vt } = await supabase
        .from('vehicle_types')
        .select('id')
        .eq('code', input.vehicle_type_code)
        .eq('active', true)
        .maybeSingle();
      vehicleTypeIdForRules = vt?.id ?? null;
    }

    const { data: allRules } = await supabase
      .from('pricing_rules_config')
      .select('key, value, vehicle_type_id')
      .eq('is_active', true);

    function resolveRule(key: string, vtId: string | null | undefined): number | undefined {
      if (!allRules?.length) return undefined;
      const byKey = allRules.filter((r: { key: string }) => r.key === key);
      if (byKey.length === 0) return undefined;
      const vehicleRule = vtId
        ? byKey.find((r: { vehicle_type_id: string | null }) => r.vehicle_type_id === vtId)
        : null;
      const globalRule = byKey.find(
        (r: { vehicle_type_id: string | null }) => r.vehicle_type_id == null
      );
      const rule = vehicleRule ?? globalRule;
      return rule ? Number(rule.value) : undefined;
    }

    // Fallback: pricing_parameters (legacy)
    const { data: allParams } = await supabase.from('pricing_parameters').select('key, value');
    const paramsMap = new Map<string, number>();
    allParams?.forEach((p: { key: string; value: number }) =>
      paramsMap.set(p.key, Number(p.value))
    );

    const cubageFactor = paramsMap.get('cubage_factor') ?? FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3;
    const dasPercent =
      input.das_percent ??
      resolveRule('das_percent', vehicleTypeIdForRules) ??
      paramsMap.get('das_percent') ??
      FREIGHT_CONSTANTS.DEFAULT_DAS_PERCENT;
    const markupPercent =
      input.markup_percent ??
      resolveRule('markup_percent', vehicleTypeIdForRules) ??
      paramsMap.get('markup_percent') ??
      FREIGHT_CONSTANTS.DEFAULT_MARKUP_PERCENT;
    const overheadPercent =
      input.overhead_percent ??
      resolveRule('overhead_percent', vehicleTypeIdForRules) ??
      paramsMap.get('overhead_percent') ??
      FREIGHT_CONSTANTS.DEFAULT_OVERHEAD_PERCENT;
    const profitMarginPercent =
      resolveRule('profit_margin_percent', vehicleTypeIdForRules) ??
      paramsMap.get('profit_margin_percent') ??
      FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT;
    const regimeSimplesNacional =
      (resolveRule('regime_simples_nacional', vehicleTypeIdForRules) ?? 1) === 1;
    const excessoSublimite = (resolveRule('excesso_sublimite', vehicleTypeIdForRules) ?? 0) === 1;

    const carreteiroPercent = input.carreteiro_percent ?? paramsMap.get('carreteiro_percent') ?? 0;
    const descargaValue = input.descarga_value ?? 0;
    const aluguelMaquinasValue = input.aluguel_maquinas_value ?? 0;

    const correctionFactor = paramsMap.get('correction_factor_inctf') ?? 1.0;

    const isSimples = regimeSimplesNacional && !excessoSublimite;

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
    let billableWeightKg = Math.max(input.weight_kg, cubageWeightKg);

    // Trava Fracionado: mínimo 1.000 kg para viabilidade
    let ltlMinWeightApplied = false;
    const originalWeightKg = input.weight_kg;
    if (input.price_table_id) {
      const { data: ptModality } = await supabase
        .from('price_tables')
        .select('modality')
        .eq('id', input.price_table_id)
        .maybeSingle();
      if (ptModality?.modality === 'fracionado' && billableWeightKg < 1000) {
        billableWeightKg = 1000;
        ltlMinWeightApplied = true;
      }
    }

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

    const toFiniteNumber = (value: unknown): number | undefined => {
      const num = Number(value);
      return Number.isFinite(num) ? num : undefined;
    };

    const resolveRulePercent = (key: string): number | undefined =>
      toFiniteNumber(resolveRule(key, vehicleTypeIdForRules));

    // Ad Valorem Lotação — resolve from Central de Riscos
    const adValoremLotacaoPercent = resolveRulePercent('ad_valorem_lotacao_percent') ?? 0.03;

    // =====================================================
    // DETECT MODALITY (lotacao vs fracionado)
    // =====================================================

    let modality: 'lotacao' | 'fracionado' = 'lotacao';

    if (input.price_table_id) {
      const { data: ptData } = await supabase
        .from('price_tables')
        .select('modality')
        .eq('id', input.price_table_id)
        .maybeSingle();
      if (ptData?.modality === 'fracionado') modality = 'fracionado';
    }

    // =====================================================
    // LTL PARAMETERS (mínimos NTC para fracionado)
    // =====================================================

    type LtlParams = {
      min_freight: number;
      min_freight_cargo_limit: number;
      min_tso: number;
      gris_percent: number;
      gris_min: number;
      gris_min_cargo_limit: number;
      dispatch_fee: number;
    };

    let ltlParams: LtlParams | null = null;
    let dispatchFee = 0; // Taxa de Despacho (só fracionado)

    if (modality === 'fracionado') {
      const { data: ltlRow } = await supabase
        .from('ltl_parameters')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ltlRow) {
        ltlParams = {
          min_freight: Number(ltlRow.min_freight) || 9.28,
          min_freight_cargo_limit: Number(ltlRow.min_freight_cargo_limit) || 3093.81,
          min_tso: Number(ltlRow.min_tso) || 4.64,
          gris_percent: Number(ltlRow.gris_percent) || 0.3,
          gris_min: Number(ltlRow.gris_min) || 9.28,
          gris_min_cargo_limit: Number(ltlRow.gris_min_cargo_limit) || 3093.81,
          dispatch_fee: Number(ltlRow.dispatch_fee) || 102.9,
        };
      } else {
        // Fallback NTC Dez/25
        ltlParams = {
          min_freight: 9.28,
          min_freight_cargo_limit: 3093.81,
          min_tso: 4.64,
          gris_percent: 0.3,
          gris_min: 9.28,
          gris_min_cargo_limit: 3093.81,
          dispatch_fee: 102.9,
        };
        fallbacksApplied.push('ltl_parameters: usando fallback NTC Dez/25');
      }
    }

    // =====================================================
    // LTL: Determina coluna de faixa de peso
    // =====================================================

    function getLtlWeightColumn(weightKg: number): string | null {
      if (weightKg <= 10) return 'weight_rate_10';
      if (weightKg <= 20) return 'weight_rate_20';
      if (weightKg <= 30) return 'weight_rate_30';
      if (weightKg <= 50) return 'weight_rate_50';
      if (weightKg <= 70) return 'weight_rate_70';
      if (weightKg <= 100) return 'weight_rate_100';
      if (weightKg <= 150) return 'weight_rate_150';
      if (weightKg <= 200) return 'weight_rate_200';
      return null; // acima de 200 kg → usa weight_rate_above_200 * kg
    }

    // =====================================================
    // GET PRICE TABLE ROW
    // =====================================================

    if (!input.price_table_id) {
      responseStatus = 'MISSING_DATA';
      responseError = 'Tabela de preços não selecionada';
      fallbacksApplied.push('price_table: não informada');
    } else if (input.km_distance === undefined) {
      responseStatus = 'MISSING_DATA';
      responseError = 'Tabela de preços não selecionada';
      fallbacksApplied.push('price_table: km_distance ausente');
    } else {
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

          if (modality === 'fracionado') {
            // =====================================================
            // NTC FRACIONADO (LTL) Dez/25 — R$/kg × peso em todas as faixas
            // =====================================================
            const weightCol = getLtlWeightColumn(billableWeightKg);

            if (weightCol) {
              // ≤ 200 kg: peso × R$/kg da faixa (proporcional)
              const ratePerKg = Number(priceRow[weightCol]) || 0;
              baseCost = billableWeightKg * ratePerKg;
              console.log(
                `[calculate-freight] NTC Fracionado | Faixa: ${kmBandLabel}, col: ${weightCol}, rate: ${ratePerKg}/kg, frete: R$ ${baseCost}`
              );
            } else {
              // > 200 kg: peso × R$/kg
              const ratePerKg = Number(priceRow.weight_rate_above_200) || 0;
              baseCost = billableWeightKg * ratePerKg;
              console.log(
                `[calculate-freight] NTC Fracionado | Faixa: ${kmBandLabel}, >200kg, rate: ${ratePerKg}/kg, frete: R$ ${baseCost}`
              );
            }

            // Fracionado: linha da tabela > ltl_parameters (somente GRIS) > Central > default
            const ruleGris = resolveRulePercent('gris_percent');
            const ruleTso = resolveRulePercent('tso_percent');
            const ruleCostVal = resolveRulePercent('cost_value_percent');
            const ptGris = toFiniteNumber(priceRow.gris_percent);
            const ptTso = toFiniteNumber(priceRow.tso_percent);
            const ptCostVal = toFiniteNumber(priceRow.cost_value_percent);
            const ltlGris = toFiniteNumber(ltlParams?.gris_percent);
            // Precedencia: Central > linha km > ltl_parameters (somente GRIS) > default
            grisPercent = ruleGris ?? ptGris ?? ltlGris ?? 0.3;
            tsoPercent = ruleTso ?? ptTso ?? 0.15;
            costValuePercent = ruleCostVal ?? ptCostVal ?? 0.3;
            dispatchFee = ltlParams?.dispatch_fee ?? 102.9;
          } else {
            // =====================================================
            // NTC LOTAÇÃO (FTL) — Ad Valorem substitui GRIS/TSO
            // =====================================================
            const costPerTon = Number(priceRow.cost_per_ton) || 0;
            baseCost = (billableWeightKg / 1000) * costPerTon;

            // Lotação: GRIS e TSO são zerados; Ad Valorem cobre custo de risco
            grisPercent = 0;
            tsoPercent = 0;

            const ruleCostVal = resolveRulePercent('cost_value_percent');
            const ptCostVal = toFiniteNumber(priceRow.cost_value_percent);
            costValuePercent = ruleCostVal ?? ptCostVal ?? 0.3;

            console.log(
              `[calculate-freight] Lotação Ad Valorem | Faixa: ${kmBandLabel}, cost_per_ton: ${costPerTon}, frete_peso: ${baseCost}, adValoremPercent: ${adValoremLotacaoPercent}%`
            );
          }
        } else {
          kmStatus = 'OUT_OF_RANGE';
          responseStatus = 'OUT_OF_RANGE';
          responseError = `Não existe faixa para ${kmBandUsed} km nessa tabela`;
          fallbacksApplied.push(`price_table_row: nenhuma faixa para ${kmBandUsed} km`);
          grisPercent = resolveRulePercent('gris_percent') ?? 0.3;
          tsoPercent = resolveRulePercent('tso_percent') ?? 0.15;
          costValuePercent = resolveRulePercent('cost_value_percent') ?? 0.3;
        }
      }
    }

    // =====================================================
    // COMPONENTES — Frete Peso, GRIS, TSO, Frete Valor, Despacho
    // =====================================================

    const frete_peso = baseCost;
    let gris = input.cargo_value * (grisPercent / 100);
    let tso = input.cargo_value * (tsoPercent / 100);
    const frete_valor = input.cargo_value * (costValuePercent / 100);
    // Lotação: Ad Valorem calculado sobre valor NF; Fracionado: sempre 0
    const adValorem =
      modality === 'lotacao'
        ? roundCurrency(input.cargo_value * (adValoremLotacaoPercent / 100))
        : 0;

    // Fracionado: aplicar mínimos NTC
    if (modality === 'fracionado' && ltlParams) {
      // GRIS mínimo: se cargo_value ≤ limite, aplicar mínimo por CTe
      if (input.cargo_value <= ltlParams.gris_min_cargo_limit && gris < ltlParams.gris_min) {
        gris = ltlParams.gris_min;
        fallbacksApplied.push(`gris: mínimo NTC R$ ${ltlParams.gris_min}/CTe aplicado`);
      }
      // TSO mínimo por CTe
      if (tso < ltlParams.min_tso) {
        tso = ltlParams.min_tso;
        fallbacksApplied.push(`tso: mínimo NTC R$ ${ltlParams.min_tso}/CTe aplicado`);
      }
    }

    const ntc_base = frete_peso + frete_valor + gris + tso + dispatchFee;

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

    // FORBID_CONDITIONAL_FEES: when pricing_parameters has this key set to 'true',
    // conditional_fees from input are ignored (v5 manages them locally via Taxas Adicionais).
    const { data: forbidParam } = await supabase
      .from('pricing_parameters')
      .select('value')
      .eq('key', 'FORBID_CONDITIONAL_FEES')
      .maybeSingle();
    const forbidConditionalFees = forbidParam?.value === 'true';

    if (!forbidConditionalFees && input.conditional_fees && input.conditional_fees.length > 0) {
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

    const resolveIcmsFromRules = (): number | undefined => {
      const ruleValue = resolveRule('icms_default', vehicleTypeIdForRules) as number | undefined;
      return ruleValue !== undefined ? normalizeIcmsRate(ruleValue) : undefined;
    };

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
        const icmsFromRules = resolveIcmsFromRules();
        if (icmsFromRules !== undefined) {
          icmsPercent = icmsFromRules;
          fallbacksApplied.push(
            `icms_rates: ${originUf}→${destUf} não encontrada, usando icms_default da Central de Regras`
          );
        } else {
          fallbacksApplied.push(
            `icms_rates: ${originUf}→${destUf} não encontrada, usando ${FREIGHT_CONSTANTS.DEFAULT_ICMS_PERCENT}%`
          );
        }
      }
    } else {
      const icmsFromRules = resolveIcmsFromRules();
      if (icmsFromRules !== undefined) {
        icmsPercent = icmsFromRules;
        fallbacksApplied.push('icms_default: origem/destino não informados, usando regra global');
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
    // TAC & PAYMENT ADJUSTMENTS (NTC 2.6 + prazo)
    // =====================================================

    const tacAdjustment = frete_peso * (tacPercent / 100);
    const receitaBrutaPreTac =
      frete_peso +
      toll +
      gris +
      tso +
      frete_valor +
      adValorem +
      tde +
      tear +
      dispatchFee +
      conditionalFeesTotal +
      waitingTimeCost +
      aluguelMaquinasValue;
    const receitaComTac = receitaBrutaPreTac + tacAdjustment;
    const paymentAdjustment = receitaComTac * (paymentAdjustmentPercent / 100);

    // =====================================================
    // GROSS-UP HÍBRIDO (Asset-Light)
    // Simples: divisor = 1 - (Overhead + DAS + Lucro)/100, ICMS=0
    // Sublimite: divisor = 1 - (Overhead + DAS + ICMS + Lucro)/100
    // Alinhado com freightCalculator client-side.
    // =====================================================

    // MP 1.343/2026: em lotação, custo motorista não pode ser inferior ao Piso ANTT
    const anttFloorApplied =
      modality === 'lotacao' && pisoAnttCarreteiro > 0 && pisoAnttCarreteiro > frete_peso;
    const custoMotorista = anttFloorApplied ? pisoAnttCarreteiro : frete_peso;
    if (anttFloorApplied) {
      console.log(
        `[calculate-freight] ANTT floor applied: frete_peso=${frete_peso}, pisoAntt=${pisoAnttCarreteiro}, custoMotorista=${custoMotorista}`
      );
    }
    const custoServicos =
      toll +
      gris +
      tso +
      frete_valor +
      adValorem +
      tde +
      tear +
      dispatchFee +
      conditionalFeesTotal +
      waitingTimeCost +
      aluguelMaquinasValue +
      tacAdjustment +
      paymentAdjustment;
    const custosCarreteiro = ntc_base;
    const custosDescarga = descargaValue;
    const custosDiretos = custoMotorista + custoServicos + custosDescarga;

    let regimeFiscal: 'simples_nacional' | 'excesso_sublimite' | 'normal';
    let icmsNoDivisor: boolean;
    if (regimeSimplesNacional && !excessoSublimite) {
      regimeFiscal = 'simples_nacional';
      icmsNoDivisor = false;
    } else if (regimeSimplesNacional && excessoSublimite) {
      regimeFiscal = 'excesso_sublimite';
      icmsNoDivisor = true;
    } else {
      regimeFiscal = 'normal';
      icmsNoDivisor = true;
    }

    const taxaBruta = icmsNoDivisor
      ? (overheadPercent + dasPercent + icmsPercent + profitMarginPercent) / 100
      : (overheadPercent + dasPercent + profitMarginPercent) / 100;

    let totalCliente: number;
    let das: number;
    let icms: number;

    if (taxaBruta >= 1) {
      fallbacksApplied.push(
        `gross_up: soma Overhead+DAS+ICMS+Lucro >= 100%, usando modelo por fora`
      );
      const receitaFinal = receitaBrutaPreTac + tacAdjustment + paymentAdjustment;
      const dasProvisionMinValue = paramsMap.get('das_provision_min_value') ?? 0;
      das = roundCurrency(Math.max(receitaFinal * (dasPercent / 100), dasProvisionMinValue));
      icms = roundCurrency(receitaFinal * (icmsPercent / 100));
      totalCliente = roundCurrency(receitaFinal + das + icms);
    } else {
      totalCliente = roundCurrency(custosDiretos / (1 - taxaBruta));
      das = roundCurrency(totalCliente * (dasPercent / 100));
      icms =
        regimeFiscal === 'simples_nacional' ? 0 : roundCurrency(totalCliente * (icmsPercent / 100));
    }

    const totalImpostos = das + icms;
    const receitaLiquida = roundCurrency(totalCliente - totalImpostos);
    const overhead = roundCurrency(receitaLiquida * (overheadPercent / 100));
    const resultadoLiquido = roundCurrency(
      receitaLiquida - overhead - custosCarreteiro - custosDescarga
    );
    const margemBruta = roundCurrency(receitaLiquida - overhead - custoMotorista - custoServicos);
    const margemPercent =
      totalCliente > 0 ? roundCurrency((resultadoLiquido / totalCliente) * 100) : 0;

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
      antt_floor_applied: anttFloorApplied,
      ...(anttFloorApplied && { frete_peso_original: roundCurrency(frete_peso) }),
      ...(ltlMinWeightApplied && { ltl_min_weight_applied: true }),
      ...(ltlMinWeightApplied && { original_weight_kg: roundCurrency(originalWeightKg) }),
    };

    const components: FreightComponents = {
      base_cost: roundCurrency(custoMotorista),
      base_freight: roundCurrency(custoMotorista),
      toll: roundCurrency(toll),
      gris: roundCurrency(gris),
      tso: roundCurrency(tso),
      rctrc: roundCurrency(frete_valor),
      ad_valorem: roundCurrency(adValorem),
      tde: roundCurrency(tde),
      tear: roundCurrency(tear),
      dispatch_fee: roundCurrency(dispatchFee),
      conditional_fees_total: roundCurrency(conditionalFeesTotal),
      waiting_time_cost: roundCurrency(waitingTimeCost),
      das_provision: roundCurrency(das),
      aluguel_maquinas: roundCurrency(aluguelMaquinasValue),
    };

    const rates: FreightRates = {
      das_percent: dasPercent,
      icms_percent: icmsPercent,
      gris_percent: grisPercent,
      tso_percent: tsoPercent,
      cost_value_percent: costValuePercent,
      ad_valorem_percent: modality === 'lotacao' ? adValoremLotacaoPercent : undefined,
      markup_percent: markupPercent,
      overhead_percent: overheadPercent,
      tac_percent: tacPercent,
      payment_adjustment_percent: paymentAdjustmentPercent,
    };

    const totals: FreightTotals = {
      receita_bruta: roundCurrency(totalCliente),
      das,
      icms: roundCurrency(icms),
      tac_adjustment: roundCurrency(tacAdjustment),
      payment_adjustment: roundCurrency(paymentAdjustment),
      total_impostos: roundCurrency(totalImpostos),
      total_cliente: roundCurrency(totalCliente),
    };

    const profitability: FreightProfitability = {
      custos_carreteiro: roundCurrency(custosCarreteiro),
      custo_motorista: roundCurrency(custoMotorista),
      custos_servicos: roundCurrency(custoServicos),
      custos_descarga: roundCurrency(custosDescarga),
      custos_diretos: roundCurrency(custosDiretos),
      receita_liquida: receitaLiquida,
      margem_bruta: margemBruta,
      overhead,
      resultado_liquido: resultadoLiquido,
      margem_percent: margemPercent,
      profit_margin_target: profitMarginPercent,
      regime_fiscal: regimeFiscal,
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
      // v5: risk pass-through (cobrado do cliente, repassado à seguradora/GR)
      risk_pass_through: {
        gris: components.gris,
        tso: components.tso,
        rctrc: components.rctrc,
        ad_valorem: components.ad_valorem,
        total: roundCurrency(
          components.gris + components.tso + components.rctrc + components.ad_valorem
        ),
      },
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
