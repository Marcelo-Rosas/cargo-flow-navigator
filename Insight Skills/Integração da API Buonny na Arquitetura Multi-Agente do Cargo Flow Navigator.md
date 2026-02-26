# Integração da API Buonny na Arquitetura Multi-Agente do Cargo Flow Navigator

Com base na skill **Transport Agent Architect** e na análise da documentação da API Buonny, propomos a seguinte estrutura para integrar o gerenciamento de risco e monitoramento ao `cargo-flow-navigator`.

## 1. Hierarquia de Agentes e Funções da Buonny

A integração da API Buonny será realizada através da criação de um novo **Agente Especialista de Gerenciamento de Risco** e da coordenação pelo `workflow-orchestrator` existente.

### 1.1. Agente Supervisor: `workflow-orchestrator`

O `workflow-orchestrator` atuará como o ponto central para iniciar e coordenar as operações da Buonny. Seus papéis incluirão:

*   **Iniciação de Consultas**: Disparar consultas à Buonny em momentos chave do fluxo (ex: após a criação de uma ordem de transporte ou atribuição de motorista).
*   **Processamento de Callbacks**: Receber e interpretar os callbacks da Buonny, que indicam o resultado de análises de risco ou atualizações de status.
*   **Coordenação de Ações**: Com base nos resultados da Buonny, o orquestrador pode acionar outros agentes (ex: `ai-financial-agent` para reavaliar a rentabilidade, ou `ai-operational-agent` para ajustar a rota ou alertar o motorista).

### 1.2. Novo Agente Especialista: `ai-risk-management-agent`

Será criado um novo agente, o `ai-risk-management-agent`, dedicado a interagir com a API Buonny e processar as informações de risco. Suas responsabilidades incluirão:

*   **Consulta Profissional**: Utilizar a API `Consulta Profissional` para verificar o status de motoristas e veículos. Isso pode ser acionado antes da atribuição de um motorista a uma viagem.
*   **Consulta de Informações de Viagem**: Acessar a API `Informações de Viagem` para obter detalhes sobre o andamento de uma Ordem de Transporte, complementando o monitoramento interno.
*   **Consulta de Status da Entrega**: Usar a API `Status da Entrega` para obter a localização e o status atual de um veículo, enriquecendo os dados de rastreamento.
*   **Processamento de Retorno de Ficha**: Lidar com os callbacks da Buonny (`Callback-consulta-do-retorno-da-ficha`) para atualizar o status de risco de uma viagem ou motorista no sistema.
*   **Análise de Risco Preliminar**: Com base nos dados da Buonny, realizar uma análise inicial para identificar potenciais riscos e reportar ao `workflow-orchestrator`.

### 1.3. Agentes Especialistas Existentes e a Buonny

*   **`ai-operational-agent`**: Pode consumir os resultados do `ai-risk-management-agent` para tomar decisões operacionais, como a aprovação de um motorista para uma rota específica ou a necessidade de intervenção em caso de desvio de rota.
*   **`ai-financial-agent`**: Pode utilizar as informações de risco da Buonny para reavaliar a rentabilidade de uma viagem ou para ajustar os custos de seguro, caso o perfil de risco do motorista ou da rota seja alterado.

## 2. Fluxo de Integração Exemplo: Validação de Motorista e Monitoramento de Risco

Para ilustrar a integração, considere o seguinte fluxo:

1.  **Evento**: `order.assigned` (uma ordem de transporte é atribuída a um motorista e veículo).
2.  **Orquestrador**: O `workflow-orchestrator` detecta o evento e aciona o `ai-risk-management-agent`.
3.  **Agente de Risco**: O `ai-risk-management-agent` invoca a API Buonny `Consulta Profissional` com o CPF do motorista e a placa do veículo.
4.  **Buonny**: Retorna o status de risco do motorista/veículo.
5.  **Agente de Risco**: Processa a resposta da Buonny. Se o risco for alto, ele pode notificar o `workflow-orchestrator`.
6.  **Orquestrador**: Se notificado de alto risco, o orquestrador pode:
    *   Marcar a ordem para revisão humana.
    *   Acionar o `ai-operational-agent` para buscar um motorista alternativo.
    *   Acionar o `ai-financial-agent` para recalcular o custo do seguro.
7.  **Monitoramento Contínuo**: Durante a viagem, o `workflow-orchestrator` pode agendar chamadas periódicas ao `ai-risk-management-agent` para consultar a API `Status da Entrega` e `Informações de Viagem`, monitorando o trajeto e o status de risco em tempo real. Qualquer desvio ou alerta da Buonny via callback seria processado pelo orquestrador para ações corretivas.

## 3. Desafios e Soluções na Integração

| Desafio | Solução Proposta |
| :--- | :--- |
| **Protocolo SOAP** | Desenvolver um módulo `buonny-soap-client` no `_shared` do Supabase Functions para encapsular as chamadas SOAP e converter para JSON, facilitando o consumo pelos agentes. |
| **Latência de Callback** | Implementar um endpoint assíncrono no `workflow-orchestrator` para receber os callbacks da Buonny, utilizando um mecanismo de fila de eventos para processamento robusto e retries. |
| **Autenticação** | Gerenciar o Token e CNPJ da Buonny como variáveis de ambiente seguras no Supabase, acessíveis apenas pelo `ai-risk-management-agent`. |
| **Mapeamento de Dados** | Criar um schema de dados interno para representar as informações de risco da Buonny, garantindo consistência e facilitando o uso por outros agentes. |

