# Guia de Integração: `driverQualificationWorker.ts` Refatorado

Este documento detalha as mudanças no `driverQualificationWorker.ts` e fornece um guia sobre como integrá-lo na arquitetura multi-agente, especialmente com um orquestrador central. O objetivo da refatoração foi desacoplar o worker das responsabilidades de infraestrutura (acesso a banco de dados e notificações) para que ele se concentre exclusivamente na lógica de análise de IA.

## 1. Visão Geral da Refatoração

O `driverQualificationWorker.ts` original atuava como um mini-orquestrador, buscando dados da ordem, persistindo resultados e enviando notificações diretamente. Na versão refatorada, essas responsabilidades foram removidas, e o worker agora espera receber todos os dados necessários e retorna os resultados brutos para que um orquestrador os processe.

### 1.1. Principais Mudanças

*   **Remoção de Acesso ao Banco de Dados**: Todas as chamadas `ctx.sb.from(...)` foram removidas do worker. Ele não busca mais dados da ordem nem persiste resultados em `driver_qualifications` ou `ai_insights`.
*   **Remoção de Lógica de Notificação Direta**: O worker não insere mais notificações diretamente em `notification_logs` ou `notification_queue`.
*   **Nova Interface de Entrada (`RefactoredWorkerContext`)**: O worker agora espera um objeto `orderData` completo, que deve ser pré-buscado pelo orquestrador.
*   **Nova Interface de Saída (`RefactoredWorkerResult`)**: O worker retorna um objeto contendo:
    *   `analysis`: O resultado da análise da IA.
    *   `durationMs`, `provider`: Metadados da execução do LLM.
    *   `notifications`: Uma lista de objetos que representam as notificações a serem enviadas, sem a lógica de persistência.
    *   `ai_insight_data`: Os dados formatados para serem inseridos na tabela `ai_insights`.
    *   `driver_qualification_data`: Os dados formatados para serem inseridos/atualizados na tabela `driver_qualifications`.

## 2. Como Integrar o Worker Refatorado

A integração do `driverQualificationWorker.ts` refatorado requer que um **Agente Orquestrador** (ex: `ai-orchestrator-agent`) assuma as responsabilidades de pré-processamento de dados, pós-processamento de resultados e gerenciamento de notificações.

### 2.1. Fluxo de Integração Proposto

```mermaid
graph TD
    A[Orquestrador: Início] --> B[Receber Evento: Qualificar Motorista (orderId)]
    B --> C[Orquestrador: Buscar Dados da Ordem (Supabase)]
    C --> D{Dados da Ordem Encontrados?}
    D -- Não --> E[Orquestrador: Logar Erro / Notificar Falha]
    D -- Sim --> F[Orquestrador: Preparar RefactoredWorkerContext]
    F --> G[Chamar driverQualificationWorker.ts (Refatorado)]
    G --> H[Worker: Executar Lógica de IA]
    H --> I[Worker: Retornar RefactoredWorkerResult]
    I --> J[Orquestrador: Persistir driver_qualification_data (Supabase)]
    J --> K[Orquestrador: Persistir ai_insight_data (Supabase)]
    K --> L[Orquestrador: Processar notifications (Serviço Unificado)]
    L --> M[Orquestrador: Fim]
    E --> M
```

### 2.2. Responsabilidades do Orquestrador

O Agente Orquestrador terá as seguintes responsabilidades ao interagir com o `driverQualificationWorker.ts` refatorado:

1.  **Pré-processamento de Dados**:
    *   Receber o `orderId` (ou outro identificador) que aciona a qualificação do motorista.
    *   Buscar todos os dados relevantes da ordem (motorista, veículo, documentos, etc.) do Supabase ou de outras fontes de dados.
    *   Construir o objeto `RefactoredWorkerContext` com `orderData` e `model`.
    *   (Opcional) Buscar `previousInsights` da tabela `ai_insights` se a lógica de IA precisar de contexto histórico.

