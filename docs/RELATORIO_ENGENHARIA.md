# Relatório de Engenharia — Cargo Flow Navigator (Vectra Cargo)

*Última revisão do documento: 2026-03-07 — rotas/roles (`App.tsx`), Edge Functions, composição de carga, observabilidade e testes.*

## 1. Visão Geral

Sistema de gestão logística com módulos de cotação, ordens de serviço, financeiro, frota, documentos e aprovações. Stack principal: **React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Supabase (PostgreSQL, Auth, RLS) + TanStack React Query**.

Rotas de página com **lazy loading** (`React.lazy` em `App.tsx`); **Sentry** integrado ao React Router v6 (`withSentryReactRouterV6Routing`).

**Documentação auxiliar:** `docs/terminal/COMANDOS_PRINCIPAIS.md`, `docs/DEBUGGING_GUIDE.md`, `docs/LOAD_COMPOSITION_DEPLOY_CHECKLIST.md`, `audits/README.md` (relatórios de auditoria, quando presentes).

---

## 2. Mapa de Rotas e Módulos


| Rota                     | Página                                     | Roles exigidas                                 |
| ------------------------ | ------------------------------------------ | ---------------------------------------------- |
| `/`                      | Dashboard                                  | autenticado                                    |
| `/auth`                  | Login                                      | público                                        |
| `/reset-password`        | Redefinir senha                            | público                                        |
| `/comercial`             | Kanban Comercial                           | admin, financeiro, operacional                 |
| `/operacional`           | Kanban Operacional                         | admin, financeiro, operacional                 |
| `/documentos`            | Documentos                                 | autenticado                                    |
| `/clientes`              | Clientes                                   | autenticado                                    |
| `/embarcadores`          | Embarcadores (Shippers)                    | autenticado                                    |
| `/veiculos`              | Veículos (abas Motoristas / Proprietários) | autenticado                                    |
| `/motoristas`            | —                                          | redireciona para `/veiculos?tab=motoristas`    |
| `/proprietarios`         | —                                          | redireciona para `/veiculos?tab=proprietarios` |
| `/tabelas-preco`         | Tabelas de preço                           | admin, operacional, financeiro                 |
| `/financeiro`            | Kanban Financeiro (FAT/PAG)                | admin, financeiro, operacional                 |
| `/relatorios`            | DRE Operacional                            | autenticado                                    |
| `/aprovacoes`            | Aprovações                                 | **admin, financeiro**                          |
| `/usuarios`              | Gestão de usuários                         | admin                                          |
| `/monitoramento-seguros` | Monitoramento de seguros (Buonny / risco)  | admin, financeiro, operacional                 |


---

## 3. Fluxos Nomeados e Estágios

### 3.1 Fluxo Comercial — Cotação (`quote_stage`)


| Stage          | Nome         | Descrição                     |
| -------------- | ------------ | ----------------------------- |
| `novo_pedido`  | Novo pedido  | Entrada inicial               |
| `qualificacao` | Qualificação | Validação do lead             |
| `precificacao` | Precificação | Cálculo de frete em andamento |
| `enviado`      | Enviado      | Cotação enviada ao cliente    |
| `negociacao`   | Negociação   | Em negociação comercial       |
| `ganho`        | Ganho        | Cotação vencedora             |
| `perdido`      | Perdido      | Cotação perdida               |


**Entrypoints:** `Commercial.tsx`, `QuoteCard.tsx`, `QuoteForm.tsx`, `QuoteFormWizard.tsx`, `QuoteDetailModal.tsx`, `useQuotes.ts`, `LoadCompositionOverlay.tsx` (oportunidades de consolidação por embarcador)

### 3.2 Fluxo Operacional — Ordem de Serviço (`order_stage`)


| Stage              | Nome             | Descrição                        |
| ------------------ | ---------------- | -------------------------------- |
| `ordem_criada`     | Ordem criada     | OS criada                        |
| `busca_motorista`  | Busca motorista  | Alocação de motorista            |
| `documentacao`     | Documentação     | Coleta de docs (CNH, CRLV, etc.) |
| `coleta_realizada` | Coleta realizada | Carga recolhida                  |
| `em_transito`      | Em trânsito      | Em rota                          |
| `entregue`         | Entregue         | Entrega concluída                |


**Entrypoints:** `Operations.tsx`, `OrderForm.tsx`, `OrderDetailModal.tsx`, `useOrders.ts`

### 3.3 Fluxo Financeiro (FAT/PAG)

- **FAT (Faturamento)**: documento a receber do cliente, gerado a partir da cotação/OS.
- **PAG (Pagamento)**: documento a pagar ao carreteiro.

