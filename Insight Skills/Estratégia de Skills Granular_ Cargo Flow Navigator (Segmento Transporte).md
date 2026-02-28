# Estratégia de Skills Granular: Cargo Flow Navigator (Segmento Transporte)

Esta estratégia detalha as skills necessárias para o plano hierárquico multi-agente, com foco em granularidade e propostas de execução de tarefas para os estágios comercial, operacional e financeiro, integrando o suporte dos squads de segurança, design, código e fluxos.

---

## 1. Squads de Apoio e Governança

Os squads atuam transversalmente, garantindo a qualidade e a conformidade das skills dos agentes:

| Squad | Foco Principal | Exemplos de Tarefas de Apoio às Skills |
| :--- | :--- | :--- |
| **Segurança** | Integridade e Confidencialidade | - Revisão de políticas de RLS para `trip_cost_items` e `financial_documents`.
- Implementação de mascaramento de dados sensíveis em logs de agentes.
- Auditoria de acesso a APIs externas (ex: Ailog, ViaCEP) e chaves de serviço. |
| **Design** | Usabilidade e Experiência | - Criação de componentes reutilizáveis para visualização de rateios e alertas de anomalias.
- Definição de fluxos de interação para ajustes manuais de custos e aprovações.
- Padronização de notificações (email/WhatsApp) geradas pelos agentes. |
| **Código** | Performance e Manutenibilidade | - Otimização de Edge Functions (ex: `calculate-freight`, `ai-financial-agent`).
- Implementação de testes unitários e de integração para a lógica de rateio e agrupamento.
- Gestão de dependências e versionamento de APIs internas dos agentes. |
| **Fluxos** | Orquestração e Resiliência | - Definição de retries e fallbacks para chamadas de agentes (ex: `ai-operational-agent`).
- Monitoramento de filas de eventos (`workflow_events`) e alertas de gargalos.
- Modelagem de estados e transições para o ciclo de vida de `trips` e `orders`. |

---

## 2. Skills Granulares por Estágio

### A. Estágio Comercial (Cotações)

#### Skill: Inteligência de Precificação e Margem (Agente: `ai-financial-agent`)
- **Objetivo**: Sugerir o preço de frete ideal e avaliar a rentabilidade de uma cotação, considerando custos e mercado.
- **Dados de Entrada**: `quote_id`, `pricing_breakdown` (JSONB), `vehicle_type`, `route_distance`, `cargo_weight`, `cargo_volume`, `historical_margins` (tabela `ai_insights`).
- **Lógica de Execução/Decisão**:
  1.  **Coleta de Dados**: Busca `quote` e `pricing_breakdown` no banco de dados.
  2.  **Cálculo de Custo Base**: Utiliza `calculate-freight` (Edge Function) para estimar custos de pedágio, combustível, taxas (GRIS, TSO, NTC) com base na rota e tipo de veículo.
  3.  **Análise de Mercado/Histórico**: Consulta `ai_insights` para comparar a margem projetada com o histórico de cotações similares (mesma rota, tipo de carga, cliente).
  4.  **Avaliação de Risco**: Utiliza LLM (`gpt-4.1-mini`) para analisar o `pricing_breakdown` e identificar potenciais custos ocultos ou subestimados, gerando um `risk_score`.
  5.  **Sugestão de Preço/Margem**: Com base nos custos, histórico e risco, o LLM sugere um preço final ou um ajuste na margem, justificando a decisão.
- **Saída/Resultado**: Objeto JSON com `suggested_price`, `projected_margin`, `risk_score`, `summary_text` e `recommendation` (armazenado em `ai_insights`).
- **Integração com Squads**: 
    - **Código**: Otimização da Edge Function `calculate-freight` e `ai-financial-agent`.
    - **Fluxos**: Definição de retries para chamadas ao LLM e tratamento de falhas na API de cálculo de frete.

#### Skill: Validação de Viabilidade Operacional (Agente: `ai-operational-agent`)
- **Objetivo**: Verificar se uma cotação é operacionalmente viável antes de ser confirmada, evitando problemas futuros.
- **Dados de Entrada**: `quote_id`, `origin_address`, `destination_address`, `vehicle_type`, `cargo_dimensions`, `delivery_window`, `driver_availability`.
- **Lógica de Execução/Decisão**:
  1.  **Consulta de Restrições**: Verifica zonas de restrição de tráfego (ZMRC) para o tipo de veículo nos endereços de origem/destino.
  2.  **Disponibilidade de Frota/Motorista**: Consulta o sistema de gestão de frota para verificar a disponibilidade de veículos e motoristas qualificados para a rota e período.
  3.  **Análise de Rota**: Utiliza `calculate-distance` (Edge Function) para validar a rota e identificar trechos com alto risco (ex: áreas de roubo de carga, estradas em má condição).
  4.  **Feedback Operacional**: O LLM (`gpt-4.1-mini`) sintetiza as informações e gera um parecer sobre a viabilidade, apontando potenciais gargalos ou necessidades de ajuste.
