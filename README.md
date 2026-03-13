# Cargo Flow Navigator

CRM logístico da **Vectra Cargo** para gestão de cotações, pedidos, clientes, embarcadores e documentos, com cálculo de frete integrado (tabelas de preço, GRIS, TSO, TAC, NTC) e painel comercial/operacional.

## Stack tecnológica

- **Frontend**: React 18, TypeScript, Vite 7, Tailwind CSS, shadcn/ui (Radix), TanStack Query, Framer Motion, Recharts
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Edge Functions)
- **Deploy**: Cloudflare Pages (frontend), Supabase Cloud (backend)

## Pré-requisitos

- **Node.js 22+** — [nvm](https://github.com/nvm-sh/nvm) ou [nodejs.org](https://nodejs.org)
- **Supabase CLI** — `npm i -g supabase` ou [docs](https://supabase.com/docs/guides/cli)
- **Git**

## Setup local

### 1. Clonar o repositório

```bash
git clone https://github.com/Marcelo-Rosas/cargo-flow-navigator.git
cd cargo-flow-navigator
```

### 2. Variáveis de ambiente

Crie `.env` na raiz do projeto (use `.env.example` como referência):

```bash
cp .env.example .env
```

Edite `.env` e preencha com as credenciais do Supabase:

- `VITE_SUPABASE_URL` — URL do projeto (ex: `https://xxx.supabase.co`)
- `VITE_SUPABASE_PUBLISHABLE_KEY` — chave anon/public

> As credenciais estão no painel Supabase em **Settings > API**.

### 3. Supabase local (opcional)

Para rodar o backend localmente:

```bash
supabase start
```

Copie o output (`API URL`, `anon key`) para `.env` local. Migrations são aplicadas automaticamente pelo `supabase start`.

Para aplicar migrations em um projeto remoto:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

### 4. Dependências e dev server

```bash
npm install
npm run dev
```

Acesse `http://localhost:5173`.

## Scripts disponíveis

| Comando         | Descrição                                  |
|-----------------|--------------------------------------------|
| `npm run dev`   | Inicia servidor de desenvolvimento (Vite)  |
| `npm run build` | Build de produção                          |
| `npm run build:dev` | Build em modo development              |
| `npm run preview`   | Preview do build local (Wrangler)       |
| `npm run preview:static` | Preview estático na porta 4173 (para E2E local) |
| `npm run lint`      | ESLint                                  |
| `npm run test:e2e:auth` | Playwright com autenticação         |
| `npm run test:e2e:mocks` | Specs determinísticas com mocks    |

## Estrutura de pastas (resumida)

```
├── src/
│   ├── components/     # Componentes React (auth, dashboard, boards, modals...)
│   ├── hooks/         # Hooks customizados (useAuth, useCalculateFreight...)
│   ├── integrations/  # Cliente Supabase e tipos
│   ├── lib/           # Utilitários (utils, priceTableParser)
│   ├── pages/         # Páginas da aplicação
│   └── types/         # Tipos compartilhados (freight, pricing)
├── supabase/
│   ├── functions/     # Edge Functions (calculate-freight, lookup-cep, import-price-table)
│   ├── migrations/    # Migrations SQL
│   └── config.toml    # Configuração do projeto
├── .env.example       # Template de variáveis de ambiente
└── docs/
    ├── api.md         # Edge Functions
    ├── edge-functions-auth.md
    ├── ai-models-config.md
    ├── cursor-prompts-cookbook.md  # Prompts do Cursor
    └── referencia/    # Planos, análises e guias (não executados)
```

## Documentação

- **[docs/api.md](docs/api.md)** — Edge Functions (`calculate-freight`, `lookup-cep`, `import-price-table`, etc.)
- **[docs/edge-functions-auth.md](docs/edge-functions-auth.md)** — Autenticação e autorização nas Edge Functions
- **[docs/ai-models-config.md](docs/ai-models-config.md)** — Configuração de modelos de IA e monitoramento de custos
- **[docs/cursor-prompts-cookbook.md](docs/cursor-prompts-cookbook.md)** — Livro de receitas: prompts do Cursor (@enhance-code, @manage-prompts, @ai-system-prompts, @workflow, etc.)

## Deploy

- **Frontend**: `npm run deploy` (Cloudflare Pages via Wrangler). Configure as variáveis de ambiente no Cloudflare Pages (`VITE_SUPABASE_*`).
- **Backend**: Supabase Cloud; migrations via `supabase db push`.
- **Edge Functions**: em produção, configure `ALLOWED_ORIGIN` (ou `ALLOWED_ORIGINS` para múltiplos) no Supabase Dashboard (Edge Functions → Secrets) com o domínio do app (ex.: `https://app.vectracargo.com.br`).
- **CI (GitHub Actions)**: para validar migrations no CI, configure o secret `SUPABASE_DB_URL` com o **Session pooler** (Supabase Dashboard → Connect → Session mode, porta 5432). Use o pooler para compatibilidade IPv4 no GitHub Actions.

## Contribuição

Consulte [CONTRIBUTING.md](CONTRIBUTING.md) para padrões de código e fluxo de contribuição.

## Testes Playwright

- ### Testes com autenticação (storageState)
  1. Copie `.env.example` para `.env`:
     ```bash
     cp .env.example .env
     ```
  2. Defina `PW_TEST_USER` e `PW_TEST_PASSWORD` (credenciais reais).
  3. Gere o storage state:
     ```bash
     npx playwright test --project=setup
     ```
  4. Rode as specs que exigem autenticação:
     ```bash
     npx playwright test --project=chromium-auth
     ```
  > **Windows/PowerShell:** use flags com `--project=chromium-auth` (nunca `\--project\=...`).

- ### Testes determinísticos (mocks)
  ```bash
  npx playwright test tests/e2e/quote-wizard-gating.spec.ts --project=chromium-mocks
  npx playwright test tests/e2e/quote-advance-race.spec.ts --project=chromium-mocks
  ```

  Esses comandos usam mocks determinísticos e não dependem do `setup/auth`. Utilize `npm run test:e2e:mocks` para executar ambos de uma vez.

- ### Testes contra build local (não produção)
  Por padrão, os testes E2E usam `baseURL` = produção. Para validar o build local:

  1. Em um terminal: `npm run build && npm run preview:static`
  2. Em outro: `npm run test:e2e:local` (toda a suíte) ou `npm run test:e2e:paradas` (específico do round 1 / paradas)

  Útil para validar features novas antes do deploy.