**Entrypoints:** `Financial.tsx`, `useEnsureFinancialDocument.ts`, `useFinancialDocumentsKanban.ts`

### 3.4 Qualificação de Motorista (`driver_qualification_status`)


| Status       | Descrição          |
| ------------ | ------------------ |
| `pendente`   | Aguardando análise |
| `em_analise` | Em análise pela IA |
| `aprovado`   | Liberado           |
| `reprovado`  | Não liberado       |
| `bloqueado`  | Bloqueado          |


### 3.5 Compliance (`compliance_check_type`)


| Tipo                  | Momento             |
| --------------------- | ------------------- |
| `pre_contratacao`     | Antes de contratar  |
| `pre_coleta`          | Antes da coleta     |
| `pre_entrega`         | Antes da entrega    |
| `auditoria_periodica` | Auditoria periódica |


---

## 4. Tabelas do Banco (Campos Principais)

### 4.1 Cotação

`**quotes*`* — Cotação  

- `id`, `quote_code`, `client_id`, `client_name`, `shipper_id`, `shipper_name`  
- `origin`, `destination`, `origin_cep`, `destination_cep`  
- `value` (centavos), `stage` (quote_stage)  
- `price_table_id`, `vehicle_type_id`, `payment_term_id`  
- `km_distance`, `toll_value`, `cargo_type`, `weight`, `volume`  
- `cubage_weight`, `billable_weight`  
- `pricing_breakdown` (JSON), `advance_due_date`, `balance_due_date`  
- `carreteiro_real`, `carreteiro_antt`, `is_legacy`  
- `created_at`, `updated_at`

`**quote_route_stops**` — Paradas intermediárias da rota (cotação com paradas)  

- `id`, `quote_id`, `sequence`, `stop_type` (origin | stop | destination)  
- `cnpj`, `name`, `cep`, `city_uf`, `label`  
- `planned_km_from_prev`, `metadata`  
- RLS: SELECT authenticated; INSERT/UPDATE/DELETE para admin/operacional/financeiro  
- Ref: `docs/plans/análise-360-paradas-roteiro-multiplos-destinatários.md`

### 4.2 Ordem de Serviço

`**orders**` — Ordem de serviço  

- `id`, `os_number`, `quote_id`, `client_id`, `client_name`  
- `origin`, `destination`, `value`, `stage`  
- `driver_id`, `vehicle_id`, `trip_id`  
- `carreteiro_real`, `advance_due_date`, `balance_due_date`  
- `created_at`, `updated_at`

`**trips**` — Viagem  

- `id`, `trip_number`, `order_id`, `driver_id`, `vehicle_id`  
- `status`, `value`, `km_distance`, `toll_value`

### 4.3 Financeiro

`**financial_documents**`  

- `id`, `code`, `source_type` (quote/order), `source_id`  
- `type` (FAT | PAG), `status`, `total_amount`  
- `owner_id` (proprietário)

`**financial_installments**`  

- `id`, `financial_document_id`, `amount`, `due_date`  
- `status` (pendente | baixado), `settled_at`, `payment_method`

`**payment_proofs**` — Comprovantes de pagamento  

- `id`, `financial_document_id`, `amount`, `proof_type`, `paid_at`  
- `delta_amount`, `delta_reason`

### 4.4 Precificação

`**price_tables**` — Tabela de preço  

- `id`, `name`, `modality` (FTL/LTL), `vehicle_type_id`, `active`  
- `valid_from`, `valid_until`

`**price_table_rows**` — Linhas por faixa de km  

- `id`, `price_table_id`, `min_km`, `max_km`  
- `base_value`, `cost_per_km`, `min_value`  
- `toll_included`, `gris_included`

`**payment_terms**`  

- `id`, `code`, `name`, `days`  
- `adjustment_percent`, `advance_percent`

`**conditional_fees**` — Taxas condicionais (TDE, TEAR, etc.)  

- `id`, `code`, `name`, `fee_type`, `fee_value`  
- `applies_to`, `conditions`

`**antt_floor_rates**` — Piso ANTT  

- `axes_count`, `cargo_type`, `cc`, `ccd`, `operation_table`

`**icms_rates**` — ICMS interestadual  

- `origin_state`, `destination_state`, `rate_percent`

`**toll_routes**`, `**waiting_time_rules**`, `**equipment_rental_rates**`, `**unloading_cost_rates**`

### 4.5 Frota e Cadastros

`**clients**` — Clientes  

- `id`, `name`, `cnpj`, `cpf`, `email`, `phone`  
- `address`, `city`, `state`, `zip_code`  
- `user_id`

