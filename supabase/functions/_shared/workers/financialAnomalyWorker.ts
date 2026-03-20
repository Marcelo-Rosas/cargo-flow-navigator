import { callLLM } from '../aiClient.ts';
import {
  SYSTEM_PROMPT_FINANCIAL_ANOMALY,
  MAX_TOKENS_ANOMALY,
} from '../prompts/system_financial_anomaly.ts';
import { validateAndParse, type FinancialAnomalyResult } from '../prompts/schemas.ts';

interface WorkerContext {
  entityId: string;
  model: string;
  sb: any;
  previousInsights?: string;
}

function computeStats(values: number[]) {
  if (values.length === 0) return { avg: 0, stdDev: 0, min: 0, max: 0 };
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return {
    avg,
    stdDev,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function computeZScore(value: number, avg: number, stdDev: number): number | null {
  if (stdDev === 0) return null;
  return (value - avg) / stdDev;
}

interface SourceContext {
  clientName?: string;
  origin?: string;
  destination?: string;
  cargoType?: string;
  weight?: number;
  kmDistance?: number;
  tollValue?: number;
  freightType?: string;
  freightModality?: string;
  vehicleTypeName?: string;
  paymentTermName?: string;
  paymentTermDays?: number;
  paymentTermAdjustment?: number;
  paymentTermAdvance?: number;
  shipperName?: string;
  carreteiroAntt?: number;
  carreteiroReal?: number;
  pedagioReal?: number;
  descargaReal?: number;
  breakdownTotalCliente?: number;
  breakdownReceitaBruta?: number;
  breakdownDas?: number;
  breakdownMargemPercent?: number;
  breakdownToll?: number;
  breakdownCustosDescarga?: number;
}

function buildPrompt(
  doc: any,
  stats: ReturnType<typeof computeStats>,
  zScore: number | null,
  historicalCount: number,
  source: SourceContext,
  previousInsights?: string
): string {
  const docAmount = Number(doc.total_amount || 0);
  const deviationPct =
    stats.avg > 0 ? (((docAmount - stats.avg) / stats.avg) * 100).toFixed(1) : 'N/A';

  let prompt = `Analise este documento financeiro (anomalias + compliance):

**Documento**: ${doc.code || doc.id}
**Tipo**: ${doc.type} (${doc.type === 'FAT' ? 'A Receber' : 'A Pagar'})
**Valor do Documento**: R$ ${docAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
**Status**: ${doc.status}`;

  if (source.clientName) prompt += `\n**Cliente**: ${source.clientName}`;
  if (source.shipperName) prompt += `\n**Embarcador**: ${source.shipperName}`;
  if (source.origin && source.destination)
    prompt += `\n**Rota**: ${source.origin} → ${source.destination}`;

  if (source.cargoType || source.weight || source.kmDistance) {
    prompt += `\n\n**Dados da Operacao**:`;
    if (source.cargoType) prompt += `\n- Tipo de carga: ${source.cargoType}`;
    if (source.weight) prompt += `\n- Peso: ${source.weight} kg`;
    if (source.kmDistance) prompt += `\n- Distancia: ${source.kmDistance} km`;
    if (source.freightType) prompt += `\n- Tipo frete: ${source.freightType}`;
    if (source.freightModality) prompt += `\n- Modalidade: ${source.freightModality}`;
    if (source.vehicleTypeName) prompt += `\n- Veiculo: ${source.vehicleTypeName}`;
    if (source.tollValue)
      prompt += `\n- Pedagio da rota: R$ ${source.tollValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (source.paymentTermName) {
    prompt += `\n\n**Condicao de Pagamento Combinada**:`;
    prompt += `\n- Prazo: ${source.paymentTermName}`;
    if (source.paymentTermDays != null) prompt += ` (${source.paymentTermDays} dias)`;
    if (source.paymentTermAdjustment != null && source.paymentTermAdjustment !== 0)
      prompt += `\n- Ajuste de preco: ${source.paymentTermAdjustment > 0 ? '+' : ''}${source.paymentTermAdjustment}%`;
    if (source.paymentTermAdvance != null && source.paymentTermAdvance > 0)
      prompt += `\n- Adiantamento: ${source.paymentTermAdvance}% / Saldo: ${100 - source.paymentTermAdvance}%`;
  }

  if (source.breakdownTotalCliente || source.breakdownMargemPercent != null) {
    prompt += `\n\n**Breakdown de Precificacao (calculado na cotacao)**:`;
    if (source.breakdownReceitaBruta)
      prompt += `\n- Receita Bruta: R$ ${source.breakdownReceitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (source.breakdownDas)
      prompt += `\n- DAS: R$ ${source.breakdownDas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (source.breakdownTotalCliente)
      prompt += `\n- Total Cliente (calculado): R$ ${source.breakdownTotalCliente.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (source.breakdownToll)
      prompt += `\n- Pedagio (no breakdown): R$ ${source.breakdownToll.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (source.breakdownMargemPercent != null)
      prompt += `\n- Margem calculada: ${source.breakdownMargemPercent.toFixed(1)}% (meta: >=15%)`;
  }

  if (source.carreteiroAntt != null || source.carreteiroReal != null) {
    prompt += `\n\n**Carreteiro (PAG)**:`;
    if (source.carreteiroAntt != null)
      prompt += `\n- Piso ANTT: R$ ${source.carreteiroAntt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (source.carreteiroReal != null)
      prompt += `\n- Real (fechado): R$ ${source.carreteiroReal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (source.carreteiroAntt != null && source.carreteiroReal != null) {
      const diff = source.carreteiroReal - source.carreteiroAntt;
      prompt += `\n- Diferenca: R$ ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${diff > 0 ? 'ACIMA do piso' : 'dentro do piso'})`;
    }
  }

  if (source.pedagioReal != null || source.descargaReal != null) {
    prompt += `\n\n**Custos reais (previsto vs real)**:`;
    if (source.breakdownToll != null || source.pedagioReal != null) {
      const prev = source.breakdownToll ?? 0;
      const real = source.pedagioReal ?? 0;
      prompt += `\n- Pedagogio: Previsto R$ ${prev.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / Real R$ ${real.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (source.descargaReal != null || source.breakdownCustosDescarga != null) {
      const prev = source.breakdownCustosDescarga ?? 0;
      const real = source.descargaReal ?? 0;
      prompt += `\n- Descarga: Previsto R$ ${prev.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / Real R$ ${real.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  prompt += `\n\n**Estatisticas historicas (${doc.type}, ${historicalCount} documentos)**:
- Valor medio: R$ ${stats.avg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Desvio padrao: R$ ${stats.stdDev.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Valor minimo: R$ ${stats.min.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Valor maximo: R$ ${stats.max.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Z-score do valor atual: ${zScore !== null ? zScore.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
- Desvio da media: ${deviationPct}%

**Interpretacao estatistica**:
- |Z-score| > 2.0 = anomalia provavel
- |Z-score| entre 1.5 e 2.0 = requer atencao
- |Z-score| < 1.5 = dentro do padrao`;

  if (previousInsights) {
    prompt += `\n\n**Analises anteriores desta entidade**:\n${previousInsights}`;
  }

  prompt += `\n\nFaca a analise completa: anomalias estatisticas + compliance de valor vs condicao de pagamento + margem.`;

  return prompt;
}

async function fetchSourceContext(sb: any, doc: any): Promise<SourceContext> {
  const ctx: SourceContext = {};

  if (doc.source_type === 'quote' && doc.source_id) {
    const { data: q } = await sb
      .from('quotes')
      .select(
        'client_name, shipper_name, origin, destination, cargo_type, weight, km_distance, toll_value, freight_type, freight_modality, vehicle_type_id, payment_term_id, pricing_breakdown'
      )
      .eq('id', doc.source_id)
      .maybeSingle();
    if (q) {
      ctx.clientName = q.client_name;
      ctx.shipperName = q.shipper_name;
      ctx.origin = q.origin;
      ctx.destination = q.destination;
      ctx.cargoType = q.cargo_type;
      ctx.weight = q.weight ? Number(q.weight) : undefined;
      ctx.kmDistance = q.km_distance ? Number(q.km_distance) : undefined;
      ctx.tollValue = q.toll_value ? Number(q.toll_value) : undefined;
      ctx.freightType = q.freight_type;
      ctx.freightModality = q.freight_modality;

      if (q.vehicle_type_id) {
        const { data: vt } = await sb
          .from('vehicle_types')
          .select('name')
          .eq('id', q.vehicle_type_id)
          .maybeSingle();
        if (vt) ctx.vehicleTypeName = vt.name;
      }
      if (q.payment_term_id) {
        const { data: pt } = await sb
          .from('payment_terms')
          .select('name, days, adjustment_percent, advance_percent')
          .eq('id', q.payment_term_id)
          .maybeSingle();
        if (pt) {
          ctx.paymentTermName = pt.name;
          ctx.paymentTermDays = pt.days;
          ctx.paymentTermAdjustment = pt.adjustment_percent;
          ctx.paymentTermAdvance = pt.advance_percent;
        }
      }
      const bd = q.pricing_breakdown as any;
      if (bd?.totals) {
        ctx.breakdownTotalCliente = bd.totals.totalCliente;
        ctx.breakdownReceitaBruta = bd.totals.receitaBruta;
        ctx.breakdownDas = bd.totals.das;
      }
      if (bd?.profitability) {
        ctx.breakdownMargemPercent = bd.profitability.margemPercent;
        ctx.breakdownCustosDescarga = bd.profitability.custosDescarga;
      }
      if (bd?.components?.toll) ctx.breakdownToll = bd.components.toll;
    }
  } else if (doc.source_type === 'order' && doc.source_id) {
    const { data: o } = await sb
      .from('orders')
      .select(
        'client_name, shipper_name, origin, destination, cargo_type, weight, km_distance, toll_value, freight_type, freight_modality, vehicle_type_id, payment_term_id, pricing_breakdown, carreteiro_antt, carreteiro_real, pedagio_real, descarga_real'
      )
      .eq('id', doc.source_id)
      .maybeSingle();
    if (o) {
      ctx.clientName = o.client_name;
      ctx.shipperName = o.shipper_name;
      ctx.origin = o.origin;
      ctx.destination = o.destination;
      ctx.cargoType = o.cargo_type;
      ctx.weight = o.weight ? Number(o.weight) : undefined;
      ctx.kmDistance = o.km_distance ? Number(o.km_distance) : undefined;
      ctx.tollValue = o.toll_value ? Number(o.toll_value) : undefined;
      ctx.freightType = o.freight_type;
      ctx.freightModality = o.freight_modality;
      ctx.carreteiroAntt = o.carreteiro_antt ? Number(o.carreteiro_antt) : undefined;
      ctx.carreteiroReal = o.carreteiro_real ? Number(o.carreteiro_real) : undefined;
      ctx.pedagioReal = o.pedagio_real != null ? Number(o.pedagio_real) : undefined;
      ctx.descargaReal = o.descarga_real != null ? Number(o.descarga_real) : undefined;

      if (o.vehicle_type_id) {
        const { data: vt } = await sb
          .from('vehicle_types')
          .select('name')
          .eq('id', o.vehicle_type_id)
          .maybeSingle();
        if (vt) ctx.vehicleTypeName = vt.name;
      }
      if (o.payment_term_id) {
        const { data: pt } = await sb
          .from('payment_terms')
          .select('name, days, adjustment_percent, advance_percent')
          .eq('id', o.payment_term_id)
          .maybeSingle();
        if (pt) {
          ctx.paymentTermName = pt.name;
          ctx.paymentTermDays = pt.days;
          ctx.paymentTermAdjustment = pt.adjustment_percent;
          ctx.paymentTermAdvance = pt.advance_percent;
        }
      }
      const bd = o.pricing_breakdown as any;
      if (bd?.totals) {
        ctx.breakdownTotalCliente = bd.totals.totalCliente;
        ctx.breakdownReceitaBruta = bd.totals.receitaBruta;
        ctx.breakdownDas = bd.totals.das;
      }
      if (bd?.profitability) {
        ctx.breakdownMargemPercent = bd.profitability.margemPercent;
        ctx.breakdownCustosDescarga = bd.profitability.custosDescarga;
      }
      if (bd?.components?.toll) ctx.breakdownToll = bd.components.toll;
    }
  }

  return ctx;
}

export async function executeFinancialAnomalyWorker(ctx: WorkerContext) {
  const { data: doc, error } = await ctx.sb
    .from('financial_documents')
    .select('*')
    .eq('id', ctx.entityId)
    .single();
  if (error || !doc) throw new Error(`Financial document not found: ${ctx.entityId}`);

  const [sourceContext, { data: historicalDocs }] = await Promise.all([
    fetchSourceContext(ctx.sb, doc),
    ctx.sb
      .from('financial_documents')
      .select('total_amount, type, created_at')
      .eq('type', doc.type)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const amounts = (historicalDocs || [])
    .map((d: any) => Number(d.total_amount) || 0)
    .filter((a: number) => a > 0);

  const stats = computeStats(amounts);
  const zScore = computeZScore(Number(doc.total_amount || 0), stats.avg, stats.stdDev);

  const prompt = buildPrompt(
    doc,
    stats,
    zScore,
    amounts.length,
    sourceContext,
    ctx.previousInsights
  );

  const startTime = Date.now();
  const result = await callLLM({
    prompt,
    system: SYSTEM_PROMPT_FINANCIAL_ANOMALY,
    maxTokens: MAX_TOKENS_ANOMALY,
    modelHint: 'anthropic',
    analysisType: 'financial_anomaly',
    entityType: 'financial_document',
    entityId: ctx.entityId,
  });
  const durationMs = Date.now() - startTime;

  const analysis = validateAndParse<FinancialAnomalyResult>(result.text, 'financial_anomaly');
  analysis._model = ctx.model;
  analysis._cost_usd = 0;
  analysis._provider = result.provider;
  analysis._duration_ms = durationMs;
  if (zScore !== null && (!analysis.metrics || analysis.metrics.z_score === undefined)) {
    if (!analysis.metrics) analysis.metrics = {} as any;
    analysis.metrics!.z_score = Math.round(zScore * 100) / 100;
  }

  await ctx.sb.from('ai_insights').insert({
    insight_type: 'financial_anomaly',
    entity_type: 'financial_document',
    entity_id: ctx.entityId,
    analysis,
    summary_text: analysis.summary || result.text.substring(0, 300),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return { analysis, durationMs, provider: result.provider };
}