- **Saída/Resultado**: Objeto JSON com `operational_status` (`viable`, `conditional`, `unviable`), `issues_identified`, `recommendations` (armazenado em `ai_insights`).
- **Integração com Squads**: 
    - **Segurança**: Garantir que dados de localização e motoristas sejam tratados com privacidade.
    - **Design**: Criação de alertas visuais no painel comercial para cotações com baixa viabilidade operacional.

### B. Estágio Operacional (Viagens e Ordens)

#### Skill: Agrupamento Inteligente de Ordens em Viagens (Agente: `workflow-orchestrator`)
- **Objetivo**: Agrupar automaticamente ordens de serviço (OS) em viagens (`trips`) para otimizar o uso de veículos e motoristas.
- **Dados de Entrada**: `order_id`, `vehicle_plate`, `departure_date`, `stage` (`coleta_realizada`), `existing_trips` (tabela `trips`).
- **Lógica de Execução/Decisão**:
  1.  **Gatilho**: Evento `order_stage_changed` para `coleta_realizada` com `vehicle_plate` preenchido.
  2.  **Busca de Viagem Existente**: Consulta `trips` por `vehicle_plate` e `departure_date` com `status = 'aberta'`.
  3.  **Decisão de Agrupamento**:
      - Se `trip` encontrada: Adiciona `order_id` a `trip_orders` e atualiza `orders.trip_id`.
      - Se `trip` não encontrada: Cria nova `trip` e vincula a OS.
  4.  **Sincronização de Custos**: Chama `sync_cost_items_from_breakdown(trip_id)` para popular `trip_cost_items` com base nos `pricing_breakdown` das OS vinculadas.
- **Saída/Resultado**: `trip_id` vinculado à `order`, `trip_cost_items` atualizados, `workflow_event_logs` registrando a ação.
- **Integração com Squads**: 
    - **Fluxos**: Definição de regras de idempotência para `trip_cost_items` e `trip_orders`.
    - **Código**: Otimização da RPC `auto_create_order_from_quote` e `sync_cost_items_from_breakdown`.

#### Skill: Validação de Compliance Pré-Coleta (Agente: `ai-operational-agent`)
- **Objetivo**: Garantir que todos os documentos e requisitos regulatórios sejam atendidos antes da coleta da carga.
- **Dados de Entrada**: `order_id`, `document_status` (NF, CT-e, MDFe), `driver_documents` (CNH, ANTT), `vehicle_documents` (CRLV, seguro), `cargo_type`.
- **Lógica de Execução/Decisão**:
  1.  **Verificação de Documentos**: Consulta o status de upload e validação de documentos obrigatórios (NF, CT-e, MDFe) associados à `order`.
  2.  **OCR e Validação de Dados**: Para documentos enviados, utiliza um serviço de OCR (externo ou Edge Function) para extrair dados-chave e valida-os contra regras de negócio (ex: validade da CNH, conformidade do ANTT).
  3.  **Consulta de Restrições**: Verifica se o `cargo_type` possui restrições específicas (ex: produtos perigosos) e se a documentação adicional está presente.
  4.  **Parecer de Compliance**: O LLM (`gpt-4.1-mini`) gera um parecer consolidado, indicando se a ordem está apta para coleta ou quais pendências precisam ser resolvidas.
- **Saída/Resultado**: Objeto JSON com `compliance_status` (`approved`, `pending`, `rejected`), `pending_items`, `recommendations` (armazenado em `ai_insights`). Notificação para o usuário responsável via `notification-hub` se houver pendências.
- **Integração com Squads**: 
    - **Segurança**: Proteção de dados de documentos e motoristas.
    - **Design**: Criação de um dashboard de pendências de compliance para o time operacional.

### C. Estágio Financeiro (Margem e PAG)

