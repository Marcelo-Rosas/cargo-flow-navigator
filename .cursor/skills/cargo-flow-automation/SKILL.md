---
name: cargo-flow-automation
description: "Implement, plan, modify, review, debug, or test Cargo Flow Navigator automation work related to exactly four workflows: auto-approval, auto-order creation, driver suggestion, and risk evaluation. Use when the user asks for edge functions, SQL migrations or triggers, hooks or pages, Playwright tests, architecture, rollout plans, debugging, audits, or code review for those workflows. Always follow a rigid sequence: analyze request, map repo impact, list files, generate implementation, generate tests, generate migrations or triggers when needed, provide validation checklist, and call out risks and rollback. Support two operating modes: implementation mode for shipping code and audit-debug mode for tracing failures, reviewing existing code, validating rules, and proposing minimal fixes. Prefer the repo's current automation stack and paths, especially workflow-orchestrator, notification-hub, ai-orchestrator-agent, ai-manager, workflow_events, approval_requests, and the current Playwright projects."
---

# Cargo Flow Automation

Use this skill only for the four Cargo Flow Navigator workflows abaixo:

1. auto-approval  
2. auto-order creation  
3. driver suggestion  
4. risk evaluation  

Não use esta skill para áreas de produto não relacionadas, features logísticas genéricas ou brainstorming aberto fora desses workflows.

## Operating modes

Escolha um modo antes de começar a resposta.

### Implementation mode

Use quando o usuário quer **novo código**, migrações, testes, UI ou plano de rollout.

Entregue:
- plano de arquivos  
- implementação  
- testes  
- migrações e triggers quando necessário  
- checklist de validação  
- riscos e rollback  

### Audit-debug mode

Use quando o usuário quer **diagnóstico**, revisão, correção de bug, validação de threshold, análise de eventos ou orientação de rollback.

Entregue:
- workflow e superfície de falha confirmados  
- impacto no repo  
- plano de arquivos somente para o que precisa mudar  
- análise de causa raiz  
- plano de patch mínimo  
- testes para prevenir regressão  
- checklist de validação  
- riscos e rollback  

Não altere o modo no meio da resposta, a menos que o usuário peça explicitamente os dois.  
Se o pedido for ambíguo, assuma:
- **Implementation mode** para pedidos de “construir / alterar / implementar”  
- **Audit-debug mode** para erros, regressões ou “tá quebrado / não funciona”  

## Execução — sequência obrigatória

Siga SEMPRE esta sequência, mesmo que o usuário peça “só o código”.

### 1. Analyze the request

- Identifique qual(is) dos 4 workflows estão em jogo:
  - risk evaluation  
  - auto-approval  
  - auto-order creation  
  - driver suggestion  
- Identifique o tipo de entrega: arquitetura, implementação, migração, teste, debug, review.  
- Declare o modo escolhido: implementation ou audit-debug.  
- Liste suposições **somente** quando o repo ou schema não definirem claramente algo.

### 2. Map repo impact

- Inspecione o repo antes de propor paths ou arquitetura nova.  
- Prefira padrões existentes em vez de criar estrutura paralela.  
- Consulte, quando existirem:
  - `references/repo-patterns.md`  
  - `references/repo-checks.md`  
  - `references/file-target-map.md`  
- Alinhe com a stack atual de automação, em especial:
  - Edge Functions em `supabase/functions/`  
  - `workflow-orchestrator`, `notification-hub`, `ai-orchestrator-agent`, `ai-manager`  
  - tabelas `workflow_events`, `workflow_event_logs`, `approval_requests`  
  - projetos Playwright atuais (`setup`, `chromium-mocks`, `chromium-auth`, `auth`)  

### 3. List files to create or change

- Monte um **file plan concreto** antes de mostrar código.  
- Use paths reais quando já existirem.  
- Quando um path for proposto, marque como tal e explique o porquê.

### 4. Generate implementation or patch plan

#### Implementation mode

- Gere código ou plano de patch que siga os padrões do repo.  
- Mantenha fronteiras claras do workflow:
  - trigger  
  - lógica de decisão  
  - efeitos colaterais  
  - eventos emitidos  
  - retries  
  - tratamento de falha  
- Reutilize:
  - event bus centrado em `workflow_events` / `workflow_event_logs`  
  - `workflow-orchestrator` para orquestração  
  - `notification-hub` para notificações externas  
  - roteadores de AI (`ai-manager`, `ai-orchestrator-agent`, `ai-operational-orchestrator`) onde apropriado  

#### Audit-debug mode

- Foque em **root-cause analysis** e no **menor patch seguro**.  
- Mostre primeiro a correção mínima que resolve o problema, depois possíveis melhorias.  

### 5. Generate tests

Sempre inclua testes:

- **Unit tests**:
  - Cobrir lógica de decisão principal.  
  - Cobrir limites de threshold (valores de fronteira).  
  - Cobrir ao menos um caso rejeitado para cada regra obrigatória.  

- **Playwright E2E** (quando relevante):
  - Se o fluxo toca UI, approvals, criação de ordem, painéis ou automação assíncrona, adicione cenários E2E.  
  - Siga a divisão de projetos existente:
    - `setup`  
    - `chromium-mocks`  
    - `chromium-auth`  
    - `auth`  
  - Use fixtures determinísticas e asserts claros.  
  - Para workflows assíncronos, explique como o tempo é simulado/avançado.

### 6. Generate migrations or triggers when needed

- Só adicione SQL quando realmente necessário:
  - novas colunas/tabelas para estados, audit fields, índices  
  - triggers, funções auxiliares, seed data  
