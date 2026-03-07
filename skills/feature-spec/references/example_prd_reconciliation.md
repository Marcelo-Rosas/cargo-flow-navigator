# Exemplo de PRD — Reconciliação Automática de Viagem

> **Status**: Aprovado
> **Autor**: Manus AI
> **Stakeholders**: Squad de Fluxos, Squad Financeiro
> **Última Atualização**: 07/03/2026

---

## 1. Declaração do Problema

Atualmente, o processo de reconciliação financeira de uma viagem é manual e propenso a erros. Analistas financeiros precisam verificar manualmente cada comprovante de pagamento (`quote_payment_proofs`) contra os valores esperados na OS (`orders`) e na viagem (`trips`), consumindo um tempo significativo e atrasando o pagamento final ao carreteiro. A falta de um status de reconciliação claro (`is_reconciled`) na `v_trip_payment_reconciliation` torna difícil para os gestores terem uma visão rápida da saúde financeira das viagens finalizadas.

## 2. Objetivos

| # | Objetivo | Métrica de Sucesso Primária | Meta |
|:--|:---|:---|:---|
| 1 | **Reduzir o tempo para reconciliar uma viagem** | Tempo médio entre `trip.status_operational = 'finalizada'` e `v_trip_payment_reconciliation.trip_reconciled = true` | < 24 horas |
| 2 | **Aumentar a visibilidade sobre o status financeiro das viagens** | % de viagens finalizadas com status `trip_reconciled` claro (true/false) | 100% |
| 3 | **Reduzir erros em pagamentos a carreteiros** | % de pagamentos a carreteiros contestados por divergência de valor | < 1% |

## 3. Não-Objetivos

- **Reconciliação de impostos**: A reconciliação de impostos (ICMS, PIS/COFINS) está fora do escopo. O foco é apenas nos valores de frete e custos diretos.
- **Disputa automática de comprovantes**: O sistema não irá disputar automaticamente comprovantes com valor divergente. Ele irá sinalizar a divergência para um analista resolver.
- **Integração com sistema bancário**: A baixa de pagamentos não será feita via integração bancária nesta versão.

## 4. Histórias de Usuário

### P0 (Obrigatório)

- Como um(a) **analista financeiro**, eu quero **que o sistema compare automaticamente o valor dos comprovantes com o valor esperado da OS** para que eu **não precise fazer essa checagem manualmente**.
- Como um(a) **analista financeiro**, eu quero **ver um status claro (`Reconciliado` / `Não Reconciliado` / `Divergência`) para cada OS e cada viagem** para que eu **possa focar meu trabalho apenas nas exceções**.
- Como um(a) **gestor financeiro**, eu quero **ter uma visão geral de todas as viagens pendentes de reconciliação** para que eu **possa cobrar a equipe e gerenciar o fluxo de caixa**.

### P1 (Desejável)

- Como um(a) **analista financeiro**, eu quero **ser notificado quando uma viagem for totalmente reconciliada** para que eu **possa aprovar o pagamento final ao carreteiro imediatamente**.

## 5. Requisitos e Critérios de Aceitação

### P0 — Requisitos Obrigatórios

**REQ-001: Lógica de Reconciliação na View**

- [ ] **Dado** que a soma de `quote_payment_proofs.amount` para uma `order_id` for igual ao `orders.value`,
  **Quando** a view `v_order_payment_reconciliation` for consultada,
  **Então** o campo `is_reconciled` para essa `order_id` deve ser `true`.
- [ ] **Dado** que a soma dos comprovantes for diferente do valor da OS,
  **Quando** a view for consultada,
  **Então** o campo `is_reconciled` deve ser `false` e `delta_amount` deve mostrar a diferença.
- [ ] **Dado** que todas as OS de uma viagem (`trip_orders`) tiverem `v_order_payment_reconciliation.is_reconciled = true`,
  **Quando** a view `v_trip_payment_reconciliation` for consultada,
  **Então** o campo `trip_reconciled` para essa `trip_id` deve ser `true`.

**REQ-002: Interface de Visualização**

- [ ] Criar uma nova página no painel financeiro para listar os dados da `v_trip_payment_reconciliation`.
- [ ] A tabela deve exibir `trip_number`, `status_operational`, `financial_status`, `expected_amount`, `paid_amount`, `delta_amount` e `trip_reconciled`.
- [ ] O campo `trip_reconciled` deve ser exibido como um badge colorido (verde para `true`, vermelho para `false`).
- [ ] Adicionar um filtro para exibir apenas viagens não reconciliadas.

### P1 — Requisitos Desejáveis

**REQ-003: Notificação de Reconciliação**

- [ ] Criar uma nova Edge Function `notify-reconciliation-complete`.
- [ ] A função deve ser acionada por um gatilho de banco de dados quando `v_trip_payment_reconciliation.trip_reconciled` se tornar `true`.
- [ ] A função deve enviar uma notificação via `notification-hub` para o grupo de usuários com o papel `finance_manager`.

## 6. Métricas de Sucesso

| Métrica | Tipo | Descrição | Query de Medição (SQL) |
|:---|:---|:---|:---|
| **Tempo de Reconciliação** | Antecedente | Tempo médio em horas entre a finalização operacional da viagem e a reconciliação financeira completa | `SELECT AVG(EXTRACT(EPOCH FROM r.last_paid_at - t.closed_at))/3600 FROM v_trip_payment_reconciliation r JOIN trips t ON r.trip_id = t.id WHERE r.trip_reconciled = true` |
| **Taxa de Reconciliação** | Antecedente | % de viagens finalizadas que são reconciliadas em até 48h | `SELECT COUNT(*) FILTER (WHERE (r.last_paid_at - t.closed_at) <= '48 hours') * 100.0 / COUNT(*) FROM ...` |
| **Redução de Suporte** | Consequente | Número de tickets de suporte relacionados a "dúvida sobre pagamento de carreteiro" | Contagem manual de tickets |

## 7. Questões Abertas

| # | Questão | Dono | Bloqueante? |
|:--|:---|:---|:---:|
| 1 | Como lidar com comprovantes parciais? A OS só é reconciliada no final? | @product_manager | Sim |
| 2 | Qual deve ser o comportamento se um comprovante for "rejeitado"? Ele deve ser ignorado no cálculo? | @squad_financeiro | Sim |
| 3 | A query da view `v_trip_payment_reconciliation` será performática o suficiente para o dashboard? | @engenharia | Não |

## 8. Considerações de Cronograma

- **Dependências**: Nenhuma.
- **Prazos**: Desejável ter a funcionalidade pronta antes do fechamento do trimestre fiscal para agilizar o balanço.
- **Faseamento Sugerido**:
  - **Fase 1 (MVP)**: Implementar as views no banco e a tela de visualização (REQ-001, REQ-002).
  - **Fase 2 (Fast Follow)**: Implementar a notificação automática (REQ-003).

---

## Anexos

- [Link para o design no Figma da nova tela de reconciliação]
