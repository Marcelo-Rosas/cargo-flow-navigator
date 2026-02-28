# Atualização do Prompt e Schema de Saída para Análise de Rentabilidade Real

Este documento detalha as modificações propostas para a função `buildPrompt` e o schema de saída `QuoteProfitabilityResult` no `quoteProfitabilityWorker.ts`. O objetivo é capacitar o LLM a realizar uma análise comparativa entre a rentabilidade prevista (da cotação) e a rentabilidade real (da OS finalizada), considerando custos adicionais e ocorrências.

## 1. Atualização da Função `buildPrompt`

A função `buildPrompt` será estendida para incluir os dados da Ordem de Serviço (OS) finalizada, a rentabilidade real calculada e os detalhes das ocorrências. Isso fornecerá ao LLM um contexto rico para a análise comparativa.

### 1.1. Novos Parâmetros

A assinatura da função `buildPrompt` será atualizada para aceitar os seguintes novos parâmetros:

```typescript
function buildPrompt(
  quote: any,
  historical: any,
  clientHistory: any[],
  previousInsights?: string,
  orderData?: any, // Dados da OS associada, se houver e estiver finalizada
  realProfitability?: { margemPercent: number; resultadoLiquido: number }, // Rentabilidade real calculada
  occurrenceDetails?: { description: string; cost: number; type: string }[] // Detalhes das ocorrências com custos
): string {
  // ... (código existente)
}
```

### 1.2. Inclusão de Dados da OS e Rentabilidade Real no Prompt

O corpo do prompt será modificado para apresentar claramente os dados da OS, os custos reais e a rentabilidade final, contrastando-os com os dados previstos da cotação. A instrução final para o LLM também será aprimorada para guiar a análise comparativa.

```typescript
// ... (parte inicial do prompt com dados da cotação prevista)

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
               `- Margem %: ${profitability?.margemPercent ?? profitability?.margem_percent ?? \'N/A\'}\%\n` +
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
      prompt += `- Margem % Real: ${realProfitability.margemPercent.toFixed(1)}\%\n`;
      prompt += `- Resultado Liquido Real: R$ ${realProfitability.resultadoLiquido.toFixed(2)}\n`;
      prompt += `- Status de Conciliacao: ${realProfitability.isReconciled ? \'CONCILIADO (Custo Final Comprovado)\' : \'PENDENTE (Custo Estimado)\'}\n`;
      const predictedMargin = quote.pricing_breakdown?.profitability?.margemPercent ?? quote.pricing_breakdown?.profitability?.margem_percent;
      if (predictedMargin !== undefined && predictedMargin !== null) {
        const deviation = realProfitability.margemPercent - predictedMargin;
        prompt += `- Desvio da Margem Prevista: ${deviation > 0 ? \'+\' : \'\'}${deviation.toFixed(1)}\%\n`;
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

### 1.3. Racional

*   **Clareza na Diferenciação**: Ao rotular explicitamente 
os campos como "Previsto" e "Real", o LLM será capaz de distinguir claramente entre as estimativas iniciais e os resultados concretos.
*   **Instrução Direcionada**: A instrução final do prompt foi aprimorada para guiar o LLM a realizar uma análise comparativa, identificando os fatores que levaram a desvios entre a rentabilidade prevista e a real. Isso é crucial para gerar insights acionáveis.
*   **Detalhes de Ocorrências**: A inclusão dos detalhes das ocorrências permite que o LLM entenda a natureza dos custos extras, o que pode ser valioso para identificar padrões e propor melhorias nos processos.

## 2. Atualização do Schema de Saída (`QuoteProfitabilityResult`)

O tipo `QuoteProfitabilityResult` (definido em `../prompts/schemas.ts`) precisará ser estendido para incluir os novos campos relacionados à rentabilidade real. Isso garantirá que a análise do LLM seja estruturada e facilmente consumível por outros sistemas ou interfaces de usuário.

### 2.1. Novos Tipos de Interface

Serão adicionados dois novos tipos de interface para estruturar os detalhes das ocorrências e as métricas de rentabilidade real:

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
  desvio_margem_prevista_real?: number;
  is_reconciled: boolean; // Indica se o custo é final (comprovado) ou apenas acordado
}
```

### 2.2. Adição de Campo Opcional em `QuoteProfitabilityResult`

O campo `real_profitability` será adicionado como opcional ao `QuoteProfitabilityResult`, contendo as métricas de rentabilidade real.

```typescript
// Em ../prompts/schemas.ts

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

### 2.3. Racional

*   **Estrutura Clara**: A criação de interfaces dedicadas (`OccurrenceDetail`, `RealProfitabilityMetrics`) garante que os dados de rentabilidade real sejam bem estruturados e fáceis de serem consumidos programaticamente.
*   **Flexibilidade**: O campo `real_profitability` é opcional, o que permite que o worker continue funcionando mesmo quando a OS ainda não foi finalizada ou quando os dados de custo real não estão disponíveis.
*   **Insights Acionáveis**: Ao incluir o `desvio_margem_prevista_real`, o LLM pode quantificar a diferença entre o previsto e o real, fornecendo um insight direto sobre a precisão da precificação inicial e os impactos dos custos adicionais.

## 3. Considerações Finais

Essas atualizações no prompt e no schema de saída são cruciais para que o `quoteProfitabilityWorker.ts` possa fornecer uma análise de rentabilidade mais completa e precisa. Ao apresentar ao LLM tanto os dados previstos quanto os reais, e ao orientá-lo a comparar e identificar desvios, o sistema poderá gerar insights mais valiosos para a tomada de decisão e para o aprimoramento contínuo dos processos de logística.
