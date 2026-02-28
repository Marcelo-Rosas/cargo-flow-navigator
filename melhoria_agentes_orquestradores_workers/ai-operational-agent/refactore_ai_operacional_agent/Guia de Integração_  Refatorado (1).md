# Guia de Integração: `stageGateWorker.ts` Refatorado

Este documento detalha as mudanças no `stageGateWorker.ts` e fornece um guia sobre como integrá-lo na arquitetura multi-agente, especialmente com um orquestrador central. O objetivo da refatoração foi desacoplar o worker das responsabilidades de infraestrutura (acesso a banco de dados e notificações) para que ele se concentre exclusivamente na lógica de validação de transição de estágios.

## 1. Visão Geral da Refatoração

O `stageGateWorker.ts` original atuava como um mini-orquestrador, buscando dados da ordem, persistindo notificações diretamente. Na versão refatorada, essas responsabilidades foram removidas, e o worker agora espera receber todos os dados necessários e retorna os resultados brutos para que um orquestrador os processe.

### 1.1. Principais Mudanças

*   **Remoção de Acesso ao Banco de Dados**: Todas as chamadas `ctx.sb.from(...)` foram removidas do worker. Ele não busca mais dados da ordem nem persiste notificações em `notification_logs`.
*   **Remoção de Lógica de Notificação Direta**: O worker não insere mais notificações diretamente.
*   **Nova Interface de Entrada (`RefactoredWorkerContext`)**: O worker agora espera um objeto `orderData` completo, que deve ser pré-buscado pelo orquestrador, além do `targetStage`.
*   **Nova Interface de Saída (`RefactoredWorkerResult`)**: O worker retorna um objeto contendo:
    *   `analysis`: O resultado da análise da validação de estágio.
    *   `durationMs`, `provider`: Metadados da execução.
    *   `notifications`: Uma lista de objetos que representam as notificações a serem enviadas, sem a lógica de persistência.
    *   `stage_gate_data`: Os dados formatados para serem inseridos na tabela `stage_gates` (ou similar).

## 2. Como Integrar o Worker Refatorado

A integração do `stageGateWorker.ts` refatorado requer que um **Agente Orquestrador** (ex: `ai-orchestrator-agent`) assuma as responsabilidades de pré-processamento de dados, pós-processamento de resultados e gerenciamento de notificações.

### 2.1. Fluxo de Integração Proposto

```mermaid
graph TD
    A[Orquestrador: Início] --> B[Receber Evento: Transição de Estágio (orderId, targetStage)]
    B --> C[Orquestrador: Buscar Dados da Ordem (Supabase)]
    C --> D{Dados da Ordem Encontrados?}
    D -- Não --> E[Orquestrador: Logar Erro / Notificar Falha]
    D -- Sim --> F[Orquestrador: Preparar RefactoredWorkerContext]
    F --> G[Chamar stageGateWorker.ts (Refatorado)]
    G --> H[Worker: Executar Lógica de Regras]
    H --> I[Worker: Retornar RefactoredWorkerResult]
    I --> J[Orquestrador: Persistir stage_gate_data (Supabase)]
    J --> K[Orquestrador: Processar notifications (Serviço Unificado)]
    K --> L[Orquestrador: Fim]
    E --> L
```

### 2.2. Responsabilidades do Orquestrador

O Agente Orquestrador terá as seguintes responsabilidades ao interagir com o `stageGateWorker.ts` refatorado:

1.  **Pré-processamento de Dados**:
    *   Receber o `orderId` e `targetStage` que acionam a validação de estágio.
    *   Buscar todos os dados relevantes da ordem do Supabase ou de outras fontes de dados.
    *   Construir o objeto `RefactoredWorkerContext` com `orderData` e `targetStage`.

2.  **Invocação do Worker**:
    *   Chamar a função `executeStageGateWorker` com o `RefactoredWorkerContext` preparado.

3.  **Pós-processamento de Resultados**:
    *   Receber o `RefactoredWorkerResult` retornado pelo worker.
    *   **Persistência de Stage Gate**: Utilizar `stage_gate_data` para inserir o registro na tabela `stage_gates` (ou similar) no Supabase.
    *   **Gerenciamento de Notificações**: Iterar sobre a lista `notifications` e encaminhá-las para um serviço de notificação unificado (ex: um `notification-agent` dedicado ou uma fila de mensagens que outro serviço consome).

### 2.3. Exemplo de Pseudocódigo do Orquestrador

```typescript
// Exemplo de como o orquestrador chamaria o worker refatorado
import { executeStageGateWorker, Stage } from './refactored_stageGateWorker.ts';

async function orchestrateStageGate(orderId: string, targetStage: Stage, sbClient: any, notificationService: any) {
  // 1. Pré-processamento: Buscar dados da ordem
  const { data: orderData, error: orderError } = await sbClient
    .from("orders")
    .select("*") // Selecionar todos os campos necessários para a validação
    .eq("id", orderId)
    .single();

  if (orderError || !orderData) {
    console.error(`Erro ao buscar ordem ${orderId}:`, orderError);
    return;
  }

  // 2. Preparar contexto e chamar o worker
  const workerContext = {
    orderData: orderData,
    targetStage: targetStage,
  };

  const workerResult = await executeStageGateWorker(workerContext);

  // 3. Pós-processamento: Persistir resultados e enviar notificações

  // Persistir dados do Stage Gate
  await sbClient.from("stage_gates").insert(workerResult.stage_gate_data);

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

  console.log(`Validação de estágio para ordem ${orderId} orquestrada com sucesso.`);
}
```

## 3. Benefícios da Refatoração

*   **Desacoplamento**: O worker se torna uma unidade de lógica de regras pura, mais fácil de testar e manter.
*   **Escalabilidade**: O orquestrador pode gerenciar a execução de múltiplos workers de forma eficiente, distribuindo a carga.
*   **Flexibilidade**: A lógica de persistência e notificação pode ser alterada no orquestrador sem impactar o worker de regras.
*   **Reusabilidade**: O worker pode ser facilmente integrado em diferentes fluxos de trabalho que exijam validação de estágio, sem a necessidade de reescrever a lógica de dados.

Esta refatoração é um passo crucial para a construção de uma arquitetura multi-agente robusta e escalável, conforme as diretrizes da skill `transport-agent-architect`.
