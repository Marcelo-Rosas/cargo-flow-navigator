# Guia de Integração: `operationalReportWorker.ts` Refatorado

Este documento detalha as mudanças no `operationalReportWorker.ts` e fornece um guia sobre como integrá-lo na arquitetura multi-agente, especialmente com um orquestrador central. O objetivo da refatoração foi desacoplar o worker das responsabilidades de infraestrutura (acesso a banco de dados e notificações) para que ele se concentre exclusivamente na lógica de agregação de dados e geração de relatórios via IA.

## 1. Visão Geral da Refatoração

O `operationalReportWorker.ts` original atuava como um mini-orquestrador, buscando múltiplos conjuntos de dados do Supabase, persistindo resultados e enviando notificações diretamente. Na versão refatorada, essas responsabilidades foram removidas, e o worker agora espera receber todos os dados operacionais pré-buscados e retorna os resultados brutos para que um orquestrador os processe.

### 1.1. Principais Mudanças

*   **Remoção de Acesso ao Banco de Dados**: Todas as chamadas `ctx.sb.from(...)` foram removidas do worker. Ele não busca mais dados operacionais nem persiste resultados em `operational_reports` ou `notification_queue`.
*   **Remoção de Lógica de Notificação Direta**: O worker não insere mais notificações diretamente.
*   **Nova Interface de Entrada (`RefactoredWorkerContext`)**: O worker agora espera um objeto `operationalData` completo, que deve ser pré-buscado e agregado pelo orquestrador, além do `reportType` e `model`.
*   **Nova Interface de Saída (`RefactoredWorkerResult`)**: O worker retorna um objeto contendo:
    *   `analysis`: O resultado da análise da IA (o relatório operacional).
    *   `durationMs`, `provider`: Metadados da execução do LLM.
    *   `notifications`: Uma lista de objetos que representam as notificações a serem enviadas, sem a lógica de persistência.
    *   `operational_report_data`: Os dados formatados para serem inseridos na tabela `operational_reports`.

## 2. Como Integrar o Worker Refatorado

A integração do `operationalReportWorker.ts` refatorado requer que um **Agente Orquestrador** (ex: `ai-orchestrator-agent`) assuma as responsabilidades de pré-processamento de dados, pós-processamento de resultados e gerenciamento de notificações.

### 2.1. Fluxo de Integração Proposto

```mermaid
graph TD
    A[Orquestrador: Início] --> B[Receber Evento: Gerar Relatório Operacional (reportType)]
    B --> C[Orquestrador: Buscar e Agregar Dados Operacionais (Supabase)]
    C --> D{Dados Encontrados?}
    D -- Não --> E[Orquestrador: Logar Erro / Notificar Falha]
    D -- Sim --> F[Orquestrador: Preparar RefactoredWorkerContext]
    F --> G[Chamar operationalReportWorker.ts (Refatorado)]
    G --> H[Worker: Executar Lógica de Agregação e IA]
    H --> I[Worker: Retornar RefactoredWorkerResult]
    I --> J[Orquestrador: Persistir operational_report_data (Supabase)]
    J --> K[Orquestrador: Processar notifications (Serviço Unificado)]
    K --> L[Orquestrador: Fim]
    E --> L
```

### 2.2. Responsabilidades do Orquestrador

O Agente Orquestrador terá as seguintes responsabilidades ao interagir com o `operationalReportWorker.ts` refatorado:

1.  **Pré-processamento de Dados**:
    *   Receber o `reportType` (`daily` ou `weekly`) que aciona a geração do relatório.
    *   Calcular o período de tempo (`periodStart`).
    *   Buscar e agregar todos os dados operacionais relevantes (ordens, ocorrências, compliance, documentos) do Supabase. É crucial que o orquestrador utilize **consultas agregadas** no banco de dados para evitar a busca de grandes volumes de dados em memória, otimizando a performance.
    *   Construir o objeto `RefactoredWorkerContext` com `operationalData`, `reportType` e `model`.

