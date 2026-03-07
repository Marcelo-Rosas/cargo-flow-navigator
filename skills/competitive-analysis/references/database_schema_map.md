# Mapa do Schema do Banco de Dados — Cargo Flow Navigator

> Gerado em 07/03/2026 via API REST do Supabase (68 tabelas no schema `public`).
> Use este mapa para embasar análises competitivas com dados reais do produto.

## Domínios Funcionais e Tabelas

### 1. Inteligência Artificial e Automação
| Tabela | Colunas Principais | Uso |
|:---|:---|:---|
| `ai_budget_config` | key, value, description | Configuração de orçamento e limites de uso de IA |
| `ai_insights` | insight_type, entity_type, entity_id, analysis, summary_text | Insights gerados pelos agentes de IA |
| `ai_usage_tracking` | analysis_type, model_used, input_tokens, output_tokens, estimated_cost_usd | Rastreamento de custo e uso dos modelos de IA |
| `workflow_definitions` | entity_type, stages | Definições de fluxo de trabalho por entidade |
| `workflow_transitions` | from_stage, to_stage, conditions, requires_approval | Transições de estágio com regras |
| `workflow_events` | event_type, entity_type, payload, status | Fila de eventos para orquestração |
| `workflow_event_logs` | event_id, action, agent, details | Log de execução dos agentes |

### 2. Comercial — Cotação e Precificação
| Tabela | Colunas Principais | Uso |
|:---|:---|:---|
| `quotes` | client_id, origin, destination, value, stage, tags, freight_modality, pricing_breakdown, km_distance, vehicle_type_id | Cotações com breakdown completo de precificação |
| `price_tables` | name, modality, vehicle_type_id, active | Tabelas de preço por modalidade e tipo de veículo |
| `price_table_rows` | price_table_id, min_km, max_km, base_rate | Faixas de distância e tarifas |
| `pricing_rules_config` | key, label, category, value_type, value, vehicle_type_id | Regras de precificação configuráveis |
| `pricing_parameters` | key, value, unit, description | Parâmetros globais de precificação |
| `conditional_fees` | code, name, fee_type, fee_value, conditions | Taxas condicionais (ex: ad valorem, desvio de rota) |
| `gris_services` | code, name, default_percent | Taxas GRIS por tipo de serviço |
| `icms_rates` | origin_state, destination_state, rate_percent | Alíquotas ICMS por par de estados |
| `tac_rates` | diesel_price_base, diesel_price_current, adjustment_percent | Índice TAC (combustível) |
| `toll_routes` | origin_state, destination_state, vehicle_type_id, toll_value, distance_km | Rotas de pedágio por tipo de veículo |
| `antt_floor_rates` | cargo_type, axes_count, ccd, cc | Piso mínimo ANTT por tipo de carga e eixos |
| `ntc_cost_indices` | index_type, period, distance_km, index_value | Índices de custo NTC |
| `ltl_parameters` | min_freight, gris_percent, dispatch_fee, cubage_factor | Parâmetros para carga fracionada (LTL) |
| `waiting_time_rules` | vehicle_type_id, free_hours, rate_per_hour | Regras de tempo de espera |
| `payment_terms` | name, advance_percent, balance_days | Condições de pagamento |
| `quote_payment_proofs` | quote_id, proof_type, amount, status | Comprovantes de pagamento de cotações |

### 3. Clientes e Embarcadores
| Tabela | Colunas Principais | Uso |
|:---|:---|:---|
| `clients` | name, email, cnpj, cpf, city, state | Clientes (pessoas físicas e jurídicas) |
| `shippers` | name, cnpj, email, city, state | Embarcadores |

### 4. Operacional — Ordens e Viagens
| Tabela | Colunas Principais | Uso |
|:---|:---|:---|
| `orders` | quote_id, os_number, stage, origin, destination, value, freight_modality | Ordens de Serviço vinculadas a cotações |
| `order_documents` | order_id, type, status, file_name | Documentos da OS (NF, CTe, MDFe) |
| `trips` | trip_number, vehicle_plate, driver_id, status_operational, financial_status | Viagens com status operacional e financeiro |
| `trip_orders` | trip_id, order_id, apportion_key, apportion_factor | Vínculo OS ↔ Viagem com fator de rateio |
| `trip_cost_items` | trip_id, order_id, scope, category, amount, source | Itens de custo por viagem (TRIP ou OS) |
| `delivery_conditions` | label, description | Condições de entrega configuráveis |
| `discharge_checklist_items` | label, description | Itens de checklist de descarga |

### 5. Motoristas e Frota
| Tabela | Colunas Principais | Uso |
|:---|:---|:---|
| `drivers` | name, cnh, cnh_category, antt, active | Cadastro de motoristas |
| `vehicles` | plate, brand, model, vehicle_type_id, driver_id, owner_id | Cadastro de veículos |
| `vehicle_types` | code, name, axes_count, capacity_kg, rolling_type, vehicle_profile | Tipos de veículo com capacidades |
| `driver_qualifications` | driver_cpf, status, checklist, risk_flags, risk_score, ai_analysis | Qualificação de motoristas com análise de IA |
| `compliance_checks` | order_id, check_type, violations, status, ai_analysis | Verificações de compliance por OS |
| `equipment_rental_rates` | name, code, unit, value | Tarifas de locação de equipamentos |
| `unloading_cost_rates` | name, code, unit, value | Tarifas de descarga |

