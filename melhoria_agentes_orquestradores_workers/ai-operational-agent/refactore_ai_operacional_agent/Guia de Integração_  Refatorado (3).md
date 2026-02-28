# Guia de Integração: `regulatoryUpdateWorker.ts` Refatorado

Este documento detalha as mudanças no `regulatoryUpdateWorker.ts` e fornece um guia sobre como integrá-lo na arquitetura multi-agente, especialmente com um orquestrador central. O objetivo da refatoração foi desacoplar o worker das responsabilidades de infraestrutura (web scraping, acesso a banco de dados e notificações) e otimizar o processamento de LLM, para que ele se concentre exclusivamente na avaliação de relevância de artigos regulatórios.

## 1. Visão Geral da Refatoração

O `regulatoryUpdateWorker.ts` original era um worker monolítico que realizava web scraping, filtrava artigos, chamava o LLM sequencialmente, persistia resultados e enviava notificações. Na versão refatorada, essas responsabilidades foram removidas ou otimizadas, e o worker agora espera receber uma lista de artigos já pré-processados e retorna os resultados brutos para que um orquestrador os processe.

### 1.1. Principais Mudanças

*   **Remoção de Web Scraping**: A lógica de `fetchHtml` e `parseArticles` foi removida. O worker não é mais responsável por buscar o conteúdo das URLs.
*   **Remoção de Acesso ao Banco de Dados**: Todas as chamadas `ctx.sb.from(...)` foram removidas do worker. Ele não filtra mais artigos existentes nem persiste resultados em `regulatory_updates` ou `notification_queue`.
*   **Remoção de Lógica de Notificação Direta**: O worker não insere mais notificações diretamente.
*   **Processamento Paralelo de LLM**: O loop sequencial de chamadas ao LLM foi refatorado para usar `Promise.all`, permitindo que a avaliação de múltiplos artigos seja feita em paralelo, reduzindo significativamente o tempo de execução.
*   **Nova Interface de Entrada (`RefactoredWorkerContext`)**: O worker agora espera um objeto `articlesToProcess` (uma lista de `ParsedArticle`), que deve ser pré-buscado, parseado e filtrado pelo orquestrador, além do `model`.
*   **Nova Interface de Saída (`RefactoredWorkerResult`)**: O worker retorna um objeto contendo:
    *   `analysisSummary`: Um resumo das análises (contagem de novos artigos, alta relevância).
    *   `durationMs`, `provider`: Metadados da execução do LLM.
    *   `notifications`: Uma lista de objetos que representam as notificações a serem enviadas, sem a lógica de persistência.
    *   `regulatory_updates_data`: Uma lista de objetos formatados para serem inseridos na tabela `regulatory_updates`.

## 2. Como Integrar o Worker Refatorado

A integração do `regulatoryUpdateWorker.ts` refatorado requer que um **Agente Orquestrador** (ex: `ai-orchestrator-agent`) assuma as responsabilidades de web scraping, pré-processamento de dados, pós-processamento de resultados e gerenciamento de notificações.

### 2.1. Fluxo de Integração Proposto

```mermaid
graph TD
    A[Orquestrador: Início] --> B[Receber Evento: Atualização Regulatória]
    B --> C[Orquestrador: Realizar Web Scraping (SOURCE_URLS)]
    C --> D[Orquestrador: Parsear Artigos do HTML]
    D --> E[Orquestrador: Filtrar Artigos Novos (Consulta Supabase)]
    E --> F{Artigos Novos Encontrados?}
    F -- Não --> G[Orquestrador: Fim (Nenhum Artigo Novo)]
    F -- Sim --> H[Orquestrador: Preparar RefactoredWorkerContext]
    H --> I[Chamar regulatoryUpdateWorker.ts (Refatorado)]
    I --> J[Worker: Executar Avaliação de Relevância (LLM em Paralelo)]
    J --> K[Worker: Retornar RefactoredWorkerResult]
    K --> L[Orquestrador: Persistir regulatory_updates_data (Supabase)]
    L --> M[Orquestrador: Processar notifications (Serviço Unificado)]
    M --> N[Orquestrador: Fim]
    G --> N
```

### 2.2. Responsabilidades do Orquestrador

O Agente Orquestrador terá as seguintes responsabilidades ao interagir com o `regulatoryUpdateWorker.ts` refatorado:

1.  **Pré-processamento de Dados**:
    *   Receber o evento que aciona a busca por atualizações regulatórias.
    *   Realizar o web scraping das `SOURCE_URLS` (ou utilizar um serviço de scraping dedicado).
    *   Parsear o HTML para extrair os artigos (`ParsedArticle[]`).
    *   Consultar a tabela `regulatory_updates` no Supabase para filtrar apenas os artigos que ainda não foram processados.
    *   Construir o objeto `RefactoredWorkerContext` com a lista `articlesToProcess` e `model`.
    *   (Opcional) Buscar `previousInsights` da tabela `ai_insights` se a lógica de IA precisar de contexto histórico.

