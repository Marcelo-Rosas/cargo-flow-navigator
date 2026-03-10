# Buonny Integration — Context

**Status:** AGUARDANDO RETORNO DA BUONNY
**Ultima atualizacao:** 2026-03-09
**Responsavel:** Equipe de Desenvolvimento — Vectra Cargo

---

## 1. O que ja foi feito

### 1.1. Analise de documentacao
- [x] 6 PDFs oficiais Buonny analisados (Consulta Profissional, Consulta Veiculo Por Entrega, Informacoes Viagem, Status Da Entrega, Callback Retorno da Ficha, Criacao de Endpoint para Retorno de Ficha)
- [x] 2 PDFs adicionais analisados (API AXA / Integrador Nstech, SM ViV CSV)
- [x] Insight Skills de arquitetura multi-agente produzidos (4 documentos em `Insight Skills/`)

### 1.2. Documento de perguntas enviado
- [x] `docs/buonny-integration/perguntas-implantacao-buonny.md` — 13 secoes cobrindo todos os pontos tecnicos pendentes
- **Enviado em:** 2026-03-09 (corpo do e-mail para equipe de TI da Buonny)

### 1.3. Stub existente
- [x] `supabase/functions/buonny-check/index.ts` — stub v1 (retorna `aprovado` fixo, score 85)
- Persiste evidencia em `risk_evidence` quando `evaluation_id` fornecido
- Interface simplificada: `{ driver_cpf, vehicle_plate, order_id?, evaluation_id? }`

### 1.4. Infraestrutura de risco ja implantada
- [x] Tabelas: `risk_policies`, `risk_policy_rules`, `risk_services_catalog`, `risk_evaluations`, `risk_evidence`, `risk_costs`
- [x] Gate SQL: `risk_gate_validate_transition` (bloqueia transicao sem Buonny check valido)
- [x] Edge Function: `evaluate-risk/index.ts` (avalia criticidade por valor_carga/km)
- [x] UI: `RiskWorkflowWizard.tsx` (wizard 4 etapas)
- [x] Hooks: `useRiskEvaluation.ts`

---

## 2. O que esta bloqueado (aguardando Buonny)

### Prioridade ALTA — sem isso nao e possivel iniciar desenvolvimento real

| # | Item bloqueado | Secao no doc de perguntas | Impacto |
|---|---------------|--------------------------|---------|
| 1 | **Token + CNPJ de homologacao** | 1.1 | Sem credenciais, zero chamadas possiveis |
| 2 | **Tabela de codigos `carga_tipo`** | 2.1 | Campo obrigatorio na Consulta Profissional |
| 3 | **Tabela de codigos `status_pesquisa`** | 5.3 | Sem isso, nao sabemos interpretar o webhook |
| 4 | **Endpoint publico API AXA (homolog)** | 11.1 | IP interno (`10.19.0.45`) inacessivel do Supabase |
| 5 | **Token API AXA (Nstech)** | 11.2 | Pode ser credencial separada |
| 6 | **Codigos internos Integrador** (`cdcliente`, `cdtransp`, `cdcidorigem`, `cdprod`) | 11.3 | Sem mapeamento, nao ha como criar viagens |
| 7 | **Arquivo `Cidades.pdf`** | 11.3 | Codigos de cidade do Integrador |

### Prioridade MEDIA — desenvolvimento pode comecar sem, mas precisa antes de producao

| # | Item bloqueado | Secao no doc de perguntas |
|---|---------------|--------------------------|
| 8 | Confirmacao subdominios homolog (`tstportal` vs `tstapi`) | 1.2 |
| 9 | Diferenca pratica STANDARD vs PLUS (`produto`) | 2.2 |
| 10 | Definicao do campo `carreteiro` (autonomo vs tipo veiculo) | 2.3 |
| 11 | Formato `pais_origem`/`pais_destino` (IBGE? ISO 3166?) | 2.4 |
| 12 | IPs de origem do webhook Buonny (whitelist) | 6.1 |
| 13 | Rate limiting por API | 7.1 |
| 14 | SLA de resposta (sincrono + webhook) | 7.2 |
| 15 | Response format/error codes API AXA | 11.5 |

---

## 3. Proximos passos apos retorno da Buonny

### Fase 1 — Cliente SOAP + REST (1-2 semanas apos credenciais)

```
supabase/functions/_shared/
  buonny-soap-client.ts    ← novo: XML builder/parser, auth, circuit breaker
  buonny-rest-client.ts    ← novo: auth 2-step (login→Bearer), callback REST
  buonny-types.ts          ← novo: tipos compartilhados (status_pesquisa, carga_tipo, etc.)
```