#### Skill: Rateio e Consolidação de Custos (Agente: `ai-financial-agent`)
- **Objetivo**: Calcular o rateio de custos compartilhados de uma viagem entre as ordens de serviço e consolidar a margem da viagem.
- **Dados de Entrada**: `trip_id`, `trip_orders` (tabela de junção), `trip_cost_items` (tabela de custos), `orders.value`, `orders.weight`, `orders.volume`.
- **Lógica de Execução/Decisão**:
  1.  **Gatilho**: Evento `trip_status_changed` para `finalizada` ou `order_added_to_trip`.
  2.  **Cálculo de Fatores de Rateio**: Para cada OS na `trip`, calcula o `apportion_factor` com base no `apportion_key` configurado (revenue, weight, volume, km, equal, manual).
  3.  **Atribuição de Custos**: 
      - Custos com `scope = 'TRIP'` são rateados entre as OS usando o `apportion_factor`.
      - Custos com `scope = 'OS'` são atribuídos diretamente à `order_id` correspondente.
  4.  **Cálculo de Margem Consolidada**: Soma receitas e custos de todas as OS da viagem para obter `Receita_Bruta_Trip`, `Custos_Diretos_Trip`, `Impostos_Trip`, `Margem_Bruta_Trip`, `Resultado_Liq_Trip`.
  5.  **Cálculo de Margem por OS**: Para cada OS, calcula `Receita_OS`, `Custos_TRIP_Rateado`, `Custos_OS_Proprio`, `Custos_Diretos_OS`, `Resultado_Liq_OS`.
- **Saída/Resultado**: Atualização dos campos de margem e custos rateados nas tabelas `orders` e `trips`, e registro detalhado em `trip_cost_items` com o `apportion_factor` aplicado.
- **Integração com Squads**: 
    - **Código**: Otimização das queries SQL para cálculos de rateio e agregação.
    - **Design**: Visualização clara dos custos rateados e da contribuição de cada OS para a margem da viagem no `FinancialDetailModal`.

#### Skill: Aprovação de Pagamentos (PAG) (Agente: `workflow-orchestrator` com `ai-financial-agent`)
- **Objetivo**: Orquestrar o processo de aprovação de pagamentos a carreteiros (PAG), aplicando regras de negócio e inteligência artificial.
- **Dados de Entrada**: `pag_id`, `total_amount`, `source_type` (`order` ou `trip`), `approval_rules` (tabela `approval_rules`), `ai_insights` (para `financial_anomaly`).
- **Lógica de Execução/Decisão**:
  1.  **Gatilho**: Evento `financial_status_changed` para `GERADO` em um documento `PAG`.
  2.  **Verificação de Regras de Aprovação**: Consulta `approval_rules` para determinar se o `PAG` requer aprovação manual com base no `total_amount`, `source_type` ou outros critérios.
  3.  **Análise de Anomalias**: Se o `PAG` for de alto valor ou se houver histórico de anomalias para a `trip`/`order` associada, aciona o `ai-financial-agent` com `analysisType: 'financial_anomaly'`.
  4.  **Decisão de Aprovação**: 
      - Se não requer aprovação manual e sem anomalias: `PAG` é automaticamente aprovado.
      - Se requer aprovação manual ou com anomalias: `PAG` é marcado como `PENDING_APPROVAL` e uma notificação é enviada aos aprovadores via `notification-hub`.
- **Saída/Resultado**: `financial_document.status` atualizado (`APROVADO` ou `PENDING_APPROVAL`), `ai_insights` com análise de anomalias, `notification_logs` para aprovadores.
- **Integração com Squads**: 
    - **Segurança**: RLS para `approval_rules` e `financial_documents`.
    - **Fluxos**: Definição de estados para `PAG` (`GERADO`, `PENDING_APPROVAL`, `APROVADO`, `REJEITADO`).

---

## 3. Arquitetura de Skills e Cookbooks

Cada skill deve ser documentada como um cookbook em `docs/cookbooks/`, seguindo a estrutura proposta anteriormente, mas com o nível de detalhe técnico apresentado acima. Isso inclui:

- **Contrato de Entrada/Saída**: Schemas JSON para payloads de eventos e respostas de agentes.
- **Gatilho Claro**: Eventos específicos do `workflow_events` que disparam a skill.
- **Critério de Sucesso**: Métricas como tempo de execução, taxa de acurácia (para IAs) e taxa de automação.
- **Observabilidade**: Logs detalhados de cada etapa da execução da skill.
- **Fallback Operacional**: Procedimentos para quando a skill falha (ex: notificação para intervenção humana, reprocessamento).
- **Custos e Limites**: Estimativa de custo por execução (especialmente para chamadas de LLM) e limites de uso.
- **Segurança e Compliance**: Requisitos de privacidade e conformidade para os dados manipulados pela skill.

Esta abordagem garante que cada skill seja um componente modular, testável e observável, facilitando a manutenção e a evolução do sistema multi-agente.
