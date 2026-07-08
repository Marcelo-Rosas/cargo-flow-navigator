# PRD — Integração Infosimples (camada de consulta / compliance)

> **Status**: pronto para execução. **Bloqueio**: aguardando despause do Supabase (`epgedaiukjippepujuzc`, INACTIVE por billing).
> **Não altera emissão fiscal** — Focus NFe permanece para CT-e/MDF-e. Infosimples é camada de **consulta/validação/compliance**.
> Relacionado: `project_pending_averbacoes_migration` (mesma fila de despause).

---

## 1. Contexto e problema

O TMS tem hoje dados de compliance **fragmentados e parcialmente manuais**:

- IE via SintegrAPI (`_shared/ie-lookup.ts`, edge `lookup-ie`).
- RNTRC via edge `antt-rntrc-check` (+ `drivers.antt`).
- CNPJ via BrasilAPI (`cnpj_lookup` / `cnpj_contato_cache`).
- Piso ANTT seedado à mão (`antt_floor_rates` + scripts SUROC).
- Qualificação de motorista (`driver_qualifications`) e risco (`compliance_checks`, `risk_evaluations`, `risk_evidence`) **sem fonte oficial automatizada** de certidões/CNH.

**Lacuna real** = compliance oficial auditável: certidões negativas (SEFAZ/PGFN/prefeitura), validação de CNH/RENACH e RNTRC, com **comprovante oficial** anexável.

## 2. Objetivo

Adicionar uma **camada única de consultas oficiais** (Infosimples) para preencher a lacuna de compliance, com **comprovante persistido** (`site_receipt`) como evidência, **sem** virar gate bloqueante e com **custo controlado** (cache-first).

### Métricas de sucesso
- 100% das consultas de compliance com `site_receipt` persistido no storage (não URL temporária).
- Cache-hit ≥ 70% (não repetir consulta paga dentro da validade).
- Zero travamento de emissão/cotação por indisponibilidade da fonte (degrada, não bloqueia).

## 3. Não-objetivos (escopo fora)
- **Não** substituir Focus (emissão CT-e/MDF-e).
- **Não** substituir piso ANTT (`antt_floor_rates` seed manual é determinístico e grátis).
- **Não** substituir CNPJ BrasilAPI (grátis) na Fase 1.
- IE/SINTEGRA: substituição de SintegrAPI é **opcional** (Fase 3, só se ganho comprovado).

## 4. Contrato Infosimples (referência)

**Sync**: `POST https://api.infosimples.com/api/v2/consultas/{servico}`
- Body form: `token*`, `timeout` (15–600s), `ignore_site_receipt`, + params do serviço.
- Resposta JSON: `code`, `code_message`, `data[]` (sempre array), `data_count`, `errors[]`, `site_receipts[]` (URLs válidas 7 dias), `header` (`billable`, `price`, `service`, `signature`, `elapsed_time_in_milliseconds`, ...).
- Códigos: `200` sucesso (cobra) · `605` timeout (não cobra) · `606/607` params · `610` captcha · `620` erro definitivo da fonte (cobra).

**Async**: `POST https://api.infosimples.com/api-async/v2/{servico}`
- Params do serviço + `token`, `callback_url`, `callback_secret` (implícito no retorno), `time_limit`, `timeout` (mín. 600s), `context`.
- Retorna `request_id` (UUID), `status: pending`. Com `callback_url` → Infosimples faz **GET no nosso servidor** com `request_id` + `callback_secret` ao finalizar (push). Sem callback → poll `GET /api-async/v2/show?token=&request_id=` (~30s).
- Status: `pending` | `finished` | `error` (erro não cobra). Pedido guardado 7 dias. **Criação/poll não cobram**; cobra só a consulta processada.

### Serviços-alvo
| Serviço | Params | Preço | Modo |
|---|---|---|---|
| `antt/transportador` | `token*`, um de `cpf`/`cnpj`/`rntrc` → `situacao`, `validade_data`, `apto_transporte_remunerado` | R$ 0,04 | **sync** |
| `receita-federal/pgfn` | `token*`, `cnpj`\|`cpf`(+`birthdate`), `preferencia_emissao` | R$ 0,06 | **async** |
| `sefaz/certidao-debitos` | `token*`, `uf*`, `cnpj`/`cpf`/`ie` (MG/SC pedem GOV.BR/PKCS12; MG pede `cep`) | variável/UF | **async** |
| `senatran/validar-cnh` | `token*`, `cpf*`, `registro*`, `codigo_seguranca*` (limite 5/dia/login) | R$ 0,06 | **async** |
| `sintegra/{uf}` | `token*`, `cnpj`\|`ie` | R$ 0,04 | sync (Fase 3) |