2.  **Invocação do Worker**:
    *   Chamar a função `executeDriverQualificationWorker` com o `RefactoredWorkerContext` preparado.

3.  **Pós-processamento de Resultados**:
    *   Receber o `RefactoredWorkerResult` retornado pelo worker.
    *   **Persistência de Qualificação**: Utilizar `driver_qualification_data` para inserir ou atualizar o registro na tabela `driver_qualifications` no Supabase.
    *   **Persistência de Insights**: Utilizar `ai_insight_data` para inserir o registro na tabela `ai_insights` no Supabase.
    *   **Gerenciamento de Notificações**: Iterar sobre a lista `notifications` e encaminhá-las para um serviço de notificação unificado (ex: um `notification-agent` dedicado ou uma fila de mensagens que outro serviço consome).

### 2.3. Exemplo de Pseudocódigo do Orquestrador

```typescript
// Exemplo de como o orquestrador chamaria o worker refatorado
import { executeDriverQualificationWorker } from './refactored_driverQualificationWorker.ts';

async function orchestrateDriverQualification(orderId: string, sbClient: any, notificationService: any) {
  // 1. Pré-processamento: Buscar dados da ordem
  const { data: orderData, error } = await sbClient
    .from("orders")
    .select("id, os_number, driver_name, driver_phone, ...") // Selecionar todos os campos necessários
    .eq("id", orderId)
    .single();

  if (error || !orderData) {
    console.error(`Erro ao buscar ordem ${orderId}:`, error);
    // Logar erro, notificar, etc.
    return;
  }

  // (Opcional) Buscar previousInsights
  const { data: previousInsightsData } = await sbClient
    .from("ai_insights")
    .select("analysis")
    .eq("entity_id", orderId)
    .eq("insight_type", "driver_qualification")
    .order("created_at", { ascending: false })
    .limit(1);
  const previousInsights = previousInsightsData?.[0]?.analysis?.summary_text || undefined;

  // 2. Preparar contexto e chamar o worker
  const workerContext = {
    orderData: orderData,
    model: "gpt-4.1-mini", // Ou outro modelo configurado
    previousInsights: previousInsights,
  };

  const workerResult = await executeDriverQualificationWorker(workerContext);

  // 3. Pós-processamento: Persistir resultados e enviar notificações

  // Persistir qualificação do motorista
  const { data: existingQual } = await sbClient
    .from("driver_qualifications")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existingQual) {
    await sbClient.from("driver_qualifications").update(workerResult.driver_qualification_data).eq("id", existingQual.id);
  } else {
    await sbClient.from("driver_qualifications").insert(workerResult.driver_qualification_data);
  }

  // Persistir insights de IA
  await sbClient.from("ai_insights").insert(workerResult.ai_insight_data);

  // Processar notificações
  for (const notification of workerResult.notifications) {
    await notificationService.sendNotification({
      template: notification.template_key,
      channel: notification.channel,
      recipient: notification.recipient_phone || orderData.driver_phone, // Exemplo de fallback
      payload: notification.payload,
      entity_type: "order",
      entity_id: orderId,
    });
  }

  console.log("Qualificação de motorista orquestrada com sucesso.");
}
```

## 3. Benefícios da Refatoração

*   **Desacoplamento**: O worker se torna uma unidade de lógica de IA pura, mais fácil de testar e manter.
*   **Escalabilidade**: O orquestrador pode gerenciar a execução de múltiplos workers de forma eficiente, distribuindo a carga.
*   **Flexibilidade**: A lógica de persistência e notificação pode ser alterada no orquestrador sem impactar o worker de IA.
*   **Reusabilidade**: O worker pode ser facilmente integrado em diferentes fluxos de trabalho que exijam qualificação de motoristas, sem a necessidade de reescrever a lógica de dados.

Esta refatoração é um passo crucial para a construção de uma arquitetura multi-agente robusta e escalável, conforme as diretrizes da skill `transport-agent-architect`.
