# Governança da Integração Multi-Agente com a API Buonny

Este documento detalha a **Fase de Governança** para a integração da API Buonny no `cargo-flow-navigator`, seguindo as diretrizes da skill **Transport Agent Architect**. O objetivo é garantir que a nova capacidade de gerenciamento de risco seja implementada com segurança, qualidade, rastreabilidade e alinhamento estratégico.

## 1. Estrutura de Squads e Responsabilidades Transversais

A governança da integração será distribuída entre os squads de apoio, garantindo que cada aspecto da solução seja revisado e mantido por especialistas.

| Squad de Apoio | Responsabilidade na Integração Buonny | Entregáveis de Governança |
| :--- | :--- | :--- |
| **Segurança** | Definição e auditoria das políticas de Row Level Security (RLS) para acesso aos dados de risco. Gestão segura das credenciais (Token/CNPJ) da Buonny. | Política de RLS para o `ai-risk-management-agent`. Relatório de auditoria de acesso a secrets. |
| **Código** | Revisão do código do `buonny-soap-client` e do `ai-risk-management-agent` para garantir padrões de qualidade, performance e resiliência (tratamento de erros e retries). | Padrão de código para o cliente SOAP. Testes de estresse e performance do novo agente. |
| **Fluxos** | Criação, versionamento e aprovação dos **Cookbooks** de gerenciamento de risco. Mapeamento de eventos e ações do `workflow-orchestrator` em resposta aos callbacks da Buonny. | Documentação formal dos Cookbooks. Matriz de Eventos/Ações do Orquestrador. |
| **Design** | Garantir que a interface de usuário (UI) para operadores de risco seja clara, exibindo o status de risco da Buonny de forma compreensível e permitindo intervenção humana eficiente. | Protótipos de UI para o painel de risco. Diretrizes de comunicação de alertas de risco. |

## 2. Padronização de Cookbooks e Contratos de Interação

A governança dos agentes é exercida primariamente através da formalização dos **Cookbooks**, que atuam como o contrato de serviço de cada agente.

### 2.1. Estrutura Padrão do Cookbook de Risco

Cada Cookbook do `ai-risk-management-agent` deve aderir a uma estrutura rígida para garantir a rastreabilidade e a qualidade:

| Seção do Cookbook | Descrição e Requisitos de Governança |
| :--- | :--- |
| **Objetivo** | O que a skill deve alcançar (ex: "Validar motorista e veículo com risco 'Baixo' antes da atribuição"). Deve ser mensurável. |
| **Gatilho** | Evento exato que dispara o agente (ex: `event_type: order.assigned`). Define o ponto de entrada no `workflow-orchestrator`. |
| **Contrato de Entrada** | Schema JSON obrigatório para o payload de entrada. Deve incluir campos de rastreamento (ex: `order_id`, `cnp_cliente`). |
| **Lógica de Decisão** | Fluxograma ou pseudocódigo detalhado da lógica de chamada à Buonny e interpretação do resultado. Deve incluir a regra de fallback em caso de falha da API externa. |
| **Contrato de Saída** | Schema JSON obrigatório para o payload de saída. Deve incluir o status de risco da Buonny e a recomendação de ação (ex: `risk_status: 'High'`, `action: 'Manual_Review'`). |
| **Métricas de Sucesso** | KPI que será monitorado (ex: Taxa de aprovação automática, Tempo de resposta da Buonny). |

### 2.2. Contratos de Interação (Agente-para-Agente)

A governança exige que a comunicação entre o `ai-risk-management-agent` e outros agentes (Orquestrador, Operacional, Financeiro) seja baseada em contratos de eventos estáveis.

*   **Evento de Saída Padrão**: O `ai-risk-management-agent` deve emitir um evento padronizado (ex: `risk.assessment.completed`) que contenha o status de risco e a recomendação de ação.
*   **Versionamento**: O schema do payload de eventos deve ser versionado (ex: `risk.assessment.completed.v1`) para evitar que alterações no agente de risco quebrem a lógica de outros agentes.

## 3. Segurança, Auditoria e Conformidade (RLS)

A integração com uma API de gerenciamento de risco exige o mais alto nível de segurança e rastreabilidade.

### 3.1. Row Level Security (RLS) para Agentes

O acesso aos dados sensíveis (como CPF de motoristas ou dados de localização) deve ser estritamente controlado.

*   **Princípio do Menor Privilégio**: O `ai-risk-management-agent` deve ter permissão de acesso (via RLS) apenas às tabelas e colunas estritamente necessárias para realizar suas consultas (ex: `motoristas.cpf`, `viagens.placa`).
*   **Isolamento de Credenciais**: As credenciais da Buonny devem ser acessíveis **apenas** pelo `ai-risk-management-agent`. Outros agentes não devem ter acesso direto a essas chaves.

### 3.2. Trilha de Auditoria e Logs

*   **Registro de Decisão**: Cada decisão tomada pelo `ai-risk-management-agent` (incluindo a requisição enviada à Buonny e a resposta recebida) deve ser registrada na tabela de logs (`workflow_event_logs`) com um identificador único de transação.
*   **Logs de Falha**: O Cookbook deve especificar o que constitui uma falha (ex: timeout, erro de autenticação, resposta inesperada) e garantir que o log de falha seja detalhado, incluindo o status do fallback operacional.

### 3.3. Conformidade e Revisão Periódica

*   **Revisão de Conformidade**: O Squad de Segurança deve realizar uma revisão trimestral da política de RLS e do uso das credenciais da Buonny.
*   **Revisão de Cookbooks**: O Squad de Fluxos deve revisar anualmente todos os Cookbooks de risco para garantir que as regras de negócio estejam alinhadas com as políticas de risco mais recentes da empresa e da Buonny.

## 4. Monitoramento e SLA

A governança define os limites de performance e custo para a integração.

*   **Service Level Objective (SLO)**: Definir um SLO para o tempo de resposta do `ai-risk-management-agent` (ex: 95% das consultas devem ser concluídas em menos de 500ms).
*   **Budget de Custo**: Estabelecer um limite de custo mensal para as chamadas à API Buonny e implementar alertas automáticos quando 80% desse limite for atingido.

A implementação desta fase de governança é o pilar para garantir que a integração com a Buonny seja não apenas funcional, mas também segura, auditável e sustentável a longo prazo.
