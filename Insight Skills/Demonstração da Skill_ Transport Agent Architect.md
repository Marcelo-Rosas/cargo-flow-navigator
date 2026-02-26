# Demonstração da Skill: Transport Agent Architect

Esta demonstração apresenta como a skill **Transport Agent Architect** pode ser aplicada para estruturar e evoluir sistemas multi-agente no setor de transporte, utilizando como base o projeto real `cargo-flow-navigator`.

---

## 1. Arquitetura de Agentes e Squads de Apoio

A skill orienta a criação de uma hierarquia clara onde um **Orquestrador** coordena **Agentes Especialistas**. No `cargo-flow-navigator`, identificamos a seguinte estrutura:

| Papel | Agente / Squad | Responsabilidade Principal |
| :--- | :--- | :--- |
| **Supervisor** | `workflow-orchestrator` | Dispatch de eventos, gestão de retries e coordenação entre especialistas. |
| **Especialista Financeiro** | `ai-financial-agent` | Análise de rentabilidade de cotações e detecção de anomalias financeiras. |
| **Especialista Operacional** | `ai-operational-agent` | Qualificação de motoristas e verificação de compliance pré-coleta. |
| **Squad de Segurança** | Infraestrutura/RLS | Garantir que agentes acessem apenas dados permitidos via Row Level Security. |
| **Squad de Fluxos** | Engenharia de Prompt | Refinar os "Cookbooks" (instruções) que guiam as decisões da IA. |

> "A governança não é sobre limitar os agentes, mas sobre definir contratos claros de entrada e saída para que a automação seja previsível e auditável."

---

## 2. Exemplo de Skill Granular: Inteligência de Precificação

Seguindo o estágio 3 da skill, detalhamos uma skill específica para o domínio **Comercial**:

### **Skill: Validação de Margem e Viabilidade (Comercial)**
*   **Objetivo**: Analisar se uma cotação de frete é lucrativa e operacionalmente viável antes de ser enviada ao cliente.
*   **Dados de Entrada**: Tabela de frete (NTC), custos de combustível, pedágios, impostos e histórico de rotas.
*   **Lógica de Execução**:
    1.  O `workflow-orchestrator` detecta o evento `quote.created`.
    2.  O `ai-financial-agent` é acionado com o worker `quote_profitability`.
    3.  A IA compara o valor ofertado com o custo calculado (via `calculate-freight`).
    4.  Se a margem for inferior a 15%, o agente marca para "Revisão Humana".
*   **Resultado**: Status da cotação atualizado e log de decisão registrado na tabela `workflow_event_logs`.

---

## 3. Integração com Sistema de Gerenciamento de Conhecimento (KMS)

A skill propõe que o conhecimento não fique apenas no código, mas em um **KMS** que serve tanto para IAs quanto para humanos.

### **Estratégia de KMS para o Cargo Flow Navigator**

| Componente | Função para IA | Função para Humanos |
| :--- | :--- | :--- |
| **Módulo de Cookbooks** | Contexto injetado no prompt para guiar decisões (ex: regras de compliance). | Guia de referência para entender como a IA toma decisões. |
| **Base de Feedback** | Ajuste de pesos em modelos de embedding com base em correções. | Dashboard de performance dos agentes e áreas de melhoria. |
| **Repositório de Casos** | Exemplos de "Golden Datasets" para testes de regressão. | Material de treinamento para novos operadores logísticos. |

---

## 4. Validação e Monitoramento Operacional

Para garantir a evolução contínua, a skill define métricas críticas que devem ser acompanhadas semanalmente:

*   **Taxa de Sucesso sem Retry**: Percentual de eventos processados corretamente na primeira tentativa.
*   **Custo Médio por Análise**: Monitoramento do consumo de tokens via `check_ai_budget`.
*   **Tempo de Ciclo (P95)**: Latência entre a criação da cotação e a decisão do agente.

---

## Conclusão

A skill **Transport Agent Architect** transforma o desenvolvimento de IA de "scripts isolados" para uma "arquitetura de sistemas robusta". Ela garante que cada novo agente adicionado ao `cargo-flow-navigator` siga padrões de segurança, eficiência e colaboração, permitindo que a operação escale sem perder a qualidade humana no processo.
