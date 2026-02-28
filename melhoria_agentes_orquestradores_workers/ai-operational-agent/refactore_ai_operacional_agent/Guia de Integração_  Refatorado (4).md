# Guia de Integração: `operationalInsightsWorker.ts` Refatorado

Este documento detalha as mudanças no `operationalInsightsWorker.ts` e fornece um guia sobre como integrá-lo na arquitetura multi-agente, especialmente com um orquestrador central. O objetivo da refatoração foi desacoplar o worker das responsabilidades de infraestrutura (acesso a banco de dados) para que ele se concentre exclusivamente na lógica de agregação de dados e geração de insights operacionais via IA.

## 1. Visão Geral da Refatoração

O `operationalInsightsWorker.ts` original atuava como um mini-orquestrador, buscando múltiplos conjuntos de dados do Supabase, agregando-os e persistindo os resultados diretamente. Na versão refatorada, essas responsabilidades foram removidas, e o worker agora espera receber todos os dados operacionais pré-buscados e agregados, retornando os resultados brutos para que um orquestrador os processe.

### 1.1. Principais Mudanças

*   **Remoção de Acesso ao Banco de Dados**: Todas as chamadas `ctx.sb.from(...)` foram removidas do worker. Ele não busca mais dados operacionais nem persiste resultados em `ai_insights`.
*   **Nova Interface de Entrada (`RefactoredWorkerContext`)**: O worker agora espera um objeto `operationalData` completo, que deve ser pré-buscado e agregado pelo orquestrador, além do `model`.
*   **Nova Interface de Saída (`RefactoredWorkerResult`)**: O worker retorna um objeto contendo:
    *   `analysis`: O resultado da análise da IA (os insights operacionais).
    *   `durationMs`, `provider`: Metadados da execução do LLM.
    *   `ai_insight_data`: Os dados formatados para serem inseridos na tabela `ai_insights`.

## 2. Como Integrar o Worker Refatorado

A integração do `operationalInsightsWorker.ts` refatorado requer que um **Agente Orquestrador** (ex: `ai-orchestrator-agent`) assuma as responsabilidades de pré-processamento de dados, agregação, pós-processamento de resultados e gerenciamento de notificações.

### 2.1. Fluxo de Integração Proposto

```mermaid
graph TD
    A[Orquestrador: Início] --> B[Receber Evento: Gerar Insights Operacionais]
    B --> C[Orquestrador: Buscar e Agregar Dados Operacionais (Supabase)]
    C --> D{Dados Encontrados?}
    D -- Não --> E[Orquestrador: Logar Erro / Notificar Falha]
    D -- Sim --> F[Orquestrador: Preparar RefactoredWorkerContext]
    F --> G[Chamar operationalInsightsWorker.ts (Refatorado)]
    G --> H[Worker: Executar Lógica de Agregação e IA]
    H --> I[Worker: Retornar RefactoredWorkerResult]
    I --> J[Orquestrador: Persistir ai_insight_data (Supabase)]
    J --> K[Orquestrador: Fim]
    E --> K
```

### 2.2. Responsabilidades do Orquestrador

O Agente Orquestrador terá as seguintes responsabilidades ao interagir com o `operationalInsightsWorker.ts` refatorado:

1.  **Pré-processamento de Dados e Agregação**:
    *   Receber o evento que aciona a geração de insights operacionais.
    *   Calcular o período de tempo (ex: últimos 30 dias).
    *   Buscar e agregar todos os dados operacionais relevantes (ordens, ocorrências, compliance, qualificações de motorista) do Supabase. É crucial que o orquestrador utilize **consultas agregadas** no banco de dados para evitar a busca de grandes volumes de dados em memória, otimizando a performance.
    *   Construir o objeto `RefactoredWorkerContext` com `operationalData` e `model`.

2.  **Invocação do Worker**:
    *   Chamar a função `executeOperationalInsightsWorker` com o `RefactoredWorkerContext` preparado.

3.  **Pós-processamento de Resultados**:
    *   Receber o `RefactoredWorkerResult` retornado pelo worker.
    *   **Persistência de Insights**: Utilizar `ai_insight_data` para inserir o registro na tabela `ai_insights` no Supabase.

### 2.3. Exemplo de Pseudocódigo do Orquestrador

```typescript
// Exemplo de como o orquestrador chamaria o worker refatorado
import { executeOperationalInsightsWorker } from './refactored_operationalInsightsWorker.ts';

async function orchestrateOperationalInsights(sbClient: any) {
  // 1. Pré-processamento: Buscar e agregar dados operacionais
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: orders },
    { data: occurrences },
    { data: complianceChecks },
    { data: driverQualifications },
  ] = await Promise.all([
    sbClient
      .from('orders')
      .select('id, stage, value, created_at, origin, destination, carreteiro_real, carreteiro_antt')
      .gte('created_at', thirtyDaysAgo),
    sbClient
      .from('occurrences')
      .select('severity, status, type, created_at, resolved_at, order_id')
      .gte('created_at', thirtyDaysAgo),
    sbClient
      .from('compliance_checks')
      .select('status, violation_type, entity_type, created_at')
      .gte('created_at', thirtyDaysAgo),
    sbClient
      .from('driver_qualifications')
      .select('driver_id, status, expires_at, qualification_type')
      .gte('created_at', thirtyDaysAgo),
  ]);

  const operationalData = {
    orders: orders || [],
    occurrences: occurrences || [],
    complianceChecks: complianceChecks || [],
    driverQualifications: driverQualifications || [],
  };

  // 2. Preparar contexto e chamar o worker
  const workerContext = {
    operationalData: operationalData,
    model: 'gpt-4.1-mini', // Ou outro modelo configurado
  };

  const workerResult = await executeOperationalInsightsWorker(workerContext);

  // 3. Pós-processamento: Persistir resultados
  await sbClient.from('ai_insights').insert(workerResult.ai_insight_data);

  console.log('Insights operacionais orquestrados com sucesso.');
}
```

## 3. Benefícios da Refatoração

*   **Desacoplamento**: O worker se torna uma unidade de lógica de IA e agregação de dados pura, mais fácil de testar e manter.
*   **Performance Otimizada**: A responsabilidade de buscar e agregar grandes volumes de dados é movida para o orquestrador, que pode utilizar consultas de banco de dados mais eficientes e estratégias de cache.
*   **Flexibilidade**: A lógica de persistência pode ser alterada no orquestrador sem impactar o worker de insights.
*   **Reusabilidade**: O worker pode ser facilmente integrado em diferentes fluxos de trabalho que exijam geração de insights operacionais, sem a necessidade de reescrever a lógica de dados.

Esta refatoração é um passo crucial para a construção de uma arquitetura multi-agente robusta e escalável, conforme as diretrizes da skill `transport-agent-architect`.
