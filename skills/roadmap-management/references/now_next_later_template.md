# Roadmap do Produto — Cargo Flow Navigator (Q2 2026)

> **Formato**: Now / Next / Later
> **Última Atualização**: 07/03/2026

---

## NOW (Agora)

*O que estamos construindo ativamente neste sprint/mês. Alto nível de confiança no escopo e cronograma.*

### Tema: Estabilização e Correções Críticas

| Iniciativa | Status | Descrição |
|:---|:---|:---|
| 🐞 **Correção: Lógica de Reconciliação** | Em Andamento | Corrigir a lógica invertida do badge de divergência no painel financeiro para refletir o estado real da reconciliação de pagamentos do carreteiro. |
| ✨ **Feature: Herança de Documentos** | Concluído | Implementar a herança de documentos de motorista ao vincular múltiplas OS à mesma viagem, evitando uploads duplicados. |
| 🐞 **Correção: Cálculo de Frete (Lotação)** | Em Testes | Garantir que a busca por faixa de KM na tabela de preços seja robusta e sempre retorne o valor correto no simulador de frete. |

---

## NEXT (A Seguir)

*O que planejamos para os próximos 1-3 meses. Boa confiança no escopo, mas as datas podem ser flexíveis.*

### Tema: Reestruturação Financeira v2.0

| Iniciativa | Objetivo | Dependências |
|:---|:---|:---|
| 🚀 **Grande Aposta: Agrupamento de OS em Viagens (Trips)** | Criar a entidade `trips` para agrupar múltiplas OS, permitindo uma visão financeira consolidada da viagem. | - |
| 🚀 **Grande Aposta: Refatoração do QuoteForm para Wizard** | Quebrar o formulário de cotação de 2000 linhas em um wizard de 4 passos para melhorar a UX e a manutenibilidade. | Design System |
| ✨ **Feature: Cálculo de Rentabilidade (NTC)** | Integrar a tabela de custos da NTC para calcular a rentabilidade real da cotação, não apenas a margem sobre o frete. | - |

---

## LATER (Depois)

*O que pretendemos explorar nos próximos 3-6+ meses. Estas são apostas estratégicas; o escopo e o cronograma são flexíveis e dependem de validação e capacidade.*

### Tema: Automação e Inteligência Avançada

| Iniciativa | Hipótese | O que precisa ser validado? |
|:---|:---|:---|
| 🤖 **Aposta: Extração de Valor de Comprovante (OCR/IA)** | Podemos automatizar a reconciliação financeira extraindo o valor de comprovantes de pagamento via OCR, reduzindo o trabalho manual. | Acurácia do OCR em diferentes tipos de comprovante; Custo vs Benefício da automação. |
| 🛡️ **Melhoria: Failover Automático de LLMs** | Aumentar a resiliência da nossa camada de IA com um failover automático entre Anthropic e OpenAI pode reduzir a latência e o custo. | Impacto real na latência e custo; Complexidade da implementação. |
| 🔍 **Análise: Auditoria de Divergência (Quote vs OS)** | Uma ferramenta dedicada para analisar divergências entre cotação e OS pode nos ajudar a identificar falhas no processo comercial e de precificação. | Qual o principal motivo das divergências? A ferramenta traria insights acionáveis? |
| ✨ **Melhoria: Skeleton Loaders na UI** | Implementar skeleton loaders em áreas de carregamento intenso (dashboards, tabelas) pode melhorar a percepção de performance. | Quais são as áreas mais lentas da aplicação? O impacto na UX justifica o esforço? |
