# Análise Detalhada do `operationalInsightsWorker.ts`

Este documento apresenta uma análise aprofundada do `operationalInsightsWorker.ts`, o componente responsável por gerar insights estratégicos e acionáveis a partir de dados operacionais dos últimos 30 dias. A análise abrange a lógica de cálculo de métricas, a interação com o Large Language Model (LLM) e um fluxograma visual do processo.

## 1. Visão Geral e Lógica de Negócio

O `operationalInsightsWorker.ts` atua como um motor de inteligência operacional. Ele agrega dados de ordens, ocorrências, compliance e qualificações de motoristas para identificar padrões, gargalos e tendências que impactam a eficiência da Vectra Cargo.

### 1.1. Métricas Calculadas Programaticamente

Antes de enviar os dados para o LLM, o worker realiza diversos cálculos em TypeScript para fornecer um contexto rico e estruturado:

*   **Identificação de Gargalos (`identifyBottlenecks`)**: Agrupa ordens por estágio para identificar onde o fluxo de trabalho está acumulando.
*   **Tempo Médio de Resolução (`computeAvgResolutionTime`)**: Calcula o tempo médio (em horas) entre a criação e a resolução de ocorrências.
*   **Problemas por Rota (`computeRouteIssues`)**: Cruza dados de ordens e ocorrências para identificar as 5 rotas com maior incidência de problemas.
*   **Tendências de Carreteiro (`computeCarreteiroTrends`)**: Compara o valor médio pago ao motorista (`carreteiro_real`) com o piso da ANTT (`carreteiro_antt`), calculando o desvio percentual.
*   **Alertas de Qualificação**: Identifica habilitações de motoristas que vencerão nos próximos 30 dias.

### 1.2. Fluxo de Execução

1.  **Coleta de Dados (30 dias)**: A função `fetchOperationalMetrics` utiliza `Promise.all` para buscar dados históricos de ordens, ocorrências, compliance e qualificações.
2.  **Processamento de Métricas**: As funções auxiliares (`identifyBottlenecks`, `computeAvgResolutionTime`, etc.) processam os dados brutos em indicadores de performance (KPIs).
3.  **Construção do Prompt**: A função `buildPrompt` organiza os KPIs em um formato estruturado, solicitando ao LLM a geração de 3 a 5 insights acionáveis com sugestões de ações concretas.
4.  **Invocação do LLM (Ponto de Atenção)**: O worker chama o `callLLM` utilizando o `SYSTEM_PROMPT_DASHBOARD`. **Nota**: Este prompt é originalmente desenhado para o dashboard financeiro, o que pode enviesar a análise operacional.
5.  **Persistência**: O insight gerado é salvo na tabela `ai_insights` com um TTL de 24 horas, garantindo que a análise seja sempre atualizada diariamente.

## 2. Fluxograma do `operationalInsightsWorker.ts`

```mermaid
graph TD
    A[Início: executeOperationalInsightsWorker] --> B[fetchOperationalMetrics (Últimos 30 dias)]
    B --> C[Calcular KPIs: Gargalos, Resolução, Rotas, Tendências]
    C --> D[buildPrompt (KPIs Estruturados)]
    D --> E[callLLM (Geração de Insights Acionáveis)]
    E --> F[Validar e Parsear Resposta do LLM]
    F --> G[Inserir em ai_insights (TTL 24h)]
    G --> H[Fim: Retornar Análise]
```

## 3. Pontos de Desequilíbrio e Oportunidades de Melhoria

### 3.1. Inadequação do Prompt do Sistema (Crítico)

*   **Problema**: O worker utiliza o `SYSTEM_PROMPT_DASHBOARD`, que possui um contexto fortemente financeiro. Isso pode fazer com que o LLM ignore nuances operacionais importantes ou tente forçar uma interpretação financeira sobre dados de logística pura (como gargalos de pátio ou problemas de rota).
*   **Oportunidade**: Criar um `SYSTEM_PROMPT_OPERATIONAL_INSIGHTS` dedicado, focado em eficiência logística, gestão de riscos operacionais e produtividade da frota.

### 3.2. Carga de Dados e Performance

*   **Problema**: Assim como o `operationalReportWorker`, este worker busca grandes volumes de dados (`orders`, `occurrences`, etc.) dos últimos 30 dias para processar em memória na Edge Function.
*   **Oportunidade**: Utilizar funções de agregação do Supabase/PostgreSQL para calcular os KPIs (médias, contagens, agrupamentos) diretamente no banco de dados, enviando apenas os resultados finais para o worker.

### 3.3. Falta de Contexto de "Rentabilidade Real"

*   **Problema**: O worker compara `carreteiro_real` com `carreteiro_antt`, mas não considera os custos extras de ocorrências ou a conciliação financeira (conforme discutido na análise do `quoteProfitabilityWorker`).
*   **Oportunidade**: Integrar os dados de `paid_amount` e custos de ocorrências para fornecer insights sobre o impacto operacional no lucro real da empresa.

### 3.4. Acoplamento e Orquestração

*   **Problema**: O worker gerencia a busca de dados, o cálculo de métricas e a persistência.
*   **Oportunidade**: Desacoplar o cálculo de métricas em uma camada de serviço ou "Data Views". O worker deve focar apenas na interpretação desses dados via IA.

## 4. Conclusão

O `operationalInsightsWorker.ts` é o "cérebro" analítico da operação. Ele transforma dados históricos em inteligência competitiva. No entanto, a reutilização de prompts financeiros e o processamento pesado de dados em memória são gargalos que precisam ser resolvidos para garantir a precisão dos insights e a escalabilidade do sistema. A criação de um prompt operacional específico e a otimização das consultas ao banco de dados são as prioridades imediatas para este componente.
