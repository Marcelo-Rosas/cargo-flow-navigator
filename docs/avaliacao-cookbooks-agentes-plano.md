# Avaliação dos cookbooks focados em agentes e plano eficiente para o Cargo Flow Navigator

## 1) Diagnóstico rápido

- No snapshot atual do repositório não existe uma pasta `cookbook/` ou `cookbooks/` versionada.
- Para não bloquear a análise, este documento usa como **fontes equivalentes** os fluxos multiagente já implementados em `supabase/functions` e no event bus em migrations.
- Recomendação: centralizar os cookbooks reais em `docs/cookbooks/` e referenciar no `README`.

## 2) O que já existe hoje (base multiagente real)

### 2.1 Event bus e trilha de auditoria

A migration `workflow_events_and_triggers` já implementa:

- tabela de eventos (`workflow_events`) com retries e status;
- logs por agente (`workflow_event_logs`);
- gatilhos que emitem eventos de mudanças de estágio/status para quotes, orders, financial documents e upload de documentos.

**Leitura:** isso já é um padrão de cookbook de orquestração orientada a eventos.

### 2.2 Orquestrador principal

`workflow-orchestrator` já opera como agente coordenador:

- faz dispatch por `event_type`;
- aciona `ai-financial-agent` para análises;
- aciona `notification-hub` para envio;
- registra ações no log por agente;
- aplica retry e marcação `failed` após esgotar tentativas.

**Leitura:** o papel de “agente supervisor” já está definido.

### 2.3 Agente de IA financeira

`ai-financial-agent` cobre quatro análises:

- `quote_profitability`
- `financial_anomaly`
- `approval_summary`
- `dashboard_insights`

**Leitura:** é um cookbook de agente especialista (domínio financeiro), já integrado ao fluxo operacional.

## 3) Critérios para avaliar cookbooks que citam agentes

Quando vocês revisarem os cookbooks da pasta alvo, usem esta régua objetiva:

1. **Contrato de entrada/saída**
   - Input mínimo obrigatório (campos, formatos, defaults)
   - Output versionado (schema e campos estáveis)
2. **Gatilho claro**
   - Evento ou condição exata que dispara o agente
3. **Critério de sucesso**
   - KPI mensurável por execução (ex.: tempo, acurácia, taxa de aprovação)
4. **Observabilidade**
   - Log por decisão, erro e fallback
5. **Fallback operacional**
   - O que fazer quando IA/API externa falhar
6. **Custos e limites**
   - Budget por análise e proteção para picos
7. **Segurança e compliance**
   - Dados sensíveis mascarados e trilha auditável

Se um cookbook não cobrir estes 7 itens, ele está incompleto para produção.

## 4) Plano eficiente (90 dias) para o projeto

## Fase 1 (Semanas 1-2): Padronização de cookbooks

- Criar `docs/cookbooks/` com template único por agente:
  - objetivo;
  - eventos de entrada;
  - regra de decisão;
  - ações de saída;
  - fallback;
  - métricas.
- Prioridade inicial:
  1. Orchestrator
  2. AI Financial Agent
  3. Notification Hub

**Entregável:** 3 cookbooks “core” aprovados pelo time.

## Fase 2 (Semanas 3-6): Governança operacional

- Definir `SLO` para cada agente (latência e taxa de erro).
- Criar dashboard com:
  - throughput de `workflow_events`;
  - tempo por handler;
  - retries e taxa de `failed`;
  - custo de chamadas de IA.
- Incluir alertas para:
  - fila pendente acima do limiar;
  - aumento súbito de retries;
  - erro em cadeia no `ai-financial-agent`.

**Entregável:** operação previsível com sinais antecipados de incidente.

## Fase 3 (Semanas 7-10): Qualidade de decisão

- Introduzir suíte de cenários sintéticos para cada `event_type`.
- Definir “golden dataset” para validação de análises financeiras.
- Revisão semanal dos top 20 erros de agentes.

**Entregável:** aumento de confiabilidade sem depender de correções reativas.

## Fase 4 (Semanas 11-13): Escala e custo

- Implementar política por criticidade:
  - eventos críticos: processamento imediato;
  - eventos analíticos: lote/batch.
- Cache de contexto para reduzir chamadas de IA redundantes.
- Limites por tenant/usuário para evitar explosão de custos.

**Entregável:** crescimento com custo controlado.

## 5) Backlog priorizado (ação direta)

1. Publicar template oficial de cookbook (`docs/cookbooks/TEMPLATE.md`).
2. Documentar cookbook do `workflow-orchestrator` com tabela de `event_type -> handler`.
3. Definir schema estável para payloads por evento (versão `v1`).
4. Adicionar métricas operacionais (tempo por evento, retries, erro por agente).
5. Adicionar runbook de incidentes multiagente (fila parada, erro IA, notificação pendente).

## 6) Métricas mínimas para acompanhar semanalmente

- % de eventos concluídos sem retry
- tempo p50/p95 por tipo de evento
- taxa de erro por agente
- custo médio por análise de IA
- % de aprovações automáticas vs manuais
- tempo de ciclo de quote `precificacao -> ganho/perda`

## 7) Estrutura sugerida para os cookbooks da pasta

```text
cookbook/
  00-governanca/
    metricas-e-slos.md
    runbook-incidentes.md
  10-orquestracao/
    workflow-orchestrator.md
  20-agentes-especialistas/
    ai-financial-agent.md
    notification-hub.md
  30-prompts-e-avaliacao/
    prompts-financeiros.md
    dataset-validacao.md
```

---

## Resumo executivo

O projeto já possui arquitetura multiagente funcional via event bus + orquestrador + agente de IA + hub de notificações. O maior ganho agora não é “criar mais agentes”, e sim **formalizar cookbooks operacionais com contrato, métrica e fallback** para elevar previsibilidade, qualidade e custo-benefício.