`**shippers**` — Embarcadores  

- `id`, `name`, `cnpj`, `email`, `phone`, `user_id`

`**drivers**` — Motoristas  

- `id`, `name`, `cnh`, `cnh_category`, `antt`, `phone`, `active`

`**vehicles**` — Veículos  

- `id`, `plate`, `model`, `vehicle_type_id`, `owner_id`, `active`

`**owners**` — Proprietários  

- `id`, `name`, `cnpj`, `email`, `phone`

`**vehicle_types**`  

- `id`, `code`, `name`, `axes_count`, `ailog_category`, `capacity_kg`, `capacity_m3`

`**driver_qualifications**`  

- `id`, `order_id`, `driver_id`, `status`  
- `risk_score`, `risk_flags`, `ai_analysis`, `checklist`

### 4.6 Documentos

`**documents**`  

- `id`, `order_id`, `quote_id`, `trip_id`, `fat_id`  
- `type` (document_type), `file_url`, `file_name`  
- `source`, `validation_status`, `nfe_key`  
- `uploaded_by`

**Tipos (`document_type`):**  
`nfe`, `cte`, `pod`, `cnh`, `crlv`, `comp_residencia`, `antt_motorista`, `mdfe`, `adiantamento`, `analise_gr`, `doc_rota`, `comprovante_vpo`, `comprovante_descarga`, `adiantamento_carreteiro`, `saldo_carreteiro`, `a_vista_fat`, `saldo_fat`, `a_prazo_fat`, `outros`

### 4.7 Aprovações e Workflow

`**approval_requests`**  

- `id`, `entity_type`, `entity_id`, `approval_type`  
- `status`, `requested_by`, `assigned_to`, `decided_by`  
- `decision_notes`, `ai_analysis`, `expires_at`

`**approval_rules**`  

- `id`, `entity_type`, `approval_type`, `approver_role`  
- `trigger_condition`, `auto_approve_after_hours`

`**workflow_events**`, `**workflow_transitions**`, `**workflow_event_logs**`

### 4.8 AI e Auditoria

`**ai_insights**` — Insights de IA  

- `id`, `insight_type`, `entity_type`, `entity_id`  
- `analysis`, `summary_text`, `user_feedback`, `user_rating`

`**ai_usage_tracking**` — Uso de tokens  

- `analysis_type`, `input_tokens`, `output_tokens`, `estimated_cost_usd`  
- `model_used`, `status`

`**ai_budget_config**` — Orçamento de IA  

- `key`, `value`, `description`

`**audit_logs**`  

- `table_name`, `record_id`, `action`, `old_values`, `new_values`, `user_id`

### 4.9 Composição de carga (consolidação)

`**load_composition_suggestions**` — Sugestões de agrupar cotações do **mesmo embarcador** em janela operacional (detalhe de colunas: ver migrações Supabase).

- Campos típicos: `quote_ids[]`, `consolidation_score`, `estimated_savings_brl`, `is_feasible`, `status` (pending  approved  rejected  executed), `trigger_source` (batch  on_save  manual), métricas e pernas de rota em tabelas associadas quando existirem.
- **Edge:** `analyze-load-composition` — gera sugestões; ao buscar cotações, inclui `quote_route_stops` (join) para waypoints na análise.
- **Edge:** `approve-composition`, `generate-optimal-route`, `calculate-discount-breakdown`.
- **UI:** `LoadCompositionOverlay`, `LoadCompositionModal`, `LoadCompositionCard`, `useLoadCompositionController`, `useLoadCompositionSuggestions`, `useAnalyzeLoadComposition`, `useApproveComposition`, `useCalculateDiscounts`.

---

## 5. Edge Functions e Responsabilidades


