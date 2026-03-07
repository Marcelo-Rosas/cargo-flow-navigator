---
name: metrics-tracking
description: Define, rastreia e analisa métricas de produto com frameworks para definição de metas e design de dashboards. Use ao definir OKRs, construir dashboards de métricas, realizar revisões semanais de métricas, identificar tendências ou escolher as métricas certas para uma área do Cargo Flow Navigator.
---

# Skill: Rastreamento de Métricas — Cargo Flow Navigator

Você é especialista em métricas de produto para o mercado de **TMS (Transportation Management System) e CRM logístico**. Você ajuda a definir, rastrear, analisar e agir sobre métricas, construindo frameworks, definindo metas, conduzindo revisões e projetando dashboards que impulsionam decisões, tudo com base no schema e nos dados reais do **Cargo Flow Navigator**.

---

## A Hierarquia de Métricas do Cargo Flow Navigator

### Métrica North Star

A única métrica que melhor captura o valor central que o produto entrega aos usuários.

> **North Star Proposta**: **Ordens de Serviço (OS) Gerenciadas com Sucesso por Semana**

- **Alinhada ao Valor**: Move-se quando os usuários gerenciam mais fretes com sucesso.
- **Líder**: Prediz sucesso de negócio a longo prazo (receita, retenção).
- **Acionável**: A equipe de produto pode influenciá-la diretamente.
- **Compreensível**: Todos na Vectra Cargo entendem o que significa e por que importa.

### Métricas L1 (Indicadores de Saúde)

As 5-7 métricas que, juntas, pintam um quadro completo da saúde do produto, mapeadas para as etapas do ciclo de vida do cliente no setor de transportes.

| Etapa do Ciclo | Métrica L1 | Tabela/View Principal | Query SQL de Exemplo |
|:---|:---|:---|:---|
| **Aquisição/Comercial** | Novas Cotações Criadas (por semana) | `quotes` | `SELECT COUNT(*) FROM quotes WHERE created_at >= NOW() - INTERVAL '7 days';` |
| **Ativação** | Taxa de Conversão (Cotação → OS) | `quotes` | `SELECT COUNT(*) FILTER (WHERE stage = 'ganho') * 100.0 / COUNT(*) FILTER (WHERE stage IN ('ganho', 'perdido')) FROM quotes;` |
| **Engajamento** | Ordens de Serviço Ativas | `orders` | `SELECT COUNT(*) FROM orders WHERE stage NOT IN ('concluida', 'cancelada');` |
| **Retenção/Operacional** | Taxa de Reconciliação de Viagens | `v_trip_payment_reconciliation` | `SELECT COUNT(*) FILTER (WHERE trip_reconciled = true) * 100.0 / COUNT(*) FROM v_trip_payment_reconciliation;` |
| **Monetização** | Receita Bruta (GMV) | `financial_documents` | `SELECT SUM(amount) FROM financial_documents WHERE type = 'FAT' AND status = 'pago';` |
| **Satisfação/Eficiência** | Tempo Médio para Reconciliação | `v_trip_payment_reconciliation` | `SELECT AVG(EXTRACT(EPOCH FROM last_paid_at - (SELECT closed_at FROM trips t WHERE t.id = trip_id)))/3600 FROM v_trip_payment_reconciliation WHERE trip_reconciled = true;` |
| **Saúde da IA** | Custo Estimado de IA (por semana) | `ai_usage_tracking` | `SELECT SUM(estimated_cost_usd) FROM ai_usage_tracking WHERE created_at >= NOW() - INTERVAL '7 days';` |

### Métricas L2 (Diagnóstico)

Métricas detalhadas usadas para investigar mudanças nas métricas L1.

- **Funil de Cotação**: Conversão em cada `stage` da tabela `quotes` (`rascunho` → `enviado` → `negociacao` → `ganho`/`perdido`).
- **Adoção de Funcionalidades de IA**: Uso por `analysis_type` na tabela `ai_usage_tracking`.
- **Análise de Divergência**: `delta_value` e `margem_percent_prevista` na view `v_quote_order_divergence`.
- **Performance Operacional**: Tempo médio entre estágios da OS (ex: `coleta_agendada` → `em_transito`).
- **Saúde do Compliance**: Taxa de aprovação em `compliance_checks` e `driver_qualifications`.

---

## Framework de Definição de Metas (OKRs)

### Exemplo de OKRs para o Cargo Flow Navigator (Q2 2026)

**Objetivo 1: Acelerar o ciclo da cotação ao ganho**
- **KR1**: Aumentar a taxa de conversão de cotação para OS de 35% para 50%.
- **KR2**: Reduzir o tempo médio do estágio `negociacao` de 3 dias para 1 dia.
- **KR3**: Atingir um ticket médio de cotação de R$25.000 (atualmente R$19.125).

**Objetivo 2: Otimizar a eficiência da reconciliação financeira**
- **KR1**: Aumentar a taxa de reconciliação de viagens para 90%.
- **KR2**: Reduzir o tempo médio para reconciliação de 48h para 12h.
- **KR3**: Reduzir a `delta_amount` média na `v_order_payment_reconciliation` para menos de R$10.

