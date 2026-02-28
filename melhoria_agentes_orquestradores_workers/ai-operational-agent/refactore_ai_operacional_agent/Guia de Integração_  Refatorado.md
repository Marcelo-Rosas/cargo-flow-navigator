# Guia de Integração: `complianceCheckWorker.ts` Refatorado

Este documento detalha as mudanças no `complianceCheckWorker.ts` e fornece um guia sobre como integrá-lo na arquitetura multi-agente, especialmente com um orquestrador central. O objetivo da refatoração foi desacoplar o worker das responsabilidades de infraestrutura (acesso a banco de dados e notificações) para que ele se concentre exclusivamente na lógica de análise de IA e regras de negócio.

## 1. Visão Geral da Refatoração

O `complianceCheckWorker.ts` original atuava como um mini-orquestrador, buscando dados da ordem e cotação, persistindo resultados e enviando notificações diretamente. Na versão refatorada, essas responsabilidades foram removidas, e o worker agora espera receber todos os dados necessários e retorna os resultados brutos para que um orquestrador os processe.

### 1.1. Principais Mudanças

*   **Remoção de Acesso ao Banco de Dados**: Todas as chamadas `ctx.sb.from(...)` foram removidas do worker. Ele não busca mais dados da ordem/cotação nem persiste resultados em `compliance_checks` ou `ai_insights`.
*   **Remoção de Lógica de Notificação Direta**: O worker não insere mais notificações diretamente em `notification_logs`.
*   **Nova Interface de Entrada (`RefactoredWorkerContext`)**: O worker agora espera objetos `orderData` e `quoteData` completos, que devem ser pré-buscados pelo orquestrador, além do `checkType` e `model`.
*   **Nova Interface de Saída (`RefactoredWorkerResult`)**: O worker retorna um objeto contendo:
    *   `analysis`: O resultado da análise da IA.
    *   `durationMs`, `provider`: Metadados da execução do LLM.
    *   `notifications`: Uma lista de objetos que representam as notificações a serem enviadas, sem a lógica de persistência.
    *   `ai_insight_data`: Os dados formatados para serem inseridos na tabela `ai_insights`.
    *   `compliance_check_data`: Os dados formatados para serem inseridos na tabela `compliance_checks`.

## 2. Como Integrar o Worker Refatorado

A integração do `complianceCheckWorker.ts` refatorado requer que um **Agente Orquestrador** (ex: `ai-orchestrator-agent`) assuma as responsabilidades de pré-processamento de dados, pós-processamento de resultados e gerenciamento de notificações.

### 2.1. Fluxo de Integração Proposto

```mermaid
graph TD
    A[Orquestrador: Início] --> B[Receber Evento: Checagem de Compliance (orderId, checkType)]
    B --> C[Orquestrador: Buscar Dados da Ordem e Cotação (Supabase)]
    C --> D{Dados Encontrados?}
    D -- Não --> E[Orquestrador: Logar Erro / Notificar Falha]
    D -- Sim --> F[Orquestrador: Preparar RefactoredWorkerContext]
    F --> G[Chamar complianceCheckWorker.ts (Refatorado)]
    G --> H[Worker: Executar Lógica de Regras e IA]
    H --> I[Worker: Retornar RefactoredWorkerResult]
    I --> J[Orquestrador: Persistir compliance_check_data (Supabase)]
    J --> K[Orquestrador: Persistir ai_insight_data (Supabase)]
    K --> L[Orquestrador: Processar notifications (Serviço Unificado)]
    L --> M[Orquestrador: Fim]
    E --> M
```

### 2.2. Responsabilidades do Orquestrador

O Agente Orquestrador terá as seguintes responsabilidades ao interagir com o `complianceCheckWorker.ts` refatorado:

1.  **Pré-processamento de Dados**:
    *   Receber o `orderId` e `checkType` que acionam a checagem de compliance.
    *   Buscar todos os dados relevantes da ordem e da cotação vinculada do Supabase ou de outras fontes de dados.
    *   Construir o objeto `RefactoredWorkerContext` com `orderData`, `quoteData`, `checkType` e `model`.
    *   (Opcional) Buscar `previousInsights` da tabela `ai_insights` se a lógica de IA precisar de contexto histórico.