2.  **Invocação do Worker**:
    *   Chamar a função `executeOperationalReportWorker` com o `RefactoredWorkerContext` preparado.

3.  **Pós-processamento de Resultados**:
    *   Receber o `RefactoredWorkerResult` retornado pelo worker.
    *   **Persistência do Relatório**: Utilizar `operational_report_data` para inserir o registro na tabela `operational_reports` no Supabase.
    *   **Gerenciamento de Notificações**: Iterar sobre a lista `notifications` e encaminhá-las para um serviço de notificação unificado (ex: um `notification-agent` dedicado ou uma fila de mensagens que outro serviço consome).

### 2.3. Exemplo de Pseudocódigo do Orquestrador

```typescript
// Exemplo de como o orquestrador chamaria o worker refatorado
import { executeOperationalReportWorker } from './refactored_operationalReportWorker.ts';

async function orchestrateOperationalReport(reportType: 'daily' | 'weekly', sbClient: any, notificationService: any) {
  // 1. Pré-processamento: Buscar e agregar dados operacionais
  const periodStart = getPeriodStart(reportType); // Função auxiliar para calcular o início do período

  // Exemplo de busca e agregação otimizada (idealmente com funções de agregação do DB)
  const [{ data: allOrders }, { data: createdOrders }, { data: completedOrders }, { data: occurrences }, { data: complianceChecks }, { count: pendingDocsCount }] = await Promise.all([
    sbClient.from('orders').select('stage, created_at, value'), // Exemplo, idealmente usar agregação
    sbClient.from('orders').select('id').gte('created_at', periodStart),
    sbClient.from('orders').select('id, created_at').eq('stage', 'entregue').gte('created_at', periodStart),
    sbClient.from('occurrences').select('severity, status, created_at').gte('created_at', periodStart),
    sbClient.from('compliance_checks').select('status, violation_type, created_at').gte('created_at', periodStart),
    sbClient.from('order_documents').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const operationalData = {
    allOrders: allOrders || [],
    createdOrders: createdOrders || [],
    completedOrders: completedOrders || [],
    occurrences: occurrences || [],
    complianceChecks: complianceChecks || [],
    pendingDocsCount: pendingDocsCount || 0,
  };

  // 2. Preparar contexto e chamar o worker
  const workerContext = {
    operationalData: operationalData,
    reportType: reportType,
    model: 'gpt-4.1-mini', // Ou outro modelo configurado
  };

  const workerResult = await executeOperationalReportWorker(workerContext);

  // 3. Pós-processamento: Persistir resultados e enviar notificações

  // Persistir relatório operacional
  await sbClient.from('operational_reports').insert(workerResult.operational_report_data);

  // Processar notificações
  for (const notification of workerResult.notifications) {
    await notificationService.sendNotification({
      template: notification.template,
      channel: notification.channel,
      payload: notification.payload,
      status: notification.status,
      created_at: notification.created_at,
    });
  }

  console.log(`Relatório operacional ${reportType} orquestrado com sucesso.`);
}

// Função auxiliar (deve ser movida para um utilitário ou orquestrador)
function getPeriodStart(reportType: 'daily' | 'weekly'): string {
  const hours = reportType === 'daily' ? 24 : 7 * 24;
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}
```

## 3. Benefícios da Refatoração

*   **Desacoplamento**: O worker se torna uma unidade de lógica de IA e agregação de dados pura, mais fácil de testar e manter.
*   **Performance Otimizada**: A responsabilidade de buscar e agregar grandes volumes de dados é movida para o orquestrador, que pode utilizar consultas de banco de dados mais eficientes.
*   **Flexibilidade**: A lógica de persistência e notificação pode ser alterada no orquestrador sem impactar o worker de relatório.
*   **Reusabilidade**: O worker pode ser facilmente integrado em diferentes fluxos de trabalho que exijam relatórios operacionais, sem a necessidade de reescrever a lógica de dados.

Esta refatoração é um passo crucial para a construção de uma arquitetura multi-agente robusta e escalável, conforme as diretrizes da skill `transport-agent-architect`.
