# Implementação Técnica da Integração Multi-Agente com a API Buonny

Este documento detalha a **Fase de Implementação Técnica** para a integração da API Buonny no `cargo-flow-navigator`, seguindo a arquitetura multi-agente proposta pela skill **Transport Agent Architect**. O foco é fornecer um guia prático para o desenvolvimento, abordando a arquitetura do cliente SOAP, a estrutura do agente de risco, a integração com o Event Bus do Supabase e os mecanismos de tratamento de erros e observabilidade.

## 1. Arquitetura do Cliente SOAP e Infraestrutura de Rede

A API Buonny utiliza o protocolo SOAP, o que exige uma camada de abstração para facilitar a integração com o ambiente moderno baseado em JSON/REST do `cargo-flow-navigator`.

### 1.1. Módulo `buonny-soap-client`

Será desenvolvido um módulo compartilhado, `supabase/functions/_shared/buonny-soap-client.ts`, com as seguintes responsabilidades:

*   **Conversão de Formato**: Implementar funções utilitárias para converter payloads JSON (recebidos dos agentes) em XML SOAP para as requisições à Buonny e, inversamente, converter as respostas XML SOAP da Buonny em JSON para consumo pelos agentes.
*   **Autenticação**: Gerenciar o `token` e `cnpj_cliente` necessários para cada requisição. Estes devem ser carregados de variáveis de ambiente seguras (`Deno.env.get("BUONNY_TOKEN")`, `Deno.env.get("BUONNY_CNPJ")`).
*   **Chamadas HTTP**: Utilizar a API `fetch` do Deno para realizar as requisições HTTP POST para os endpoints WSDL da Buonny. Será necessário configurar os headers `Content-Type: text/xml; charset=utf-8` e `SOAPAction` conforme a operação.
*   **Tratamento de Erros Básicos**: Incluir tratamento para erros de rede, timeouts e respostas HTTP não-200, retornando erros padronizados para o agente consumidor.

```typescript
// Exemplo simplificado de estrutura do buonny-soap-client.ts
import { DOMParser, XMLSerializer } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

export async function callBuonnyApi(operation: string, jsonPayload: any): Promise<any> {
  const token = Deno.env.get("BUONNY_TOKEN");
  const cnpj = Deno.env.get("BUONNY_CNPJ");

  if (!token || !cnpj) {
    throw new Error("Credenciais Buonny não configuradas.");
  }

  // 1. Construir o XML SOAP a partir do jsonPayload e credenciais
  const soapEnvelope = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:buonny="https://api.buonny.com.br/portal/wsdl/buonny">
      <soapenv:Header/>
      <soapenv:Body>
        <buonny:${operation}>
          <autenticacao>
            <token>${token}</token>
            <cnpj_cliente>${cnpj}</cnpj_cliente>
          </autenticacao>
          <!-- Mapear jsonPayload para XML específico da operação -->
          ${jsonToXml(jsonPayload, operation)}
        </buonny:${operation}>
      </soapenv:Body>
    </soapenv:Envelope>
  `;

  const response = await fetch(`https://api.buonny.com.br/portal/wsdl/${operation.toLowerCase()}.wsdl`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": `https://api.buonny.com.br/portal/wsdl/buonny/${operation}`,
    },
    body: soapEnvelope,
  });

  if (!response.ok) {
    throw new Error(`Erro na API Buonny: ${response.status} - ${response.statusText}`);
  }

  const xmlResponse = await response.text();
  // 2. Parsear XML SOAP para JSON
  return xmlToJson(xmlResponse, operation);
}