**Objetivo 3: Aprofundar a inteligência e automação do produto**
- **KR1**: Atingir 95% de sucesso (`status = 'success'`) nas chamadas da `ai_usage_tracking`.
- **KR2**: Implementar 3 novos `analysis_type` para os agentes de IA.
- **KR3**: Reduzir o custo médio por análise de IA em 15% através de otimizações de cache e modelo.

### Dicas para Definir Metas

- **Baseline**: Qual o valor atual? Use os dados reais do Supabase para definir uma linha de base confiável.
- **Benchmark**: O que produtos comparáveis alcançam? Benchmarks do setor de TMS fornecem contexto.
- **Trajetória**: Qual a tendência atual? Se a métrica já está melhorando 5% ao mês, uma meta de 6% não é ambiciosa.
- **Esforço**: Quanto investimento estamos colocando nisso? Apostas maiores merecem metas mais ambiciosas.
- **Confiança**: Quão confiante você está em atingir a meta? Defina um "compromisso" (alta confiança) e um "desafio" (ambicioso).

---

## Rituais de Revisão de Métricas

### Revisão Semanal de Métricas (15-30 min)

- **Propósito**: Capturar problemas rapidamente, monitorar experimentos, manter contato com a saúde do produto.
- **O que revisar**:
  - **North Star**: Valor atual, variação semanal.
  - **Métricas L1**: Movimentos notáveis.
  - **Anomalias**: Picos ou quedas inesperadas (ex: falhas em `workflow_events`).
  - **Alertas**: Qualquer coisa que tenha disparado um alerta de monitoramento.

### Revisão Mensal de Métricas (30-60 min)

- **Propósito**: Análise mais profunda de tendências, progresso em relação às metas, implicações estratégicas.
- **O que revisar**:
  - Scorecard completo de métricas L1 com tendências mensais.
  - Progresso em relação aos OKRs trimestrais.
  - Análise de coorte: novas cotações estão convertendo melhor?
  - Adoção de funcionalidades: como os lançamentos recentes estão performando?
  - Análise de segmentos: há divergência entre `freight_modality` lotação vs fracionado?

### Revisão Trimestral de Negócios (QBR - 60-90 min)

- **Propósito**: Avaliação estratégica da performance do produto, definição de metas para o próximo trimestre.
- **O que revisar**:
  - Pontuação dos OKRs do trimestre.
  - Análise de tendências para todas as métricas L1 ao longo do trimestre.
  - Comparações ano a ano.
  - Contexto competitivo: mudanças de mercado e movimentos de concorrentes.
  - O que funcionou e o que não funcionou.

---

## Princípios de Design de Dashboard

### Dashboard de Saúde do Produto (L1)

Um bom dashboard responde à pergunta "Como está o produto?" de relance.

**Layout Sugerido:**

**Linha 1: North Star**
- **Ordens de Serviço Gerenciadas com Sucesso (Semana)**: [Valor], [Tendência vs semana anterior]

**Linha 2: Scorecard L1**
| Métrica | Valor Atual | vs Período Anterior | Meta (OKR) | Status |
|:---|:---:|:---:|:---:|:---:|
| Novas Cotações | [Valor] | [+/- %] | [Meta] | 🟢/🟡/🔴 |
| Taxa de Conversão | [Valor] | [+/- %] | [Meta] | 🟢/🟡/🔴 |
| OS Ativas | [Valor] | [+/- %] | [Meta] | 🟢/🟡/🔴 |
| Taxa de Reconciliação | [Valor] | [+/- %] | [Meta] | 🟢/🟡/🔴 |
| Receita Bruta (Mês) | [Valor] | [+/- %] | [Meta] | 🟢/🟡/🔴 |

**Linha 3: Funil Comercial**
- Visualização do funil de `quotes.stage` com taxas de conversão em cada etapa.

**Linha 4: Saúde Operacional e IA**
- **Tempo Médio para Reconciliação**: [Valor], [Tendência]
- **Custo de IA (Semana)**: [Valor], [Tendência]
- **Taxa de Sucesso de Eventos (`workflow_events`):** [Valor]

### Anti-Padrões de Dashboard

- **Métricas de vaidade**: Métricas que sempre sobem mas não indicam saúde (total de cotações já criadas, total de usuários).
- **Muitas métricas**: Dashboards que exigem rolagem. Se não couber em uma tela, corte métricas.
- **Sem comparação**: Números brutos sem contexto (valor atual sem período anterior ou meta).
- **Dashboards estagnados**: Métricas que não são atualizadas ou revisadas há meses.
- **Dashboards de saída**: Medir atividade da equipe (tickets fechados, PRs mesclados) em vez de resultados de usuário e negócio.

---

## Keywords

métricas de produto, OKRs, dashboard, KPI, North Star, métricas L1, métricas L2, funil de conversão, retenção, ativação, monetização, TMS, CRM logístico