2.  **Invocação do Worker**:
    *   Chamar a função `executeRegulatoryUpdateWorker` com o `RefactoredWorkerContext` preparado.

3.  **Pós-processamento de Resultados**:
    *   Receber o `RefactoredWorkerResult` retornado pelo worker.
    *   **Persistência de Atualizações Regulatórias**: Utilizar `regulatory_updates_data` para inserir os registros na tabela `regulatory_updates` no Supabase.
    *   **Gerenciamento de Notificações**: Iterar sobre a lista `notifications` e encaminhá-las para um serviço de notificação unificado (ex: um `notification-agent` dedicado ou uma fila de mensagens que outro serviço consome).

### 2.3. Exemplo de Pseudocódigo do Orquestrador

```typescript
// Exemplo de como o orquestrador chamaria o worker refatorado
import { executeRegulatoryUpdateWorker } from './refactored_regulatoryUpdateWorker.ts';

// Funções auxiliares (devem ser implementadas no orquestrador ou em um serviço de scraping)
async function fetchAndParseArticles(sbClient: any): Promise<ParsedArticle[]> {
  const SOURCE_URLS = [
    'https://www.portalntc.org.br/noticias/',
    'https://www.portalntc.org.br/categoria/artigos-tecnicos/',
  ];

  const htmlResults = await Promise.all(SOURCE_URLS.map(async (url) => {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'VectraCargo-RegulatoryBot/1.0' } });
      if (!response.ok) return '';
      return await response.text();
    } catch { return ''; }
  }));

  let allArticles: ParsedArticle[] = [];
  for (let i = 0; i < SOURCE_URLS.length; i++) {
    if (htmlResults[i]) {
      // Implementar parseArticles aqui ou em um utilitário
      // Exemplo simplificado: assume que parseArticles existe e funciona
      // allArticles.push(...parseArticles(htmlResults[i], SOURCE_URLS[i]));
    }
  }

  // Filtrar artigos já existentes
  const urls = allArticles.map((a) => a.url);
  const { data: existingUrls } = await sbClient
    .from('regulatory_updates')
    .select('source_url')
    .in('source_url', urls);

  const processedSet = new Set((existingUrls || []).map((r: any) => r.source_url));
  const newArticles = allArticles.filter((a) => !processedSet.has(a.url)).slice(0, 10);

  return newArticles;
}

async function orchestrateRegulatoryUpdate(sbClient: any, notificationService: any) {
  // 1. Pré-processamento: Buscar, parsear e filtrar artigos
  const articlesToProcess = await fetchAndParseArticles(sbClient);

  if (articlesToProcess.length === 0) {
    console.log('Nenhum artigo novo para processar.');
    return;
  }

  // 2. Preparar contexto e chamar o worker
  const workerContext = {
    articlesToProcess: articlesToProcess,
    model: 'gpt-4.1-mini', // Ou outro modelo configurado
    // previousInsights: ... (se relevante)
  };

  const workerResult = await executeRegulatoryUpdateWorker(workerContext);

  // 3. Pós-processamento: Persistir resultados e enviar notificações

  // Persistir atualizações regulatórias
  if (workerResult.regulatory_updates_data.length > 0) {
    await sbClient.from('regulatory_updates').insert(workerResult.regulatory_updates_data);
  }

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

  console.log(`Atualização regulatória orquestrada com sucesso. ${workerResult.analysisSummary.new_articles} novos artigos, ${workerResult.analysisSummary.high_relevance_count} de alta relevância.`);
}
```

## 3. Benefícios da Refatoração

*   **Desacoplamento**: O worker se torna uma unidade de lógica de IA pura, mais fácil de testar e manter.
*   **Performance Otimizada**: O processamento paralelo das chamadas ao LLM reduz drasticamente o tempo de execução.
*   **Robustez do Scraping**: A responsabilidade de scraping pode ser isolada e aprimorada independentemente do worker.
*   **Flexibilidade**: A lógica de persistência e notificação pode ser alterada no orquestrador sem impactar o worker de análise regulatória.
*   **Reusabilidade**: O worker pode ser facilmente integrado em diferentes fluxos de trabalho que exijam avaliação de relevância de textos, sem a necessidade de reescrever a lógica de dados.

Esta refatoração é um passo crucial para a construção de uma arquitetura multi-agente robusta e escalável, conforme as diretrizes da skill `transport-agent-architect`.