function jsonToXml(payload: any, operation: string): string { /* ... */ }
function xmlToJson(xml: string, operation: string): any { /* ... */ }
```

### 1.2. Infraestrutura de Rede e Segurança

*   **Firewall/Proxy**: Garantir que o ambiente de execução das Edge Functions do Supabase tenha permissão para acessar os IPs e portas dos endpoints da Buonny. Caso haja um proxy corporativo, configurar as variáveis de ambiente necessárias.
*   **Segurança de Credenciais**: Utilizar o sistema de gerenciamento de segredos do Supabase para armazenar o `BUONNY_TOKEN` e `BUONNY_CNPJ`, garantindo que não sejam expostos no código-fonte ou logs.

## 2. Desenvolvimento do Agente de Risco (`ai-risk-management-agent`) e Integração com Event Bus

O `ai-risk-management-agent` será uma Edge Function do Supabase, responsável por orquestrar as chamadas à Buonny e interagir com o Event Bus.

### 2.1. Estrutura do `ai-risk-management-agent`

*   **Entrada (Input)**: O agente receberá eventos do `workflow-orchestrator` via Event Bus (ex: `order.assigned`, `trip.started`). O payload do evento conterá os dados necessários para a consulta à Buonny (ex: CPF do motorista, placa do veículo, ID da ordem de transporte).
*   **Lógica de Negócio**: O agente implementará a lógica para:
    *   Identificar o tipo de consulta Buonny a ser realizada com base no evento de entrada.
    *   Mapear os dados do evento para o formato JSON esperado pelo `buonny-soap-client`.
    *   Chamar as funções apropriadas do `buonny-soap-client`.
    *   Processar a resposta da Buonny e extrair o status de risco e outras informações relevantes.
    *   Gerar um novo evento para o Event Bus com o resultado da análise de risco.

```typescript
// Exemplo simplificado de estrutura do ai-risk-management-agent/index.ts
import { callBuonnyApi } from "../_shared/buonny-soap-client.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? 
  "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");

  const { event_type, payload } = await req.json();

  let riskAssessmentResult = null;

  switch (event_type) {
    case "order.assigned":
      // Mapear payload para consulta profissional
      const professionalPayload = { documento: payload.driver_cpf, placa: payload.vehicle_plate };
      riskAssessmentResult = await callBuonnyApi("ConsultaProfissional", professionalPayload);
      break;
    case "trip.started":
      // Mapear payload para informações de viagem
      const tripInfoPayload = { NroOrdTransp: payload.order_id };
      riskAssessmentResult = await callBuonnyApi("InformacoesViagem", tripInfoPayload);
      break;
    // ... outros casos para Status da Entrega, etc.
    default:
      console.warn("Evento desconhecido para ai-risk-management-agent:", event_type);
      return new Response("OK", { status: 200 });
  }

  // Publicar resultado da análise de risco no Event Bus
  await supabaseClient.from("workflow_events").insert({
    event_type: "risk.assessment.completed",
    payload: { ...payload, risk_data: riskAssessmentResult },
  });

  return new Response("OK", { status: 200 });
});
```

### 2.2. Integração com o Supabase Event Bus

*   **Publicação de Eventos**: O `ai-risk-management-agent` publicará eventos na tabela `workflow_events` (ou similar) do Supabase, com um `event_type` específico (ex: `risk.assessment.completed`, `risk.alert.triggered`). O payload incluirá o resultado da consulta Buonny e o contexto original do evento que o disparou.
*   **Consumo pelo Orquestrador**: O `workflow-orchestrator` (ou um novo agente de orquestração de risco) será configurado para ouvir esses eventos e tomar ações subsequentes, como atualizar o status de risco da viagem, notificar operadores ou acionar outros agentes.

### 2.3. Implementação de Endpoints de Callback da Buonny

*   **Edge Function Dedicada**: Criar uma Edge Function específica (ex: `supabase/functions/buonny-callback-handler`) que atuará como o endpoint para receber os callbacks assíncronos da Buonny (ex: `Callback-consulta-do-retorno-da-ficha`).
*   **Validação de Callback**: Implementar validação de segurança para garantir que o callback realmente veio da Buonny (ex: verificação de IP de origem, assinatura digital se disponível).
*   **Publicação no Event Bus**: Após a validação, o `buonny-callback-handler` converterá o payload do callback para JSON e o publicará no Event Bus do Supabase (ex: `event_type: buonny.ficha.updated`), para que o `workflow-orchestrator` possa processá-lo.

## 3. Tratamento de Erros, Retries e Observabilidade Técnica

Para garantir a robustez da integração, é fundamental implementar mecanismos eficazes de tratamento de erros, retries e observabilidade.

### 3.1. Tratamento de Erros e Circuit Breaker

*   **Erros da API Buonny**: O `buonny-soap-client` deve capturar erros específicos da API Buonny (ex: credenciais inválidas, dados de entrada incorretos) e retorná-los de forma estruturada.
*   **Circuit Breaker**: Implementar um padrão de Circuit Breaker no `buonny-soap-client` para proteger o sistema contra falhas prolongadas da API Buonny. Se a Buonny estiver inoperante por um período, o Circuit Breaker pode evitar chamadas desnecessárias e permitir que o sistema opere em modo degradado (ex: aprovação manual de risco).

### 3.2. Mecanismos de Retry

*   **Retries para Chamadas à Buonny**: O `buonny-soap-client` pode implementar um mecanismo de retry com backoff exponencial para chamadas à API Buonny que falham devido a problemas transitórios de rede ou sobrecarga.
*   **Retries para Processamento de Eventos**: O Event Bus do Supabase já oferece um mecanismo de retry para Edge Functions. Garantir que o `ai-risk-management-agent` e o `buonny-callback-handler` sejam idempotentes para que retries não causem efeitos colaterais indesejados.

### 3.3. Observabilidade e Monitoramento

*   **Logs Estruturados**: Todos os agentes (`ai-risk-management-agent`, `buonny-callback-handler`, `workflow-orchestrator`) devem gerar logs estruturados (JSON) que incluam `event_type`, `correlation_id` (para rastrear o fluxo completo), `status` (sucesso/falha), `duration` e `error_details`.
*   **Métricas Personalizadas**: Coletar métricas sobre:
    *   Tempo de resposta das chamadas à Buonny.
    *   Taxa de sucesso/falha das chamadas à Buonny.
    *   Número de retries.
    *   Latência de processamento de eventos.
*   **Alertas**: Configurar alertas para:
    *   Aumento na taxa de erros da API Buonny.
    *   Aumento na latência das chamadas.
    *   Falha no processamento de callbacks.
    *   Exaustão de retries para um evento específico.

### 3.4. Testes Automatizados

*   **Testes Unitários**: Cobrir o `buonny-soap-client` e as funções internas do `ai-risk-management-agent`.
*   **Testes de Integração**: Simular o fluxo completo, desde o disparo de um evento pelo orquestrador até a publicação do resultado da análise de risco, incluindo mocks para a API Buonny.
*   **Testes de Carga**: Avaliar o desempenho do sistema sob carga para identificar gargalos e garantir a escalabilidade.

Esta fase de implementação técnica é crucial para construir uma integração robusta, eficiente e confiável com a API Buonny, permitindo que o `cargo-flow-navigator` utilize o gerenciamento de risco de forma inteligente e automatizada.