| Função                           | Responsabilidade                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `calculate-freight`              | Cálculo de frete servidor-side                                                                                           |
| `calculate-distance-webrouter`   | Distância e roteirização (WebRouter). Suporta `waypoints` (paradas intermediárias) para rota origem → paradas → destino. |
| `calculate-distance`             | Fallback de distância                                                                                                    |
| `price-row`                      | Busca linha de preço por km                                                                                              |
| `lookup-cep`                     | Busca CEP (ViaCEP/BrasilAPI/OpenCEP)                                                                                     |
| `send-quote-email`               | Envio de e-mail de cotação                                                                                               |
| `ensure-financial-document`      | Criação/atualização de FAT/PAG                                                                                           |
| `process-payment-proof`          | Processamento de comprovante (PAG)                                                                                       |
| `process-quote-payment-proof`    | Processamento de comprovante (FAT)                                                                                       |
| `reconcile-trip`                 | Conciliação de viagem                                                                                                    |
| `notification-hub`               | Notificações (WhatsApp via Evolution/OpenClaw)                                                                           |
| `workflow-orchestrator`          | Orquestração de workflow                                                                                                 |
| `ai-manager`                     | Gerência de tarefas IA                                                                                                   |
| `ai-orchestrator-agent`          | Orquestrador de agentes IA                                                                                               |
| `ai-operational-orchestrator`    | Orquestração operacional                                                                                                 |
| `ai-operational-agent`           | Agente operacional                                                                                                       |
| `ai-financial-agent`             | Agente financeiro                                                                                                        |
| `ai-approval-summary-worker`     | Resumo de aprovações                                                                                                     |
| `ai-driver-qualification-worker` | Qualificação de motorista                                                                                                |
| `ai-quote-profitability-worker`  | Rentabilidade de cotação                                                                                                 |
| `ai-dashboard-insights-worker`   | Insights do dashboard                                                                                                    |
| `ai-operational-insights-worker` | Insights operacionais                                                                                                    |
| `ai-operational-report-worker`   | Relatório operacional                                                                                                    |
| `ai-compliance-check-worker`     | Checagem de compliance                                                                                                   |
| `ai-financial-anomaly-worker`    | Anomalias financeiras                                                                                                    |
| `ai-regulatory-update-worker`    | Atualizações regulatórias                                                                                                |
| `ai-stage-gate-worker`           | Stage gate do workflow                                                                                                   |
| `evaluate-risk`                  | Avaliação de risco                                                                                                       |
| `buonny-check`                   | Integração Buonny/seguro (chamada síncrona)                                                                              |
| `buonny-check-worker`            | Worker assíncrono Buonny                                                                                                 |
| `analyze-load-composition`       | Análise e sugestões de consolidação de carga por embarcador                                                              |
| `approve-composition`            | Aprovar composição e fluxos associados                                                                                   |
| `generate-optimal-route`         | Rota otimizada para composição                                                                                           |
| `calculate-discount-breakdown`   | Simulação/cálculo de descontos na composição                                                                             |
| `auto-approval-worker`           | Autoaprovação conforme regras (ver `.claude/commands/cargo-flow-auto-approval-worker.md`)                                |
| `followup-dispatcher`            | Disparo de follow-ups                                                                                                    |
| `market-insights`                | Insights de mercado                                                                                                      |
| `news-agent`                     | Agente de notícias                                                                                                       |
| `ntc-ingest`                     | Ingestão NTC                                                                                                             |
| `petrobras-diesel`               | Referência diesel Petrobras                                                                                              |
| `import-price-table`             | Importação de tabela de preço                                                                                            |
| `invite-user`                    | Convite de usuário                                                                                                       |
| `download-document`              | Download de documento                                                                                                    |
| `resend-webhook`                 | Webhook Resend                                                                                                           |


---

## 6. Views e Funções PostgreSQL

**Views:**  
`financial_documents_kanban`, `financial_receivable_kanban`, `financial_payable_kanban`, `trip_financial_summary`, `v_order_payment_reconciliation`, `v_trip_payment_reconciliation`, `v_trip_financial_details`, `v_quote_order_divergence`, `order_documents`, `valid_users`

**Funções principais:**  
`generate_quote_code`, `generate_os_number`, `generate_trip_number`  
`ensure_financial_document`, `find_price_row_by_km`  
`validate_transition`, `get_valid_transitions`  
`get_user_role`, `has_profile`, `has_role`, `is_admin`  
`link_order_to_trip`, `sync_cost_items_from_breakdown`  
`mask_cep`, `mask_cnpj`, `mask_cpf`, `mask_plate`, `norm_plate`  
`check_ai_budget`, `get_ai_usage_stats`, `get_ai_daily_spend`, `get_ai_monthly_spend`

---

## 7. Contract de Precificação (StoredPricingBreakdown)

`quotes.pricing_breakdown` armazena:

- **meta:** `routeUfLabel`, `kmBandLabel`, `kmStatus`, `marginStatus`, `marginPercent`, `kmBandUsed`, `tollPlazas`, `cubageWeight`, `billableWeight`, `antt`, etc.
- **totals:** `totalCliente`, `das`, `icms`, `totalImpostos`
- **profitability:** `custosCarreteiro`, `resultadoLiquido`, `margemPercent`
- **components:** `baseCost`, `toll`, `gris`, `tso`, `rctrc`, `adValorem`, taxas condicionais, etc.

---

## 8. Convenções Técnicas