## 5. Arquitetura

```
[UI: RiskWizard / DriverQualification / Client detail]
        │ invokeEdgeFunction
        ▼
[edge: infosimples-consulta]  ──sync──►  POST /api/v2/consultas/{servico}  ──► grava infosimples_consultas + baixa site_receipt
        │
        └──async──► POST /api-async/v2/{servico} (callback_url = infosimples-callback)
                         │ status=pending → grava row pending
                         ▼
[edge: infosimples-callback] ◄── GET (request_id + callback_secret) ── Infosimples
        │ valida secret → GET /api-async/v2/show → grava data + baixa site_receipt → status=finished
        ▼
[risk_evidence + documents (site_receipt persistido)]
```

Reuso: async+webhook espelha `focus-webhook`; cache espelha `cnpj_contato_cache`; secrets edge = padrão Focus.

## 6. Modelo de dados

### Migration `YYYYMMDD000000_infosimples_consultas.sql`
```sql
CREATE TYPE public.infosimples_mode AS ENUM ('sync','async');
CREATE TYPE public.infosimples_status AS ENUM ('pending','finished','error');

CREATE TABLE public.infosimples_consultas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servico TEXT NOT NULL,                 -- 'antt/transportador', 'sefaz/certidao-debitos'...
  mode public.infosimples_mode NOT NULL,
  subject_type TEXT,                     -- 'driver'|'client'|'shipper'|'vehicle'|'owner'
  subject_id UUID,
  params_hash TEXT NOT NULL,             -- hash sha256 dos params de entrada (cache/idempotência)
  request_id UUID,                       -- async (Infosimples)
  status public.infosimples_status NOT NULL DEFAULT 'pending',
  code INT,
  code_message TEXT,
  billable BOOLEAN,
  price NUMERIC(10,4),
  data JSONB,                            -- data[] cru
  site_receipt_path TEXT,               -- baixado p/ bucket documents (não a URL temporária)
  expires_at TIMESTAMPTZ,               -- TTL por serviço (validade_data / validade certidão)
  raw_response JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cache hit: consulta válida e finalizada
CREATE UNIQUE INDEX uq_infosimples_cache
  ON public.infosimples_consultas (servico, params_hash)
  WHERE status = 'finished' AND expires_at > now();

CREATE INDEX idx_infosimples_subject ON public.infosimples_consultas(subject_type, subject_id);
CREATE INDEX idx_infosimples_request ON public.infosimples_consultas(request_id);
CREATE INDEX idx_infosimples_status ON public.infosimples_consultas(status);
CREATE INDEX idx_infosimples_created ON public.infosimples_consultas(created_at DESC);

-- trigger updated_at (public.update_updated_at_column)
-- RLS: espelha cte_emissions (select admin/financeiro/operacional/comercial; manage admin/financeiro)
```
> Timestamp da migration DEVE ser > topo remoto no momento do despause (checar `supabase/migrations/` — hoje topo é `20260802000000_averbacoes_schema.sql`).

## 7. Edge Functions

### `infosimples-consulta` (entrypoint)
- Input: `{ servico, mode, subject_type, subject_id, params }`.
- **Cache-first**: calcula `params_hash`; se existe row `finished` com `expires_at > now()` → retorna cache (não chama Infosimples).
- `mode='sync'`: POST `/api/v2/consultas/{servico}` (form, `token` do secret, `timeout` ≤ 120s p/ caber no edge). Grava row, baixa `site_receipts[0]` → storage, seta `expires_at` de `data[].validade_data`/validade.
- `mode='async'`: POST `/api-async/v2/{servico}` com `callback_url` (URL pública da `infosimples-callback`). Grava row `pending` com `request_id`.
- Nunca lança erro bloqueante: `605`/timeout/fonte-fora → retorna `{ ok:false, degraded:true }`.

### `infosimples-callback` (webhook async)
- Recebe GET com `request_id` + `callback_secret`. **Valida `callback_secret`** contra `INFOSIMPLES_CALLBACK_SECRET`.
- `GET /api-async/v2/show?token=&request_id=` → pega `data`+`site_receipts`. Baixa receipt → storage. Atualiza row → `finished`/`error`, `price`, `code`, `expires_at`.
- Idempotente por `request_id`.