- Mantenha SQL o mais idempotente possível.  
- Reutilize padrões de nome e estilo de:
  - event tables  
  - RPCs/migrations já existentes no repo  

### 7. Provide validation checklist

Inclua um checklist de validação cobrindo:

- Execução local: comandos para rodar testes, lint, deploy local de funções.  
- Happy paths: casos em que o workflow deve funcionar.  
- Negative paths: entradas inválidas, estados proibidos, falta de permissão.  
- Permissões e RLS: quem pode ver/acionar a automação.  
- Retries e idempotência: como o sistema se comporta em re-envio de eventos.  
- Eventos emitidos: quais eventos devem aparecer em `workflow_events` / logs.

### 8. Call out risks and rollback

Sempre finalize chamando atenção para:

- **Riscos operacionais principais**, por exemplo:
  - auto-approval permissivo demais  
  - criação duplicada de ordens  
  - atribuição automática de motorista sem visibilidade  
  - alterações em regras de risco que podem afetar compliance  
- **Rollback / feature-flag**:
  - como desligar a funcionalidade (flag, branch condicional, comment-out controlado)  
  - como reverter migrations (quando fizer sentido)  
  - o que observar pós-rollback (eventos, métricas, dashboards)  

## Workflow decision map

Identifique o workflow principal e aplique as regras correspondentes (complementando com `references/workflow-matrix.md` quando existir).

- **Auto-approval**  
  - Quando uma cotação entra no fluxo de aprovação e pode ser aprovada automaticamente com base em risco, valor e políticas.  

- **Auto-order creation**  
  - Quando uma cotação aprovada deve criar uma ordem operacional após um período de carência ou evento específico.  

- **Driver suggestion**  
  - Quando é preciso ranquear motoristas usando rota, disponibilidade, rating, margem e regras de negócio (ex.: fidelidade, área de atuação).  

- **Risk evaluation**  
  - Quando é necessário calcular `risk_score` e fatores que alimentam auto-approval e outras automações.  

Se o pedido abranger múltiplos workflows, implemente nesta ordem:

1. risk evaluation  
2. auto-approval  
3. auto-order creation  
4. driver suggestion  

## Output contract

Organize SEMPRE a resposta final usando esta ordem (a menos que o usuário peça explicitamente só uma seção):

1. **Scope and assumptions**  
2. **Mode**  
3. **Repo impact**  
4. **Files to create or change**  
5. **Implementation** _ou_ **Root-cause analysis and patch plan**  
6. **Tests**  
7. **Migrations and triggers**  
8. **Validation checklist**  
9. **Risks and rollback**  

Quando `references/output-template.md` existir no repo, siga o template mais estrito de lá.

## Repo-specific implementation rules

- Trate **Supabase Edge Functions** como camada padrão de execução para automação.  
- Reutilize o event bus centrado em:
  - `workflow_events`  
  - `workflow_event_logs`  
  - `workflow-orchestrator`  
- Use `notification-hub` para notificações externas (WhatsApp, e-mail, etc.) em vez de integrar diretamente com provedores em cada workflow.  
- Quando uma Edge Function precisar chamar outra, prefira o helper compartilhado `supabase/functions/_shared/edgeFunctionClient.ts` (ou equivalente no repo).  
- Para ramificações disparadas por AI, prefira os roteadores atuais:
  - `ai-manager`  
  - `ai-orchestrator-agent`  
  - `ai-operational-orchestrator`  
  em vez de padrões antigos, exceto quando a seção do repo ainda usar explicitamente o padrão legado.  
- Mantenha lógica de scoring/risk extraível em helpers puros, facilmente testáveis.  
- Prefira emitir eventos de domínio depois de transições de estado significativas.  
- Evite auto-approval ou auto-atribuição silenciosa sem campos de auditoria (quem, quando, por quê).  
- Para ações atrasadas (ex.: período de 24h), documente claramente o mecanismo de agendamento/orquestração (cron, retries, timers).  
- Quando faltar evidência no repo, diga explicitamente e assuma o **menor risco possível**.

## Frontend-specific rules

- Para superfícies de monitoramento/review de automação, prefira padrões já usados em:
  - `src/hooks/useWorkflowEvents.ts`  
  - `src/hooks/useApprovalRequests.ts`  
  - `src/pages/Approvals.tsx`  
  - widgets do Dashboard  
- Use chaves do React Query coerentes com o restante do projeto.  
- Quando adicionar visibilidade de automação na UI, tente integrá-la:
  - às telas de aprovação  
  - aos dashboards existentes  
  em vez de criar uma área administrativa completamente nova por padrão.

## Testing rules

- Testes de unidade precisam cobrir:
  - limites de threshold  
  - pelo menos um caso de rejeição para cada regra obrigatória  
- Testes Playwright devem cobrir:
  - caminho crítico (happy path)  
  - ao menos um caminho bloqueado ou de fallback  
- Em workflows assíncronos:
  - explique como o tempo é simulado ou avançado (ex.: timers, jobs, eventos).  
- Prefira o projeto `chromium-mocks` para lógica de UI determinística e `chromium-auth` para fluxos autenticados que batem backend real.

## Prompt shortcuts

Quando fizer sentido, adapte prompts prontos em `references/request-prompts.md` (se existir) em vez de criar do zero.  

Exemplos de prompts típicos:

- Implementation mode:
  - "Use a skill `cargo-flow-automation` em implementation mode para implementar auto-approval com as seguintes regras: ..."  
- Audit-debug mode:
  - "Use a skill `cargo-flow-automation` em audit-debug mode para investigar por que auto-order creation não está disparando depois da aprovação da cotação ..."  