- **Moeda no banco:** centavos (ex: `150000` = R$ 1.500,00)
- **Roles:** `admin` | `financeiro` | `operacional` | `comercial` | `fiscal` | `leitura`
- **DnD:** `@dnd-kit/core` + `SortableContext` nos Kanbans
- **Formulários:** React Hook Form + Zod + `@hookform/resolvers`
- **Estado servidor:** TanStack React Query (sem Zustand)
- **Auth:** `useAuth` de `src/hooks/useAuth.tsx`
- **Chamada Edge Functions:** `src/lib/edgeFunctions.ts` via `invokeEdgeFunction`
- **Cálculo de frete:** `src/lib/freightCalculator.ts` (local) + `calculate-freight` (Edge)
- **Rotas críticas:** `RouteErrorBoundary` em Comercial, Operacional e Financeiro (`App.tsx`)
- **Observabilidade:** Sentry (`src/lib/sentry`) com boundary de rota
- **Mapas (opcional):** `VITE_GOOGLE_MAPS_API_KEY` no `.env` (Geocoding API + Maps JavaScript API; ver `.env.example`); **Leaflet** / **react-leaflet** disponíveis no bundle quando a UI de mapas é usada
- **CI / qualidade front:** workflow `.github/workflows/audit-lighthouse.yml` (build + Lighthouse em `dist` servido localmente)
- **E2E:** Playwright em `tests/e2e/` (ex.: `flows/*.seeded.spec.ts`)

---

## 9. Cotação com Paradas (origem → paradas → destino)

Feature para rotas com múltiplos pontos. MVP: 1 FAT + 1 PAG por viagem; embarcador CIF único; `route_stops` vazio = fluxo atual (2 pontos).

- **Schema:** `QuoteFormData.route_stops` — array de `{ sequence, cep, city_uf }`
- **UI:** `IdentificationStep.tsx` — seção “Paradas intermediárias” com add/remove de paradas (CEP + Cidade-UF)
- **Cálculo KM:** `handleCalculateKm` envia `waypoints` para `calculate-distance-webrouter`; rota = origem + paradas + destino
- **Persistência:** Tabela `quote_route_stops`; hook `useQuoteRouteStops` + `syncQuoteRouteStops`; integrado em create/update do `QuoteForm`
- **Tipos:** `src/types/route-stops.ts` — `RouteStop`, `Waypoint` (domínio); o formulário persiste via `**RouteStopFormItem`** em `useQuoteRouteStops.ts` (`syncQuoteRouteStops` grava linhas com `stop_type` `stop` quando há CEP válido)
- **Visualização:** `ReviewStep.tsx` e `QuoteDetailModal` (via `FinancialRouteInfo` com `routeStops`) exibem rota completa origem → paradas → destino
- **Entrypoints:** `QuoteForm.tsx`, `IdentificationStep.tsx`, `ReviewStep.tsx`, `QuoteDetailModal.tsx`, `FinancialRouteInfo.tsx`, `useQuoteRouteStops.ts`, `calculate-distance-webrouter/index.ts`

---

## 10. Hooks Principais por Módulo


| Módulo              | Hooks                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cotação             | `useQuotes`, `useCreateLegacyQuote`, `useCalculateFreight`, `useSendQuoteEmail`, `useQuoteRouteStops` (paradas: persistência em `quote_route_stops`, waypoints na Edge Function) |
| Ordem/Operacional   | `useOrders`, `useTrips`                                                                                                                                                          |
| Financeiro          | `useEnsureFinancialDocument`, `useFinancialDocumentsKanban`, `useQuotePaymentProofs`, `useComplianceChecks`                                                                      |
| Precificação        | `usePriceTables`, `usePriceTableRows`, `usePricingRules`, `useVehicleTypes`, `useAnttFloorRate`, `useUnloadingCostRates`                                                         |
| Frota               | `useClients`, `useShippers`, `useDrivers`, `useVehicles`, `useOwners`, `useDriverQualification`                                                                                  |
| Documentos          | `useDocuments`, `useCepLookup`                                                                                                                                                   |
| Aprovações          | `useApprovalRequests`, `useWorkflowEvents`, `useWorkflowTransitions`                                                                                                             |
| Relatórios          | `useDreOperacionalReport`, `useDreComparativoReport`                                                                                                                             |
| Auth                | `useAuth`, `useUserRole`                                                                                                                                                         |
| IA                  | `useAiInsights`, `useAiBudgetConfig`, `useAiUsageStats`                                                                                                                          |
| Composição de carga | `useLoadCompositionSuggestions`, `useLoadCompositionController`, `useAnalyzeLoadComposition`, `useApproveComposition`, `useCalculateDiscounts`                                   |