Esta abordagem permite que o `cargo-flow-navigator` incorpore o gerenciamento de risco da Buonny de forma modular e escalável, alinhada com os princípios da arquitetura multi-agente.

## 4. Cookbooks e Estratégias de KMS para Gerenciamento de Risco com Buonny

Para garantir a governança, a qualidade e a evolução contínua da integração com a Buonny, a skill **Transport Agent Architect** preconiza a criação de **Cookbooks** e a integração com um **Sistema de Gerenciamento de Conhecimento (KMS)**.

### 4.1. Cookbooks para o `ai-risk-management-agent`

Os cookbooks para o `ai-risk-management-agent` detalharão as regras e lógicas de decisão para interagir com a API Buonny e interpretar seus resultados. Exemplos de cookbooks:

*   **Cookbook: Validação de Motorista/Veículo (Pré-Viagem)**
    *   **Objetivo**: Garantir que motoristas e veículos atendam aos critérios de risco da Buonny antes de iniciar uma viagem.
    *   **Gatilho**: Evento `order.assigned` (Ordem de transporte atribuída a motorista/veículo).
    *   **Lógica de Execução**: Chamar `ai-risk-management-agent` para `Consulta Profissional` e `Consulta de Veículo`. Se o status de risco for `Reprovado` ou `Em Análise`, acionar o `workflow-orchestrator` para intervenção humana ou reatribuição.
    *   **Saída**: Status de risco do motorista/veículo, decisão (Aprovado/Reprovado/Em Análise).
    *   **Métricas**: Tempo de resposta da Buonny, taxa de aprovação automática, número de intervenções humanas.

*   **Cookbook: Monitoramento de Risco em Viagem**
    *   **Objetivo**: Monitorar o status de risco de uma viagem em andamento e reagir a alertas da Buonny.
    *   **Gatilho**: Callback da Buonny (`retorno_ficha.atualizado`) ou agendamento recorrente (via `workflow-orchestrator` chamando `ai-risk-management-agent` para `Informações de Viagem` e `Status da Entrega`).
    *   **Lógica de Execução**: Se o callback indicar um alerta (ex: desvio de rota, parada não programada), o `ai-risk-management-agent` notifica o `workflow-orchestrator`. O orquestrador pode então acionar o `ai-operational-agent` para contato com o motorista ou o `ai-financial-agent` para avaliar impacto no seguro.
    *   **Saída**: Alerta de risco, ação recomendada.
    *   **Métricas**: Tempo de resposta a alertas, número de alertas por viagem, taxa de resolução de incidentes.

### 4.2. Integração com o Sistema de Gerenciamento de Conhecimento (KMS)

O KMS será fundamental para centralizar o conhecimento sobre as políticas de risco da Buonny e as melhores práticas de resposta. Ele servirá tanto para os agentes de IA quanto para os operadores humanos.

| Componente do KMS | Função para Agentes de IA | Função para Usuários Humanos |
| :---------------- | :------------------------ | :-------------------------- |
| **Módulo de Cookbooks** | Armazenar as definições formais dos cookbooks do `ai-risk-management-agent`, permitindo que o agente consulte as regras de negócio e os fluxos de decisão. | Fornecer documentação clara sobre como o sistema interage com a Buonny, quais são os critérios de risco e como os alertas são tratados. |
| **Base de Conhecimento de Risco** | Conter dados históricos de incidentes de risco, padrões de desvio de rota, e as ações corretivas mais eficazes, para refinar os modelos de decisão dos agentes. | Oferecer um repositório de casos de uso, lições aprendidas e procedimentos operacionais padrão para lidar com situações de risco. |
| **Módulo de Feedback** | Capturar o feedback dos operadores humanos sobre a precisão das análises de risco da Buonny e a eficácia das ações sugeridas pelos agentes, para otimizar os cookbooks e modelos. | Permitir que os operadores registrem observações, sugiram melhorias nos fluxos de risco e contribuam para a base de conhecimento. |

## 5. Validação e Monitoramento Contínuo

Para garantir a eficácia da integração da Buonny, o monitoramento contínuo é essencial:

*   **Métricas de Performance**: Acompanhar o tempo de resposta das APIs da Buonny, a taxa de sucesso das consultas e callbacks, e o custo associado às chamadas de API.
*   **Métricas de Risco**: Monitorar a redução de incidentes de risco, o tempo médio de resolução de alertas e a conformidade com as políticas de gerenciamento de risco.
*   **Feedback Loop**: Implementar um processo para coletar feedback dos operadores sobre a qualidade das decisões dos agentes de risco e usar esses dados para iterar e refinar os cookbooks e a lógica dos agentes.

Esta estrutura garante que a integração com a Buonny não seja apenas uma conexão técnica, mas uma parte integrante de um sistema inteligente e adaptativo de gerenciamento de risco, alinhado com os princípios da **Transport Agent Architect**.