2.  **Invocação do Worker**:
    *   Chamar a função `executeComplianceCheckWorker` com o `RefactoredWorkerContext` preparado.

3.  **Pós-processamento de Resultados**:
    *   Receber o `RefactoredWorkerResult` retornado pelo worker.
    *   **Persistência de Checagem de Compliance**: Utilizar `compliance_check_data` para inserir o registro na tabela `compliance_checks` no Supabase.
    *   **Persistência de Insights**: Utilizar `ai_insight_data` para inserir o registro na tabela `ai_insights` no Supabase.
    *   **Gerenciamento de Notificações**: Iterar sobre a lista `notifications` e encaminhá-las para um serviço de notificação unificado (ex: um `notification-agent` dedicado ou uma fila de mensagens que outro serviço consome).

### 2.3. Exemplo de Pseudocódigo do Orquestrador

```typescript
// Exemplo de como o orquestrador chamaria o worker refatorado
import { executeComplianceCheckWorker } from './refactored_complianceCheckWorker.ts';

async function orchestrateComplianceCheck(orderId: string, checkType: CheckType, sbClient: any, notificationService: any) {
  // 1. Pré-processamento: Buscar dados da ordem e cotação
  const { data: orderData, error: orderError } = await sbClient
    .from("orders")
    .select("*, quote_id")
    .eq("id", orderId)
    .single();

  if (orderError || !orderData) {
    console.error(`Erro ao buscar ordem ${orderId}:`, orderError);
    return;
  }

  let quoteData = null;
  if (orderData.quote_id) {
    const { data: quote, error: quoteError } = await sbClient
      .from("quotes")
      .select("*, pricing_breakdown")
      .eq("id", orderData.quote_id)
      .single();
    if (quoteError) {
      console.error(`Erro ao buscar cotação ${orderData.quote_id}:`, quoteError);
    }
    quoteData = quote;
  }

  // (Opcional) Buscar previousInsights
  const { data: previousInsightsData } = await sbClient
    .from("ai_insights")
    .select("analysis")
    .eq("entity_id", orderId)
    .eq("insight_type", "compliance_check")
    .order("created_at", { ascending: false })
    .limit(1);
  const previousInsights = previousInsightsData?.[0]?.analysis?.summary_text || undefined;

  // 2. Preparar contexto e chamar o worker
  const workerContext = {
    orderData: orderData,
    quoteData: quoteData,
    checkType: checkType,
    model: "gpt-4.1-mini", // Ou outro modelo configurado
    previousInsights: previousInsights,
  };

  const workerResult = await executeComplianceCheckWorker(workerContext);

  // 3. Pós-processamento: Persistir resultados e enviar notificações

  // Persistir checagem de compliance
  await sbClient.from("compliance_checks").insert(workerResult.compliance_check_data);

  // Persistir insights de IA
  await sbClient.from("ai_insights").insert(workerResult.ai_insight_data);

  // Processar notificações
  for (const notification of workerResult.notifications) {
    await notificationService.sendNotification({
      template: notification.template_key,
      channel: "system", // O orquestrador decide o canal final
      recipient: "operacional", // O orquestrador decide o destinatário
      payload: notification.metadata,
      entity_type: notification.entity_type,
      entity_id: notification.entity_id,
    });
  }

  console.log("Checagem de compliance orquestrada com sucesso.");
}
```

## 3. Benefícios da Refatoração

*   **Desacoplamento**: O worker se torna uma unidade de lógica de IA e regras de negócio pura, mais fácil de testar e manter.
*   **Escalabilidade**: O orquestrador pode gerenciar a execução de múltiplos workers de forma eficiente, distribuindo a carga.
*   **Flexibilidade**: A lógica de persistência e notificação pode ser alterada no orquestrador sem impactar o worker de IA.
*   **Reusabilidade**: O worker pode ser facilmente integrado em diferentes fluxos de trabalho que exijam checagens de compliance, sem a necessidade de reescrever a lógica de dados.

Esta refatoração é um passo crucial para a construção de uma arquitetura multi-agente robusta e escalável, conforme as diretrizes da skill `transport-agent-architect`.
