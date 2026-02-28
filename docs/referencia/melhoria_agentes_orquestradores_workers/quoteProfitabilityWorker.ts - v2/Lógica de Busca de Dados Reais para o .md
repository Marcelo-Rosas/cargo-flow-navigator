# Lógica de Busca de Dados Reais para o `quoteProfitabilityWorker.ts`

Este documento detalha as modificações necessárias no `quoteProfitabilityWorker.ts` para incorporar a análise de rentabilidade real, buscando dados de `orders` e `occurrences` após o fechamento da Ordem de Serviço (OS). O objetivo é fornecer ao LLM um contexto mais preciso sobre a margem final da operação.

## 1. Modificações na Função `fetchQuoteData`

A função `fetchQuoteData` será estendida para não apenas buscar os dados da cotação, mas também para verificar se existe uma OS associada e, em caso afirmativo, buscar os dados relevantes dessa OS.

```typescript
async function fetchQuoteData(sb: any, entityId: string) {
  const { data: quote, error } = await sb.from(\'quotes\').select(\'*\').eq(\'id\', entityId).single();
  if (error || !quote) throw new Error(`Quote not found: ${entityId}`);

  let orderData: any = null;
  let realCarreteiroCost: number | null = null;
  let orderValue: number | null = null;

  // Tenta buscar a OS associada à cotação
  const { data: order, error: orderError } = await sb
    .from(\'orders\')
    .select(\'id, value, carreteiro_real, stage, carrier_payment_term_id, carrier_advance_date, carrier_balance_date\')
    .eq(\'quote_id\', entityId)
    .maybeSingle();

  let reconciliationData: any = null;
  if (order) {
    // Busca dados de conciliação (custo final comprovado)
    const { data: recon } = await sb
      .from(\'order_reconciliations\') // Nome assumido da tabela/view
      .select(\'paid_amount, delta_amount, is_reconciled\')
      .eq(\'order_id\', order.id)
      .maybeSingle();
    reconciliationData = recon;

    if (order.stage === \'entregue\') {
      orderData = order;
      // Prioriza o valor pago conciliado, se disponível
      realCarreteiroCost = recon?.paid_amount ? Number(recon.paid_amount) : (order.carreteiro_real ? Number(order.carreteiro_real) : null);
      orderValue = order.value ? Number(order.value) : null;
    }
  }

  return { quote, orderData, realCarreteiroCost, orderValue };
}
```

## 2. Nova Função para Buscar Ocorrências e Custos Extras

Será criada uma nova função, `fetchOccurrencesCosts`, para buscar todas as ocorrências relacionadas a uma OS e somar seus impactos financeiros.

```typescript
async function fetchOccurrencesCosts(sb: any, orderId: string) {
  const { data: occurrences, error } = await sb
    .from(\'occurrences\')
    .select(\'cost_impact, description, type\')
    .eq(\'order_id\', orderId);

  if (error) {
    console.error(\'Error fetching occurrences:\', error);
    return { totalExtraCosts: 0, occurrenceDetails: [] };
  }

  let totalExtraCosts = 0;
  const occurrenceDetails: { description: string; cost: number; type: string }[] = [];

  for (const occ of occurrences || []) {
    const cost = Number(occ.cost_impact) || 0;
    totalExtraCosts += cost;
    occurrenceDetails.push({
      description: occ.description || \'Ocorrência sem descrição\',
      cost: cost,
      type: occ.type || \'Desconhecido\',
    });
  }

  return { totalExtraCosts, occurrenceDetails };
}
```

## 3. Modificações na Função `executeQuoteProfitabilityWorker`

A função principal do worker será atualizada para chamar as novas funções de busca de dados e calcular a rentabilidade real.