### Secrets (Supabase → Edge Functions)
- `INFOSIMPLES_TOKEN`
- `INFOSIMPLES_CALLBACK_SECRET`
- `INFOSIMPLES_BASE_URL` (default `https://api.infosimples.com`)

## 8. Guardrails
- **Cache-first** sempre; TTL guiado pela validade da própria resposta.
- **Degrada, nunca bloqueia** emissão/cotação/OS.
- CNH: contador **≤ 5 consultas/dia/login** (limite da fonte).
- `620` (cobra) → registrar p/ não repetir à toa.
- `site_receipt` **sempre baixado** p/ storage (URL expira em 7 dias).
- Sem PII em log; secrets só na edge.

## 9. Fases

| Fase | Entrega | Consultas |
|---|---|---|
| **1** | Scaffold + RNTRC sync + compliance async | `antt/transportador`, `receita-federal/pgfn`, `sefaz/certidao-debitos` |
| **2** | CNH + UI evidência | `senatran/validar-cnh` + anexo em `risk_evidence`/`documents` |
| **3** | (Opcional) migrar IE | `sintegra/{uf}` substitui SintegrAPI se ganho comprovado |

## 10. Passo a passo de execução (rodar no despause)

**Pré-condição**: Supabase restaurado (`get_project` → `ACTIVE_HEALTHY`). Resolver `averbacoes` pendente primeiro (ou junto).

1. **Secrets**: cadastrar `INFOSIMPLES_TOKEN`, `INFOSIMPLES_CALLBACK_SECRET`, `INFOSIMPLES_BASE_URL` em Supabase → Edge Functions.
2. **Branch**: `git checkout -b feat/infosimples-compliance origin/main`.
3. **Migration**: criar `supabase/migrations/<ts > topo>_infosimples_consultas.sql` (seção 6). Ajustar timestamp > topo remoto.
4. **Shared**: `_shared/infosimples-client.ts` (POST form, parse resposta, download receipt) + `_shared/infosimples-cache.ts` (params_hash + cache lookup).
5. **Edge `infosimples-consulta`** (seção 7). Registrar em `detect-changes` (deploy por função já é automático via workflow).
6. **Edge `infosimples-callback`** (webhook async). **Sem JWT** (Infosimples chama externo) → validar por `callback_secret`. Config `verify_jwt=false` na função.
7. **Storage**: garantir bucket `documents` aceita `type` novo p/ receipt (ou reuso de `outros`).
8. **Client**: `src/lib/edgeFunctions.ts` → wrapper `consultaInfosimples()`. Hook `useInfosimplesConsulta`.
9. **UI Fase 1**: botão "Validar RNTRC" no `DriverQualificationPanel` / RiskWizard; "Certidões" no detalhe de cliente/shipper.
10. **CI**: PR → `check`, `check-freight-types`, `supabase-migrate-check` verdes.
11. **Merge**: dispara `db push` (migration) + `functions deploy` (edges).
12. **Registrar `callback_url`** real (URL pública da `infosimples-callback`) nos params async.
13. **Smoke**: 1 RNTRC sync (cache miss→hit) + 1 certidão async (callback grava `finished` + receipt no storage).

## 11. Critérios de aceite
- [ ] RNTRC sync retorna `situacao`/`validade_data` e grava cache; 2ª chamada = cache-hit (sem cobrança).
- [ ] Certidão async: `pending` → callback → `finished` com `site_receipt_path` no storage.
- [ ] `605`/fonte-fora não quebra o fluxo chamador.
- [ ] `callback_secret` inválido → 401 no webhook.
- [ ] RLS: perfis não autorizados não leem `infosimples_consultas`.

## 12. Rollback
- Feature isolada; sem alterar emissão. Reverter = desabilitar botões UI + parar de chamar as edges. Tabela/edges podem ficar (inertes). Sem risco a CT-e/MDF-e/Focus.

## 13. Perguntas em aberto
- SINTEGRA "Unificada" (endpoint único) vs por-UF — pegar params se for pra Fase 3.
- Prefeituras: só sob demanda (endpoint por município; SC/Navegantes/Itajaí a mapear).
- MG/SC certidão exigem GOV.BR/PKCS12 — definir se entra na Fase 1 ou depois (requer credencial extra).
- Custo-teto mensal: definir alerta de gasto (somar `price` do header).
```
