# Cargo Flow Navigator

CRM logístico da **Vectra Cargo** para gestão de cotações, pedidos, clientes, embarcadores e documentos, com cálculo de frete integrado (tabelas de preço, GRIS, TSO, TAC, NTC) e painel comercial/operacional.

## Stack tecnológica

- **Frontend**: React 18, TypeScript, Vite 7, Tailwind CSS, shadcn/ui (Radix), TanStack Query, Framer Motion, Recharts
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Edge Functions)
- **Deploy**: Vercel (frontend), Supabase Cloud (backend)

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
| `npm run preview`   | Preview do build local                  |
| `npm run lint`      | ESLint                                  |

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
    └── api.md         # Documentação das Edge Functions
```

## Documentação da API

As Edge Functions estão documentadas em [docs/api.md](docs/api.md):

- `calculate-freight` — Cálculo de frete (peso, volume, tabela de preço, GRIS, TSO, TAC, NTC)
- `lookup-cep` — Consulta de CEP (ViaCEP, BrasilAPI, OpenCEP)
- `import-price-table` — Importação de tabelas de preço (Excel/CSV)

## Deploy

- **Frontend**: conecte o repositório à Vercel e configure as variáveis de ambiente (`VITE_SUPABASE_*`).
- **Backend**: Supabase Cloud; migrations via `supabase db push`.
- **Edge Functions**: em produção, configure `ALLOWED_ORIGIN` (ou `ALLOWED_ORIGINS` para múltiplos) no Supabase Dashboard (Edge Functions → Secrets) com o domínio do app.
- **CI (GitHub Actions)**: para validar migrations no CI, configure o secret `SUPABASE_DB_URL` com o **Session pooler** (Supabase Dashboard → Connect → Session mode, porta 5432). Use o pooler para compatibilidade IPv4 no GitHub Actions.

## Contribuição

Consulte [CONTRIBUTING.md](CONTRIBUTING.md) para padrões de código e fluxo de contribuição.