```typescript
export async function executeQuoteProfitabilityWorker(ctx: WorkerContext) {
  const [{ quote, orderData, realCarreteiroCost, orderValue }, historical] = await Promise.all([
    fetchQuoteData(ctx.sb, ctx.entityId),
    fetchHistoricalMargins(ctx.sb),
  ]);

  const clientHistory = await fetchClientHistory(ctx.sb, quote.client_name);

  let totalExtraCosts = 0;
  let occurrenceDetails: { description: string; cost: number; type: string }[] = [];

  if (orderData) {
    const { totalExtraCosts: fetchedCosts, occurrenceDetails: fetchedDetails } = await fetchOccurrencesCosts(ctx.sb, orderData.id);
    totalExtraCosts = fetchedCosts;
    occurrenceDetails = fetchedDetails;
  }

  // Cálculo da rentabilidade real (se houver dados da OS finalizada)
  let realProfitability: { margemPercent: number; resultadoLiquido: number; isReconciled: boolean } | null = null;
  if (orderValue !== null && realCarreteiroCost !== null) {
    const receitaBruta = orderValue;
    const custosTotaisReais = realCarreteiroCost + totalExtraCosts;
    const resultadoLiquidoReal = receitaBruta - custosTotaisReais;
    const margemPercentReal = (resultadoLiquidoReal / receitaBruta) * 100;
    realProfitability = { 
      margemPercent: margemPercentReal, 
      resultadoLiquido: resultadoLiquidoReal,
      isReconciled: !!reconciliationData?.is_reconciled 
    };
  }

  const prompt = buildPrompt(
    quote,
    historical,
    clientHistory,
    ctx.previousInsights,
    orderData, // Passa dados da OS
    realProfitability, // Passa rentabilidade real
    occurrenceDetails // Passa detalhes das ocorrências
  );

  const startTime = Date.now();
  const result = await callLLM({
    prompt,
    system: SYSTEM_PROMPT_QUOTE_PROFITABILITY,
    maxTokens: MAX_TOKENS_QUOTE,
    analysisType: \'quote_profitability\',
    entityType: \'quote\',
    entityId: ctx.entityId,
  });
  const durationMs = Date.now() - startTime;

  const analysis = validateAndParse<QuoteProfitabilityResult>(result.text, \'quote_profitability\');
  analysis._model = ctx.model;
  analysis._cost_usd = 0;
  analysis._provider = result.provider;
  analysis._duration_ms = durationMs;

  // Adiciona a rentabilidade real ao objeto de análise, se calculada
  if (realProfitability) {
    analysis.real_profitability = {
      margem_percent_real: realProfitability.margemPercent,
      resultado_liquido_real: realProfitability.resultadoLiquido,
      custos_extras_ocorrencias: totalExtraCosts,
      detalhes_ocorrencias: occurrenceDetails,
    };
    // Calcula o desvio da margem prevista para a real
    if (quote.pricing_breakdown?.profitability?.margemPercent) {
      analysis.real_profitability.desvio_margem_prevista_real = 
        realProfitability.margemPercent - quote.pricing_breakdown.profitability.margemPercent;
    }
  }

  await ctx.sb.from(\'ai_insights\').insert({
    insight_type: \'quote_profitability\',
    entity_type: \'quote\',
    entity_id: ctx.entityId,
    analysis,
    summary_text: analysis.summary || result.text.substring(0, 300),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return { analysis, durationMs, provider: result.provider };
}
```

## 4. Modificações na Função `buildPrompt`

A função `buildPrompt` precisará ser atualizada para aceitar os novos parâmetros (`orderData`, `realProfitability`, `occurrenceDetails`) e formatá-los no prompt para o LLM.

