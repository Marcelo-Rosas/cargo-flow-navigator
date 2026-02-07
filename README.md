# Cargo Flow Navigator

CRM logistico da **Vectra Cargo** para gestao de cotacoes, ordens de servico e precificacao de frete.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui |
| Estado | TanStack React Query + React Context |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| Edge Functions | Deno |

## Setup Local

### Pre-requisitos

- Node.js 22+ (recomendado via [nvm](https://github.com/nvm-sh/nvm))
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) (opcional, para backend local)

### Instalacao

```bash
git clone https://github.com/Marcelo-Rosas/cargo-flow-navigator.git
cd cargo-flow-navigator
cp .env.example .env   # preencha com suas chaves do Supabase
npm install
npm run dev            # http://localhost:8080
```

### Variaveis de Ambiente

Veja `.env.example` para as variaveis necessarias:

| Variavel | Descricao |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key (publica) |
| `VITE_SUPABASE_PROJECT_ID` | ID do projeto |

### Supabase Local (opcional)

```bash
supabase start          # inicia containers locais
supabase db reset       # aplica migrations + seed data
supabase functions serve # roda Edge Functions localmente
```

## Scripts

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (porta 8080) |
| `npm run build` | Build de producao |
| `npm run lint` | ESLint |
| `npm run test` | Testes com Vitest (watch mode) |
| `npm run test:run` | Testes (single run) |
| `npm run format` | Formata codigo com Prettier |
| `npm run format:check` | Verifica formatacao |

## Estrutura do Projeto

```
src/
  pages/           # Paginas da aplicacao (Dashboard, Commercial, etc.)
  components/
    ui/            # Componentes shadcn/ui
    layout/        # MainLayout, Sidebar, Topbar
    dashboard/     # Widgets do dashboard
    boards/        # Kanban (cotacoes e ordens)
    forms/         # Formularios (Quote, Order, Client, Occurrence)
    modals/        # Modais de detalhe e conversao
    pricing/       # Gestao de tabelas de preco
    documents/     # Upload e listagem de documentos
    auth/          # ProtectedRoute
  hooks/           # Custom hooks (dados, auth, realtime)
  types/           # Tipos TypeScript do dominio
  lib/             # Utilitarios
  integrations/    # Cliente e tipos do Supabase
supabase/
  migrations/      # Schema SQL (5 migracoes)
  functions/       # Edge Functions (calculate-freight, import-price-table)
```

## Rotas

| Rota | Pagina | Protegida |
|------|--------|-----------|
| `/auth` | Login / Cadastro | Nao |
| `/` | Dashboard | Sim |
| `/comercial` | Kanban de Cotacoes | Sim |
| `/operacional` | Kanban de Ordens de Servico | Sim |
| `/documentos` | Gestao de Documentos | Sim |
| `/clientes` | Cadastro de Clientes | Sim |
| `/tabelas-preco` | Tabelas de Preco + Simulador | Sim |

## Edge Functions

### `calculate-freight`
Calcula frete completo com breakdown (peso cubado, GRIS, ad valorem, pedagio, TAC, ICMS, estadia, taxas condicionais, prazo de pagamento).

### `import-price-table`
Importa tabelas de preco via upload de planilha (CSV/XLSX), com deduplicacao e validacao.

## Contribuindo

1. Crie uma branch a partir de `main`
2. Faca suas alteracoes
3. Garanta que `npm run lint`, `npm run test:run` e `npm run build` passam
4. Abra um Pull Request
