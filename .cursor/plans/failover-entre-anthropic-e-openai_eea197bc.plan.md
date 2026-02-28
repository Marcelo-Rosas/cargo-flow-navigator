---
name: failover-entre-anthropic-e-openai
overview: "Implementar um cliente de IA com failover: tentar Anthropic primeiro e, em caso de erro de crédito ou indisponibilidade, cair automaticamente para OpenAI."
todos:
  - id: scan-ai-usage
    content: Mapear todos os pontos do código que chamam diretamente a Anthropic/Claude ou APIs de IA atuais
    status: completed
  - id: create-ai-client
    content: Criar módulo compartilhado `aiClient` com `callAnthropic`, `callOpenAI` e `callLLM` com lógica de failover
    status: completed
  - id: wire-edge-functions
    content: "Atualizar Edge Functions (ex.: `ai-financial-agent`) para usar `callLLM` em vez de chamar Anthropic diretamente"
    status: completed
  - id: standardize-errors
    content: Padronizar mensagens de erro e logs, incluindo indicação de qual provider foi usado e se houve fallback
    status: completed
  - id: manual-tests
    content: Executar testes manuais simulando falta de crédito na Anthropic e validar fallback para OpenAI no app
    status: completed
isProject: false
---

## Objetivo

Criar uma camada de client de IA única que:

- Tente primeiro a API da **Anthropic (Claude)**.
- Detecte erros de crédito/uso ou falha de rede.
- Faça **failover automático para OpenAI** sem quebrar a UX.
- Exponha uma interface única para os Edge Functions/hooks atuais (`ai-financial-agent`, insights de dashboard etc.).

## Arquitetura proposta

- **Camada de alto nível** (Edge Function atual, ex.: `supabase/functions/ai-financial-agent/index.ts`):
  - Continua responsável por montar o `prompt` específico de negócio (financeiro, dashboard_insights etc.).
  - Chama um helper único, por exemplo `callLLM({ prompt, context, modelHint })`.
- **Camada de client de IA** (novo módulo): algo como `[src/lib/aiClient.ts]` ou `_shared/aiClient.ts` em Edge Functions:
  - Exporta uma função assíncrona:

```ts
    type LLMProvider = 'anthropic' | 'openai';

    interface CallLLMParams {
      prompt: string;
      system?: string;
      maxTokens?: number;
      temperature?: number;
      modelHint?: LLMProvider; // opcional, se quiser forçar um
    }

    interface CallLLMResult {
      provider: LLMProvider;
      text: string;
      raw: unknown;
    }
    

```

- Implementa o fluxo:

```mermaid
flowchart TD
  caller[edgeFunction_aiFinancialAgent] --> llmClient[callLLM]
  llmClient --> tryAnthropic
  tryAnthropic -->|sucesso| returnAnthropic[retorna {provider:"anthropic"}]
  tryAnthropic -->|erro de crédito/timeout| tryOpenAI
  tryOpenAI -->|sucesso| returnOpenAI[retorna {provider:"openai"}]
  tryOpenAI -->|falha| throwError[lança erro final]
```



- **Configuração**:
  - Chaves de API e modelos via variáveis de ambiente:
    - `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
    - `OPENAI_API_KEY`, `OPENAI_MODEL`
  - Opcional: flag `AI_PREFERRED_PROVIDER=anthropic|openai` se quiser inverter a prioridade futuramente.

## Regras de failover

- **Quando tentar OpenAI**:
  - Resposta 400 da Anthropic com `type: "invalid_request_error"` e `message` contendo:
    - `"Your credit balance is too low"` ou
    - outras mensagens configuráveis (ex.: plano expirado).
  - Erros de rede/timeout (status 5xx, `fetch` rejeitado, etc.).
- **Quando NÃO tentar OpenAI** (falha imediata):
  - Erros de validação de prompt/parâmetros (ex.: `max_tokens` inválido, body malformado).
  - Erros explícitos de política/segurança (se retornados pela Anthropic de forma clara).
- **Formato de mensagem unificada**:
  - Definir internamente um formato comum de prompt (ex.: system + user) e adaptá‑lo para cada provedor:
    - Anthropic: `messages: [{role: 'user', content: prompt}]` ou API de `messages` nova.
    - OpenAI: `messages: [{role: 'system', content: system}, {role: 'user', content: prompt}]`.

## Passos concretos

1. **Localizar pontos de uso de IA**
  - Procurar por chamadas atuais às APIs da Anthropic/Claude nos Edge Functions (provavelmente em `ai-financial-agent` e funções de insights de dashboard).
  - Anotar assinatura e shape de retorno esperado por cada fluxo.
2. **Criar módulo `aiClient`**
  - Arquivo único (ex.: `supabase/functions/_shared/aiClient.ts`):
    - Implementar `callAnthropic(params)` com `fetch` direto na API da Anthropic, usando as env vars.
    - Implementar `callOpenAI(params)` da mesma forma.
    - Implementar `callLLM(params)` que chama `callAnthropic` e, ao capturar erro:
      - Analisa JSON da resposta; se `error.type === 'invalid_request_error'` e `message` contém "credit" ou "balance is too low", chama `callOpenAI`.
      - Caso contrário, relança o erro.
    - Garantir logging mínimo (ex.: `console.error` ou persistência em `occurrences`) com o campo `provider`.
3. **Adaptar Edge Functions existentes**
  - Em `ai-financial-agent` (e outras que hoje chamam diretamente Claude):
    - Remover chamadas diretas à Anthropic.
    - Importar `callLLM` do novo módulo.
    - Montar `prompt`/`system` conforme já é hoje.
    - Substituir a chamada antiga por:

```ts
       const result = await callLLM({ prompt, system, maxTokens: 2048 });
       const text = result.text;
       

```

```
 - Manter o shape de resposta que o frontend já espera (ex.: `{ summary, details }`).
```

1. **Padronizar tratamento de erros**
  - No Edge Function, encapsular o erro em uma resposta 500/400 padronizada:

```ts
     return new Response(JSON.stringify({ error: err.message, provider: result?.provider ?? 'anthropic' }), { status: 500 });
     

```

- No frontend (`useRequestAiAnalysis`, hooks de insights), manter apenas mensagens amigáveis, sem expor detalhes internos.

1. **Observabilidade mínima**
  - Opcional, mas recomendado: criar uma entrada em `occurrences` ou log estruturado indicando:
    - qual provider foi usado,
    - se houve fallback,
    - qual erro veio da Anthropic.
2. **Testes manuais**
  - Simular resposta de erro de crédito da Anthropic (usando mock ou ambiente de teste):
    - Verificar se o fluxo entra no fallback e chama OpenAI.
  - Simular erro de validação (prompt inválido) e confirmar que **não** há fallback, apenas erro direto.
  - Verificar no app que os fluxos de `dashboard_insights` e `ai-financial-agent` continuam funcionando quando Anthropic está ok, e funcionam via OpenAI quando está sem crédito.

## Impacto esperado

- Usuário final deixa de ver erros de "Your credit balance is too low"; em vez disso, o sistema automaticamente usa OpenAI.
- Logs e/ou tabela `occurrences` permitem monitorar a frequência com que o fallback é acionado.
- Mudanças ficam concentradas em um único módulo (`aiClient`) e em pequenos ajustes nos Edge Functions, sem alterar os hooks React já existentes.