```typescript
function buildPrompt(
  quote: any,
  historical: any,
  clientHistory: any[],
  previousInsights?: string,
  orderData?: any, // Novo parâmetro
  realProfitability?: { margemPercent: number; resultadoLiquido: number }, // Novo parâmetro
  occurrenceDetails?: { description: string; cost: number; type: string }[] // Novo parâmetro
): string {
  // ... (código existente para construir o prompt com dados da cotação)

  let prompt = `Analise a rentabilidade desta cotacao de frete:\n\n` +
               `**Cotacao**: ${quote.quote_code}\n` +
               `**Cliente**: ${quote.client_name}\n` +
               `**Rota**: ${quote.origin} -> ${quote.destination}\n` +
               `**Distancia**: ${kmDistance || \'N/A\'} km\n` +
               `**Valor total (Previsto)**: R$ ${quoteValue.toFixed(2)}\n` +
               `**Valor por km (Previsto)**: R$ ${valorPorKm}\n\n` +
               `**Breakdown de Rentabilidade (Previsto)**:\n` +
               `- Custos carreteiro: R$ ${profitability?.custosCarreteiro ?? profitability?.custos_carreteiro ?? \'N/A\'}\n` +
               `- Custos diretos: R$ ${profitability?.custosDiretos ?? profitability?.custos_diretos ?? \'N/A\'}\n` +
               `- Margem bruta: R$ ${profitability?.margemBruta ?? profitability?.margem_bruta ?? \'N/A\'}\n` +
               `- Margem %: ${profitability?.margemPercent ?? profitability?.margem_percent ?? \'N/A\'}%\n` +
               `- Resultado liquido: R$ ${profitability?.resultadoLiquido ?? profitability?.resultado_liquido ?? \'N/A\'}\n\n` +
               `**ANTT Piso**: R$ ${meta?.antt?.total ?? meta?.antt_piso_carreteiro ?? \'N/A\'}\n` +
               `**Status margem**: ${meta?.marginStatus ?? meta?.margin_status ?? \'N/A\'}\n\n` +
               `**Comparativo historico (${historical.count} cotacoes ganhas)**:\n` +
               `- Margem media: ${historical.avg ? historical.avg.toFixed(1) + \'%\' : \'Sem dados\'}\n` +
               `- Desvio padrao: ${historical.stdDev ? historical.stdDev.toFixed(1) + \'%\' : \'N/A\'}\n\n` +
               `**Historico do cliente (${clientHistory.length} cotacoes)**:\n` +
               `- Margem media deste cliente: ${avgClientMargin ? avgClientMargin.toFixed(1) + \'%\' : \'Sem historico\'}\n` +
               `- Cotacoes ganhas: ${clientHistory.filter((q: any) => q.stage === \'ganho\').length}`;

  if (orderData) {
    prompt += `\n\n--- Dados da Ordem de Servico (OS) Finalizada ---\n`;
    prompt += `**OS**: ${orderData.id}\n`;
    prompt += `**Valor Total (Real)**: R$ ${orderData.value ? Number(orderData.value).toFixed(2) : \'N/A\'}\n`;
    prompt += `**Custo Carreteiro (Real)**: R$ ${orderData.carreteiro_real ? Number(orderData.carreteiro_real).toFixed(2) : \'N/A\'}\n`;

    if (occurrenceDetails && occurrenceDetails.length > 0) {
      prompt += `**Custos Extras (Ocorrencias)**:\n`;
      occurrenceDetails.forEach(occ => {
        prompt += `- ${occ.description} (${occ.type}): R$ ${occ.cost.toFixed(2)}\n`;
      });
      prompt += `**Total Custos Extras**: R$ ${occurrenceDetails.reduce((sum, occ) => sum + occ.cost, 0).toFixed(2)}\n`;
    }

    if (realProfitability) {
      prompt += `**Rentabilidade Final (Real)**:\n`;
      prompt += `- Margem % Real: ${realProfitability.margemPercent.toFixed(1)}%\n`;
      prompt += `- Resultado Liquido Real: R$ ${realProfitability.resultadoLiquido.toFixed(2)}\n`;
      const predictedMargin = quote.pricing_breakdown?.profitability?.margemPercent ?? quote.pricing_breakdown?.profitability?.margem_percent;
      if (predictedMargin !== undefined && predictedMargin !== null) {
        const deviation = realProfitability.margemPercent - predictedMargin;
        prompt += `- Desvio da Margem Prevista: ${deviation > 0 ? \'+\' : \'\'}${deviation.toFixed(1)}%\n`;
      }
    }
  }

  if (previousInsights) {
    prompt += `\n\n**Analises anteriores desta entidade**:\n${previousInsights}`;
  }

  prompt += `\n\nAvalie se esta cotacao e rentavel, se esta acima ou abaixo da media, e se o preco esta adequado em relacao ao piso ANTT. Se houver dados da OS finalizada, compare a rentabilidade prevista com a real, identificando os principais fatores que causaram desvios (ex: custos extras, diferenca no custo do carreteiro).`;

  return prompt;
}
```

## 5. Atualização do Schema de Saída (`QuoteProfitabilityResult`)

O tipo `QuoteProfitabilityResult` (definido em `../prompts/schemas.ts`) precisará ser estendido para incluir os novos campos relacionados à rentabilidade real.

```typescript
// Em ../prompts/schemas.ts

export interface OccurrenceDetail {
  description: string;
  cost: number;
  type: string;
}

export interface RealProfitabilityMetrics {
  margem_percent_real: number;
  resultado_liquido_real: number;
  custos_extras_ocorrencias: number;
  detalhes_ocorrencias: OccurrenceDetail[];
  desvio_margem_prevista_real?: number; // Opcional, se a prevista estiver disponível
}

export interface QuoteProfitabilityResult {
  risk: \'baixo\' | \'medio\' | \'alto\';
  confidence_score: number;
  metrics: {
    margem_percent: number;
    margem_vs_media: \'acima\' | \'abaixo\' | \'na_media\';
    desvio_da_media_pct: number;
    atende_piso_antt: boolean;
    valor_por_km: number | null;
  };
  recommendation: string;
  summary: string;
  details: string;
  real_profitability?: RealProfitabilityMetrics; // Novo campo opcional
  // ... outros campos existentes
}
```

## 6. Considerações Adicionais

*   **Status da OS**: A análise de rentabilidade real só deve ser acionada se a OS estiver em um estágio final (ex: `'entregue'`). Isso evita análises prematuras com dados incompletos.
*   **Performance**: As novas chamadas ao banco de dados (`orders` e `occurrences`) introduzirão latência. É importante monitorar o tempo de execução do worker e considerar estratégias de otimização de consultas ou caching, se necessário.
*   **Robustez**: Garantir que todos os campos numéricos sejam tratados com segurança (ex: `Number(value) || 0`) para evitar erros de parsing.
*   **Contexto para o LLM**: O prompt deve ser claro ao diferenciar os dados previstos (da cotação) dos dados reais (da OS), para que o LLM possa fazer uma comparação precisa e identificar os fatores de desvio. A instrução final do prompt foi atualizada para guiar o LLM nessa comparação.

Com essas modificações, o `quoteProfitabilityWorker.ts` será capaz de fornecer insights muito mais ricos e acionáveis sobre a rentabilidade das operações, permitindo um aprendizado contínuo e aprimoramento dos processos de precificação e gestão de custos.