### 6. Financeiro e Fiscal
| Tabela | Colunas Principais | Uso |
|:---|:---|:---|
| `financial_documents` | type (CTe/NF/PAG/FAT), status, amount, order_id, trip_id | Documentos financeiros e fiscais |
| `financial_installments` | financial_document_id, due_date, amount, status | Parcelas de documentos financeiros |
| `documents` | order_id, quote_id, type, file_url, nfe_key | Documentos físicos (PDFs, XMLs) |
| `approval_requests` | entity_type, approval_type, status, ai_analysis | Solicitações de aprovação com análise de IA |
| `approval_rules` | entity_type, trigger_condition, approver_role | Regras de aprovação automática |

### 7. Regulatório e Atualizações
| Tabela | Colunas Principais | Uso |
|:---|:---|:---|
| `regulatory_updates` | source, title, relevance_score, ai_analysis, action_required | Atualizações regulatórias monitoradas por IA |

### 8. Notificações e Comunicação
| Tabela | Colunas Principais | Uso |
|:---|:---|:---|
| `notification_templates` | key, channel, subject_template, body_template | Templates de notificação |
| `notification_queue` | template, channel, payload, status | Fila de envio de notificações |
| `notification_logs` | template_key, channel, status, entity_type | Log de notificações enviadas |

### 9. Usuários e Segurança
| Tabela | Colunas Principais | Uso |
|:---|:---|:---|
| `profiles` | user_id, full_name, email, perfil | Perfis de usuário |
| `user_roles` | user_id, role | Papéis e permissões |
| `audit_logs` | table_name, record_id, action, old_values, new_values | Log de auditoria completo |
| `valid_users` | user_id, email | Usuários válidos do sistema |

### 10. Views Analíticas
| View | Colunas Principais | Uso |
|:---|:---|:---|
| `v_cash_flow_summary` | period, type, status, total_amount, pending_amount | Resumo de fluxo de caixa |
| `v_quote_order_divergence` | quote_value, order_value, delta_value, margem_percent_prevista | Divergências entre cotação e OS |
| `v_trip_financial_details` | receita_prevista, receita_real, pedagio_real, carreteiro_real | Detalhes financeiros reais vs previstos por viagem |
| `v_trip_financial_summary` | receita_bruta, custos_trip, margem_bruta, margem_percent | Resumo financeiro consolidado por viagem |
| `v_order_payment_reconciliation` | expected_amount, paid_amount, delta_amount, is_reconciled | Reconciliação de pagamentos por OS |
| `v_trip_payment_reconciliation` | expected_amount, paid_amount, all_orders_reconciled | Reconciliação de pagamentos por viagem |
| `v_quote_payment_reconciliation` | expected_amount, paid_amount, is_reconciled | Reconciliação de pagamentos por cotação |

---

## Edge Functions Disponíveis (30 funções)

| Função | Domínio | Descrição |
|:---|:---|:---|
| `calculate-freight` | Precificação | Motor de cálculo de frete |
| `calculate-distance` | Operacional | Cálculo de distância entre CEPs |
| `ai-orchestrator-agent` | IA | Orquestrador principal de agentes |
| `ai-operational-orchestrator` | IA | Orquestrador de fluxos operacionais |
| `ai-financial-agent` | IA/Financeiro | Agente financeiro com análise de anomalias |
| `ai-compliance-check-worker` | IA/Compliance | Worker de verificação de compliance |
| `ai-driver-qualification-worker` | IA/Motoristas | Worker de qualificação de motoristas |
| `ai-operational-agent` | IA/Operacional | Agente operacional |
| `ai-operational-insights-worker` | IA/Analytics | Worker de insights operacionais |
| `ai-operational-report-worker` | IA/Relatórios | Worker de relatórios operacionais |
| `ai-financial-anomaly-worker` | IA/Financeiro | Worker de detecção de anomalias financeiras |
| `ai-quote-profitability-worker` | IA/Comercial | Worker de análise de rentabilidade de cotações |
| `ai-dashboard-insights-worker` | IA/Analytics | Worker de insights para dashboard |
| `ai-stage-gate-worker` | IA/Workflow | Worker de gate de estágio |
| `ai-manager` | IA | Gerenciador de agentes de IA |
| `ai-approval-summary-worker` | IA/Aprovação | Worker de resumo de aprovações |
| `ai-regulatory-update-worker` | IA/Regulatório | Worker de monitoramento regulatório |
| `workflow-orchestrator` | Workflow | Orquestrador de fluxos de trabalho |
| `ensure-financial-document` | Financeiro | Garantia de criação de documentos financeiros |
| `reconcile-trip` | Financeiro | Reconciliação de viagem |
| `process-payment-proof` | Financeiro | Processamento de comprovantes de pagamento |
| `process-quote-payment-proof` | Financeiro | Processamento de comprovantes de cotação |
| `download-document` | Documentos | Download de documentos gerados |
| `import-price-table` | Precificação | Importação de tabelas de preço |
| `price-row` | Precificação | Gestão de linhas de tabela de preço |
| `send-quote-email` | Comercial | Envio de e-mail de cotação |
| `notification-hub` | Notificações | Hub central de notificações |
| `lookup-cep` | Utilitário | Consulta de CEP |
| `calculate-distance-webrouter` | Utilitário | Cálculo de distância via web |
| `invite-user` | Auth | Convite de usuários |
