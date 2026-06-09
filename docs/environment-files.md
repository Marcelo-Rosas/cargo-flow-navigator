# Arquivos de Ambiente — Cargo Flow Navigator

*Documento gerado durante o cleanup de `.env` em 2026-05-27.*

## Mapa atual

| Arquivo | Ferramenta que lê | O que contém | Commitado? |
|---------|-------------------|--------------|------------|
| `.env` | Vite (automático), Playwright (`dotenv` manual) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_SERVICE_ROLE_KEY` | ❌ |
| `.env.local` | Vite (automático em dev), scripts Cloudflare | Postgres, Vercel OIDC, Cloudflare, Supabase | ❌ |
| `.env.e2e` | Playwright (`playwright.config.ts`) | Credenciais de teste (`PW_TEST_USER`, `PW_TEST_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`) | ❌ |
| `.env.e2e.example` | — | Template limpo para criar `.env.e2e` | ✅ |
| `supabase/.env.local` | Supabase CLI local | `OPENAI_API_KEY`, `OPENAI_MODEL` | ❌ |
| `supabase/functions/.env.local.functions.txt` | Supabase Edge Functions (runtime) | `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | ❌ |
| `mcp-debugger/.env.example` | Subprojeto MCP debugger | Configuração isolada do debugger | ✅ |

## O que foi removido

- ❌ `.env.production` — duplicava 100% das chaves de `.env.local`. Vite e Cloudflare Pages não precisavam dele.
- ❌ `supabase/.env.local.functions.txt` — arquivo órfão; o Supabase Edge Functions usam `supabase/functions/.env.local.functions.txt`.
- ❌ `.docker/.env` — não era referenciado pelo `docker-compose.yml` (valores eram hardcoded).
- ❌ `.docker/.env.exemple.txt` — nome com typo (`exemple`) e extensão dupla `.txt`.
- ❌ `.docker/docker-compose.yml` + `.docker/.env.example` — stack **Evolution API** (não usado; WhatsApp é **Meta** via `notification-hub` → OpenClaw). Ver [`.docker/README.md`](../.docker/README.md).

## WhatsApp (Meta, não Evolution)

- **Produção/dev:** `notification-hub` (Supabase Edge Function) → OpenClaw / Meta.
- **Não** configurar Evolution API nem `.docker/` para mensagens.

## Prioridade de carregamento (Vite)

O Vite carrega arquivos `.env` na seguinte ordem (quem vem por último sobrescreve):

1. `.env`
2. `.env.local`
3. `.env.[mode]` (ex: `.env.production` durante `vite build`)
4. `.env.[mode].local`

Por isso **`.env.local` sempre vence `.env`** em desenvolvimento. Mantenha em `.env` apenas valores não-secretos e compartilhados.

## Divergências conhecidas

### OpenAI API Key

Existem **dois valores diferentes** de `OPENAI_API_KEY`:

- `supabase/.env.local` → usado pelo Supabase CLI local
- `supabase/functions/.env.local.functions.txt` → usado pelo runtime das Edge Functions

Se a key foi rotacionada, atualize **ambos** manualmente. Não há sincronização automática entre esses arquivos.

### Gemini (Google AI)

| Onde | Variável | Quem lê |
|------|----------|---------|
| `supabase/.env.local` | `GOOGLE_API_KEY` | Supabase CLI local, `scripts/ping-gemini.mjs` |
| Supabase Dashboard → Secrets | `GEMINI_API_KEY` | Edge Functions em produção (`_shared/gemini.ts`) |

**Produção:** o secret deve ser `GEMINI_API_KEY` com o **mesmo valor** de `GOOGLE_API_KEY` do `.env.local` (Primary). Sincronizar:

```powershell
.\scripts\sync-gemini-secret.ps1
```

## Checklist de setup para novo desenvolvedor

```bash
# 1. Frontend
cp .env.example .env
# Edite .env com VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY

# 2. E2E (opcional)
cp .env.e2e.example .env.e2e
# Edite .env.e2e com credenciais de teste

# 3. Supabase Edge Functions (opcional)
# supabase/functions/.env.local.functions.txt já deve existir no repo local
# ou será criado pelo Supabase CLI
```
