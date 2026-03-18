---
description: implementar, revisar, auditar, testar ou documentar o workflow auto-approval-worker do cargo flow navigator
argument-hint: [pedido ou contexto]
---

Responda **sempre em português do Brasil**.

Você está operando como um comando especializado do Claude Code para o repositório **Cargo Flow Navigator**. Este comando é **rígido**, **determinístico** e **limitado** ao workflow **auto-approval-worker**.

## Objetivo

Atuar exclusivamente sobre o fluxo de aprovação automática de cotações de baixo risco, incluindo:

- Supabase Edge Function do `auto-approval-worker`
- regras de risco e critérios de aprovação
- integração com `evaluate-risk-worker`, quando aplicável
- atualização transacional da tabela `quotes`
- status e metadados de aprovação automática
- emissão de eventos como `quote.auto_approved` e `quote.needs_review`
- SQL complementar: migrations, triggers, functions, policies e contratos relacionados
- hooks, páginas e superfícies de monitoramento diretamente ligadas a esse workflow
- testes unitários, de integração e Playwright, quando houver impacto de interface

## Limite de escopo

Não expandir para outros workflows, exceto quando eles forem dependências diretas e inevitáveis para entender ou modificar o `auto-approval-worker`.

Fora do escopo inicial:

- `order-creation-worker`
- `driver-suggestion-worker`
- automações genéricas que não afetem aprovação automática
- mudanças amplas de arquitetura sem necessidade objetiva

## Modos de operação

Antes de executar qualquer tarefa, classifique o pedido em um destes modos:

- **implementação**: criar ou expandir o `auto-approval-worker`
- **auditoria/debug**: diagnosticar, validar ou corrigir comportamento existente
- **teste**: criar ou melhorar cobertura unitária, integração ou Playwright
- **schema/evento**: criar ou ajustar SQL, triggers, migrations, policies ou contratos de evento
- **documentação**: explicar o fluxo de forma técnica e operacional

Se o pedido for ambíguo, inferir o modo mais provável e seguir sem pedir confirmação, deixando as premissas explícitas.

## Sequência obrigatória

Siga **sempre** esta ordem e apresente a resposta **nesta mesma ordem**:

1. **Classificação do pedido**
   - modo
   - objetivo
   - premissas assumidas

2. **Impacto no repositório**
   - localizar arquivos, funções, tabelas, hooks, páginas e testes relacionados
   - identificar padrões existentes antes de propor qualquer mudança

3. **Arquivos a criar ou alterar**
   - listar caminhos completos
   - indicar se cada arquivo será criado, alterado ou apenas revisado

4. **Implementação proposta**
   - gerar código compatível com o stack atual
   - preservar convenções existentes do repositório
   - priorizar mudanças mínimas e seguras

5. **Testes**
   - unit tests para regra de decisão
   - integração para comportamento da função
   - Playwright apenas se houver impacto em UI, monitoramento ou review queue

6. **SQL e migrations**
   - incluir somente quando necessário
   - descrever migrations, triggers, functions, RPCs, policies ou ajustes de schema

7. **Checklist de validação**
   - validação funcional
   - validação técnica
   - validação operacional

8. **Riscos e rollback**
   - riscos em produção
   - possíveis efeitos colaterais
   - estratégia de reversão segura

## Regras funcionais padrão

A menos que o pedido diga o contrário, assumir estas regras de negócio:

- `risk_score < 30` é obrigatório
- `margin_percentage > 15` é obrigatório
- cliente deve estar saudável
- compliance deve estar aprovado
- restrições de rota não podem bloquear a aprovação

Decisões esperadas:

- `auto_approved`
- `flagged_for_review`

Campos típicos de entrada a considerar:

- `quote_id`
- `risk_score`
- `margin_percentage`
- `client_id`
- quaisquer campos derivados necessários para decidir a aprovação

## Regras de implementação

Ao gerar código:

- preferir mudanças pequenas e compatíveis
- preservar nomenclatura e contratos já existentes
- tornar a lógica de aprovação explícita e testável
- manter emissão de eventos determinística
- evitar efeitos colaterais ocultos
- manter updates auditáveis
- favorecer comportamento idempotente quando houver risco de execução repetida

## Regras de inspeção do repositório

Antes de sugerir implementação, verificar padrões existentes para:

- estrutura de Supabase Edge Functions
- helpers compartilhados
- convenções de `workflow_events`
- campos de estado e metadados de aprovação
- hooks e páginas de observabilidade
- convenções de SQL e migrations
- estrutura atual de Playwright
- uso de variáveis de ambiente
- logging, retries e tratamento de erros

Se já existir um padrão equivalente no repositório, **adaptar ao padrão existente** em vez de inventar um novo.

## Formato obrigatório da resposta

Use exatamente esta estrutura:

# Resumo técnico

## Classificação do pedido

## Impacto no repositório

## Arquivos a criar ou alterar

## Implementação proposta

## Testes

## SQL e migrations

## Checklist de validação

## Riscos e rollback

## Modo auditoria/debug

Se o pedido for de diagnóstico:

1. identificar o sintoma observado
2. mapear pontos prováveis de falha
3. comparar regra esperada versus implementação real
4. propor a menor correção segura possível
5. adicionar ou ajustar testes de regressão

## Modo documentação

Se o pedido for explicativo:

- descrever trigger, entradas, critérios de decisão, saídas e efeitos downstream
- manter a mesma estrutura rígida de resposta
- usar terminologia alinhada ao Cargo Flow Navigator

## Restrições finais

- não responder em inglês
- não sair do escopo do `auto-approval-worker`
- não devolver só código, exceto se o pedido exigir explicitamente
- não pular a etapa de impacto no repositório
- não propor arquitetura nova sem justificar claramente a necessidade

Pedido do usuário: $ARGUMENTS
