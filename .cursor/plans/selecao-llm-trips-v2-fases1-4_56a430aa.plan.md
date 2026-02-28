---
name: selecao-llm-trips-v2-fases1-4
overview: Definir quais LLMs usar (Anthropic vs OpenAI, e respectivos modelos) para apoiar a implementação das fases 1–4 do plano Trips V2, respeitando a configuração real do projeto.
todos:
  - id: llm-phase1-4-no-new-ia
    content: Manter fases 1–4 (migration, process-payment-proof v1, workflow-orchestrator, reconcile-trip v1) sem dependências diretas de IA em runtime, focando em SQL/TS determinístico.
    status: pending
  - id: llm-config-env-variables
    content: "Revisar e ajustar se necessário as env vars ANTHROPIC_MODEL e OPENAI_MODEL para modelos realmente disponíveis nas suas contas (ex.: claude-sonnet-4-20250514, gpt-4.1-mini)."
    status: pending
  - id: llm-future-trips-ai
    content: Quando evoluir Trips para usar IA (OCR/explicações), garantir que todas as novas chamadas passem por callLLM com modelHint adequado (anthropic para extração, openai para explicações).
    status: pending
isProject: false
---

### Visão geral

Pelo código atual do projeto, a camada de IA de backend já está padronizada no módulo `[supabase/functions/_shared/aiClient.ts](supabase/functions/_shared/aiClient.ts)`, que suporta **dois providers**:

- **Anthropic**: modelo definido por `ANTHROPIC_MODEL` (default: `claude-sonnet-4-20250514`).
- **OpenAI**: modelo definido por `OPENAI_MODEL` (default: `gpt-4.1-mini`).

A função de orquestração é `callLLM`, que:

- Recebe `modelHint?: 'anthropic' | 'openai'`.
- **Por default** prefere OpenAI (`preferred = params.modelHint || 'openai'`).
- Faz **failover automático** para o outro provider em erros de crédito, rate‑limit ou 5xx.

Para as fases 1–4 do plano Trips V2 (que são majoritariamente SQL + Edge Functions sem IA pesada), a escolha de LLM impacta **apenas o desenvolvimento aqui no Cursor** (ajuda para modelagem/SQL/TypeScript) e **eventuais chamadas futuras a IA** que venham a ser adicionadas nesses fluxos. O plano abaixo foca em: (1) como usar os providers existentes para apoiar o desenvolvimento, e (2) como você deve configurar/env hints caso adicione IA nessas funções.

### 1. Princípios de escolha de LLM

- **Princípio 1 – Raciocínio estruturado/SQL**: para tarefas de modelagem de dados complexa (migrations grandes, views de conciliação, RLS), priorizar um modelo **Anthropic (Claude Sonnet)**, pois costuma ter melhor consistência em SQL/Postgres e raciocínio passo a passo.
- **Princípio 2 – Código TypeScript/Node/Deno**: para wiring de código (Edge Functions, hooks, refactors de TS/React), um modelo **OpenAI (gpt-4.1-mini ou superior)** é suficiente e mais barato/rápido.
- **Princípio 3 – Failover automático**: nunca chamar APIs de IA diretamente nas Edge Functions novas; sempre usar `callLLM`, deixando o fallback Anthropic↔OpenAI já implementado cuidar de indisponibilidade/crédito.

### 2. Mapeamento por Fase (1–4)

- **Fase 1 – Migration SQL (`20260301000000_trips_payment_proofs.sql`)**
  - **Desenvolvimento no Cursor**: usar seu modelo de código "mais inteligente" (o default da conversa atual). Não há chamada de IA no runtime nessa migration, então não é necessário configurar `callLLM`.
  - **Se futuramente adicionar IA para validar/gerar SQL**: criar uma pequena Edge Function utilitária que use `callLLM` com `modelHint: 'anthropic'` para geração/validação de scripts SQL, aproveitando o modelo `ANTHROPIC_MODEL`.
- **Fase 2 – Edge Function `process-payment-proof`**
  - **Runtime atual**: pelo PRD v2, essa função é puramente determinística (lookup em `documents`, `orders`, `payment_proofs` e upsert). Não precisa de IA v1 (OCR real fica para versões futuras).
  - **Plano de LLM**:
    - v1: **não usar LLM** aqui (mantém simples, sem dependência de providers).
    - v2 em diante (quando entrar OCR/extração): usar `callLLM` com `modelHint: 'anthropic'` para extrair campos do comprovante, com fallback automático para OpenAI.
- **Fase 3 – Atualização do `workflow-orchestrator` (`handleDocumentUploaded`)**
  - **Runtime**: a única mudança é chamar a Edge Function `process-payment-proof` via `fetch` quando `documents.type` ∈ {`adiantamento_carreteiro`, `saldo_carreteiro`}. Nenhuma lógica de IA nova entra aqui.
  - **Plano de LLM**:
    - Manter **sem chamadas de IA** nesta fase.
    - Garantir apenas que, se no futuro a orquestração for enriquecida com análises inteligentes, ela use sempre o helper `callLLM` (e não chamadas diretas às APIs de Anthropic/OpenAI).
- **Fase 4 – Edge Function `reconcile-trip`**
  - **v1 (implementação inicial)**: lógica determinística baseada em `v_trip_payment_reconciliation` para decidir se fecha (`financial_status='closed'`) ou coloca em `closing`, e gerar um HTML simples de recibo. Não depende de IA.
  - **v2 (insights/explicações de conciliação)**: se você quiser comentários automáticos (por exemplo, "por que esta trip não conciliou"), o plano é:
    - Criar um bloco opcional que chama `callLLM` com `modelHint: 'openai'` (mais barato) para gerar texto explicativo em PT‑BR a partir dos dados da view.
    - Em caso de erro de crédito/rede, o próprio `callLLM` cairá para Anthropic e continuará funcionando.

### 3. Configuração recomendada de environment

- **Anthropic (`ANTHROPIC_MODEL`)**
  - Sugerido: um modelo de geração geral focado em raciocínio, por exemplo `claude-sonnet-4-20250514` (ou o equivalente mais atualizado que você já estiver usando).
  - Uso principal nas features futuras de **SQL pesado/OCR/extração**.
- **OpenAI (`OPENAI_MODEL`)**
  - Sugerido: `gpt-4.1-mini` (ou outro modelo 4.x que você já use como padrão).
  - Uso principal em fluxos de **código, refactors, explicações textuais** e como provider primário no `callLLM`.
- **Preferência e failover**
  - No `callLLM`, o provider **primário** é `preferred = params.modelHint || 'openai'`.
  - Para fases 1–4, como não há IA em runtime, **não é necessário mexer** nessa config.
  - Para futuras features ligadas a Trips:
    - Em chamadas de extração estruturada (ex.: OCR dos comprovantes): `modelHint: 'anthropic'`.
    - Em chamadas de explicação/texto (insights sobre conciliação, relatórios): `modelHint: 'openai'`.

### 4. Como isso se conecta ao desenvolvimento no Cursor

- Todo o trabalho de código das fases 1–4 será feito aqui na conversa com **um único modelo de código (o default do Cursor)**, sem alternância manual entre modelos.
- O plano de LLM acima serve para garantir que, quando você **evoluir as Edge Functions para usar IA**, elas já estejam alinhadas com:
  - O client de IA existente (`callLLM`).
  - As env vars reais (`ANTHROPIC_MODEL`, `OPENAI_MODEL`).
  - Um padrão claro: **Anthropic para raciocínio/extração**, **OpenAI para texto/código**, com failover transparente.