**Tarefas:**
1. Implementar `buonny-soap-client.ts` com operacoes:
   - `consultaProfissional(payload)` — SOAP via `tstportal.buonny.com.br`
   - `consultaVeiculoPorEntrega(payload)` — SOAP via `tstportal.buonny.com.br`
   - `statusEntrega(payload)` — SOAP via `tstapi.buonny.com.br`
   - `informacoesViagem(payload)` — SOAP via `tstportal.buonny.com.br`
2. Implementar `buonny-rest-client.ts`:
   - `authenticateCallback()` — POST `/api/v3/auth/login`
   - `getRetornoFicha(filtros)` — GET com Bearer token temporario
3. Implementar `buonny-types.ts` com enums/mapas de status
4. Testes unitarios com mocks SOAP/REST

### Fase 2 — Substituir stub por cliente real (1 semana)

- Refatorar `buonny-check/index.ts`: trocar stub por chamada real via `buonny-soap-client`
- Expandir `BuonnyCheckRequest` para incluir campos obrigatorios reais (carga_tipo, produto, carreteiro, origem/destino)
- Mapear resposta real para `BuonnyCheckResponse` existente
- Manter fallback stub com feature flag `BUONNY_USE_STUB=true` para dev local

### Fase 3 — Callback handler + Webhook (1 semana)

```
supabase/functions/
  buonny-callback-handler/index.ts  ← novo: recebe webhook POST da Buonny
```

- Criar Edge Function para receber webhook da Buonny
- Validar autenticacao (Bearer token ou header customizado)
- Parsear payload JSON e publicar no Event Bus (`workflow_events`)
- Cadastrar endpoint no portal Buonny (homolog)

### Fase 4 — API AXA / Integrador (1-2 semanas)

```
supabase/functions/_shared/
  buonny-axa-client.ts     ← novo: REST client para Integrador Nstech
supabase/functions/
  buonny-create-trip/index.ts  ← novo: cria viagem/SM no Integrador
```

- Implementar cliente REST para API AXA
- Mapear dados internos (orders, drivers, vehicles) para codigos Integrador
- Criar Edge Function para criacao de viagens

### Fase 5 — Agente de risco + orquestracao (2 semanas)

- Criar `ai-risk-management-agent` Edge Function
- Integrar com `workflow-orchestrator` via Event Bus
- Implementar cookbooks: validacao pre-viagem, monitoramento em viagem
- Dashboard de monitoramento de risco

---

## 4. Protocolos e endpoints (referencia rapida)

| API | Protocolo | Homolog | Producao |
|-----|-----------|---------|----------|
| Consulta Profissional | SOAP | `tstportal.buonny.com.br` | `api.buonny.com.br` (confirmar) |
| Consulta Veiculo/Entrega | SOAP | `tstportal.buonny.com.br` | idem |
| Informacoes Viagem | SOAP | `tstportal.buonny.com.br` | idem |
| Status da Entrega | SOAP | `tstapi.buonny.com.br` | idem |
| Callback Retorno Ficha | REST | `tstapi.buonny.com.br` | idem |
| Webhook Retorno Ficha | JSON POST | Buonny → nosso endpoint | idem |
| API AXA (Integrador) | REST | `10.19.0.45:8580` (interno!) | ? |

---

## 5. Mapeamento de status Buonny → sistema interno

| Status Buonny | `risk_evidence.status` | `BuonnyCheckResponse.status` |
|---------------|----------------------|------------------------------|
| PERFIL ADEQUADO AO RISCO | `valid` | `aprovado` |
| PERFIL COM INSUFICIENCIA DE DADOS | `pending` | `em_analise` |
| PERFIL DIVERGENTE | `invalid` | `reprovado` |
| PERFIL EXPIRADO | `expired` | `expirado` |
| EM ANALISE | `pending` | `em_analise` |
| (erro de rede/timeout) | `error` | `erro` |

---

## 6. Arquivos relacionados

| Arquivo | Descricao |
|---------|-----------|
| `docs/buonny-integration/perguntas-implantacao-buonny.md` | Documento de perguntas enviado a Buonny |
| `docs/buonny-integration/CONTEXT.md` | Este arquivo |
| `supabase/functions/buonny-check/index.ts` | Stub v1 atual |
| `supabase/functions/evaluate-risk/index.ts` | Avaliacao de criticidade |
| `supabase/functions/workflow-orchestrator/index.ts` | Orquestrador de eventos |
| `src/components/risk/RiskWorkflowWizard.tsx` | UI wizard de risco |
| `src/hooks/useRiskEvaluation.ts` | Hooks React para risco |
| `Insight Skills/Integracao da API Buonny*.md` | Arquitetura multi-agente |
| `Insight Skills/Implementacao Tecnica*.md` | Implementacao tecnica |
| `Insight Skills/Proximos Passos*.md` | Roadmap |
| `Insight Skills/Governanca*.md` | Governanca e squads |
