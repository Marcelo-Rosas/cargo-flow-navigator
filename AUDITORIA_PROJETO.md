# Auditoria de Estrutura e Melhores Práticas — Cargo Flow Navigator

> **Data**: 2026-02-07
> **Revisor**: Staff Engineer (auditoria automatizada)
> **Repositório**: cargo-flow-navigator
> **Origem**: Projeto gerado pela plataforma Lovable.dev

---

## 1. Visão Geral

### Stack

| Camada | Tecnologia |
|--------|-----------|
| **Framework** | React 18.3 + TypeScript 5.8 |
| **Build** | Vite 5.4 (SWC) |
| **Estilos** | Tailwind CSS 3.4 + shadcn/ui (Radix primitives) |
| **Estado do servidor** | TanStack React Query 5.83 |
| **Estado local** | React Context (auth) |
| **Roteamento** | React Router 6.30 |
| **Formulários** | React Hook Form 7.61 + Zod 3.25 |
| **Drag & Drop** | @dnd-kit |
| **Gráficos** | Recharts 2.15 |
| **Animações** | Framer Motion 12.25 |
| **Backend** | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| **Edge Functions** | Deno (calculate-freight, import-price-table) |
| **Importação Excel** | xlsx 0.18.5 |

### Arquitetura Percebida

CRM logístico SPA (Single Page Application) com backend serverless via Supabase. Padrão "hooks como camada de dados": cada entidade tem um hook dedicado que encapsula queries e mutations. Sem camada BFF — o frontend se comunica diretamente com Supabase (REST/Realtime) e Edge Functions.

### Pontos Fortes

- **Schema SQL bem estruturado**: RLS (Row Level Security) por role, triggers de `updated_at`, geração automática de OS number, índices em colunas de busca. Modelo de permissões granular (admin/comercial/operacao/fiscal/leitura).
- **Hooks coesos**: Cada entidade tem seu hook (useQuotes, useOrders, useClients, etc.) com padrão consistente de React Query.
- **Tipos bem definidos**: `src/types/index.ts` e `src/types/pricing.ts` cobrem os domínios principais com enums e interfaces.
- **Edge Functions robustas**: `calculate-freight` implementa lógica complexa de cálculo com fallbacks documentados e validação de entrada.
- **Separação de componentes por domínio**: `boards/`, `dashboard/`, `pricing/`, `forms/`, `modals/`, `documents/`, `auth/`, `layout/`.

---

## 2. Mapa Resumido da Estrutura

```
cargo-flow-navigator/
├── src/
│   ├── main.tsx                 # Bootstrap React
│   ├── App.tsx                  # Providers + rotas (7 rotas protegidas)
│   ├── index.css                # Tailwind + CSS variables
│   ├── pages/                   # 8 páginas (Dashboard, Commercial, Operations, etc.)
│   ├── components/
│   │   ├── ui/                  # 45+ componentes shadcn/ui (gerados)
│   │   ├── layout/              # MainLayout, Sidebar, Topbar, GlobalSearch
│   │   ├── dashboard/           # 8 widgets (KPI, charts, alerts, export)
│   │   ├── boards/              # Kanban (KanbanColumn, OrderCard, QuoteCard)
│   │   ├── forms/               # 4 formulários (Quote, Order, Client, Occurrence)
│   │   ├── modals/              # 3 modais (ConvertQuote, QuoteDetail, OrderDetail)
│   │   ├── pricing/             # 10 componentes de precificação
│   │   ├── documents/           # DocumentList, DocumentUpload
│   │   └── auth/                # ProtectedRoute
│   ├── hooks/                   # 21 hooks (dados, auth, realtime, utils)
│   ├── integrations/supabase/   # Client + tipos auto-gerados
│   ├── types/                   # Tipos do domínio (index.ts, pricing.ts)
│   ├── lib/                     # utils.ts, priceTableParser.ts
│   └── data/                    # mockData.ts
├── supabase/
│   ├── config.toml              # Configuração do projeto
│   ├── migrations/              # 5 migrações SQL (schema completo)
│   └── functions/               # 2 Edge Functions (Deno)
├── public/                      # favicon, placeholder, robots.txt
├── .env                         # ⚠ Credenciais Supabase commitadas
└── [configs]                    # vite, tailwind, tsconfig, eslint, postcss, etc.
```

---

## 3. Achados por Categoria

### 3.1 Estrutura

| # | Achado | Severidade |
|---|--------|-----------|
| E1 | **Arquivo `.env` com credenciais commitado no Git** — contém `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PROJECT_ID`. Embora a anon key seja "pública" por design do Supabase, o `.env` não está no `.gitignore`, o que viola a prática padrão e pode conter keys mais sensíveis no futuro. | CRÍTICO |
| E2 | **TypeScript com `strict: false`** e `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false`, `noUnusedParameters: false`. Essencialmente desabilita todas as verificações de tipo que previnem bugs em runtime. | ALTO |
| E3 | **Duplicação do hook `use-toast`**: existe em `src/hooks/use-toast.ts` (implementação real) e `src/components/ui/use-toast.ts` (re-export). Padrão confuso do shadcn. | BAIXO |
| E4 | **Duplicação de tipos**: interfaces `CalculateFreightInput`, `FreightBreakdown`, `ParametersUsed` e `CalculateFreightResponse` são duplicadas entre `src/types/pricing.ts` e `supabase/functions/calculate-freight/index.ts`. | MÉDIO |
| E5 | **`mockData.ts` presente em produção**: 288 linhas de dados mock que não são usados quando o Supabase está conectado, mas poluem o bundle. | BAIXO |
| E6 | **Componente Dashboard.tsx muito grande** (471 linhas): contém lógica de formatação, componentes de gráficos inline e markup extenso. Deveria ser decomposto. | MÉDIO |
| E7 | **Nome do package é genérico**: `"name": "vite_react_shadcn_ts"` — não reflete o projeto. | BAIXO |
| E8 | **`index.html` com metadados de template**: título "Lovable App", OG tags apontando para lovable.dev. | BAIXO |

### 3.2 Qualidade

| # | Achado | Severidade |
|---|--------|-----------|
| Q1 | **Zero testes**: nenhum arquivo `*.test.*` ou `*.spec.*` encontrado. Nenhuma dependência de test runner (vitest, jest) no `package.json`. | CRÍTICO |
| Q2 | **ESLint desabilita `no-unused-vars`**: `"@typescript-eslint/no-unused-vars": "off"`. Variáveis mortas permanecem no código sem alerta. | MÉDIO |
| Q3 | **Sem Prettier/formatador** configurado: nenhum `.prettierrc`, `.editorconfig`, ou config de formatação. Depende apenas do editor de cada dev. | MÉDIO |
| Q4 | **Console.log mínimo no frontend** (3 ocorrências), mas as Edge Functions logam input completo (`console.log('[calculate-freight] Input:', JSON.stringify(input))`), que pode vazar dados sensíveis em produção. | MÉDIO |
| Q5 | **Trends hardcoded no Dashboard**: `KPICard` recebe `trend={{ value: 12, isPositive: true }}` como valor fixo, não calculado. KPIs de trend são enganosos. | MÉDIO |
| Q6 | **Nenhuma validação de tipo em runtime no boundary da API** (Edge Functions). O `req.json()` é castado diretamente para a interface sem validação com Zod ou similar. Um payload malformado poderia causar erros inesperados. | MÉDIO |

### 3.3 Segurança

| # | Achado | Severidade |
|---|--------|-----------|
| S1 | **`.env` commitado no repositório** (ver E1). | CRÍTICO |
| S2 | **CORS `Access-Control-Allow-Origin: '*'`** nas Edge Functions: permite chamadas de qualquer domínio. Em produção, deveria ser restrito ao domínio do frontend. | ALTO |
| S3 | **`verify_jwt = false`** em `supabase/config.toml` para ambas as Edge Functions. A `calculate-freight` usa `SUPABASE_SERVICE_ROLE_KEY` (key admin) diretamente, bypassando RLS. A `import-price-table` valida auth manualmente mas JWT não é verificado pela infra. | ALTO |
| S4 | **Sem rate limiting** nas Edge Functions. Qualquer pessoa pode invocar `calculate-freight` ilimitadamente. | MÉDIO |
| S5 | **Front-end não verifica roles** para exibição de rotas — `ProtectedRoute` apenas verifica se o usuário está logado (`!user`), mas não confere se o role permite acesso àquela rota. A proteção por role existe apenas no backend (RLS). | MÉDIO |
| S6 | **Dependência `xlsx` (SheetJS)**: a versão 0.18.5 é a Community Edition. Verificar se há CVEs conhecidos e considerar sanitização de inputs de planilha. | BAIXO |

### 3.4 Build / CI / DevOps

| # | Achado | Severidade |
|---|--------|-----------|
| CI1 | **Sem pipeline de CI/CD**: nenhum `.github/workflows/`, nenhuma configuração de GitHub Actions, Vercel, ou outro CI. | CRÍTICO |
| CI2 | **Sem pre-commit hooks**: nenhum Husky, lint-staged, ou similar configurado. Código pode ser commitado sem linting. | ALTO |
| CI3 | **Sem lockfile de npm consistente**: existe `package-lock.json` E `bun.lockb`. Dois package managers geram conflito. | MÉDIO |
| CI4 | **Sem configuração de deploy**: nenhum `Dockerfile`, `vercel.json`, `netlify.toml`. Deploy depende da plataforma Lovable. | MÉDIO |

### 3.5 Documentação

| # | Achado | Severidade |
|---|--------|-----------|
| D1 | **README genérico**: é o template padrão do Lovable, sem informações sobre o domínio, setup de Supabase local, variáveis de ambiente necessárias, ou contribuição. | ALTO |
| D2 | **Sem `.env.example`**: novos devs não sabem quais variáveis de ambiente são necessárias. | ALTO |
| D3 | **Sem ADRs (Architecture Decision Records)**: decisões como "por que Supabase", "por que verify_jwt=false", "estrutura de precificação" não são documentadas. O `.lovable/plan.md` ajuda, mas é específico de uma feature. | MÉDIO |
| D4 | **Sem documentação da API**: as Edge Functions não têm documentação de endpoints, request/response schemas, ou exemplos. | MÉDIO |

### 3.6 Performance

| # | Achado | Severidade |
|---|--------|-----------|
| P1 | **Bundle não otimizado**: sem code splitting explícito. Todas as 8 páginas são importadas diretamente em `App.tsx` — sem `React.lazy()`. Usuário carrega todo o código upfront. | ALTO |
| P2 | **Recharts é pesado (~500KB)**: usado no Dashboard. Considerar lazy loading do Dashboard ou alternativa mais leve (ex.: @nivo/core, lightweight charting). | MÉDIO |
| P3 | **45+ componentes ui/ no bundle**: muitos nunca são usados (ex.: `carousel`, `menubar`, `navigation-menu`, `input-otp`). Tree shaking ajuda, mas imports implícitos podem reter código. | BAIXO |
| P4 | **Sem cache policy ou staleTime configurado** no `QueryClient`: usa defaults do React Query (staleTime: 0, gcTime: 5min). Toda troca de aba/foco refaz queries. | MÉDIO |

---

## 4. Top 10 Melhorias Priorizadas

### 1. Adicionar testes e framework de teste

**Impacto**: CRÍTICO | **Esforço**: MÉDIO (1-2 dias setup + ongoing)

- **Problema**: Zero testes no projeto. Qualquer refatoração ou nova feature pode introduzir regressões silenciosas.
- **Por que importa**: Sem testes, a confiança em deploys é zero. Bugs chegam a produção sem detecção.
- **Como corrigir**:
  1. Instalar Vitest + @testing-library/react + jsdom
  2. Configurar `vitest.config.ts` com alias `@/`
  3. Adicionar script `"test": "vitest"` e `"test:coverage": "vitest run --coverage"`
  4. Começar por testes dos hooks (`useQuotes`, `useAuth`) e componentes críticos (ProtectedRoute, KanbanColumn)
  5. Adicionar testes para Edge Functions (Deno test runner)
- **Arquivos afetados**: `package.json`, novo `vitest.config.ts`, novos `src/**/*.test.tsx`

### 2. Proteger credenciais e criar `.env.example`

**Impacto**: CRÍTICO | **Esforço**: BAIXO (< 1h)

- **Problema**: `.env` com chaves do Supabase commitado no repositório. Não existe `.env.example`.
- **Por que importa**: Qualquer pessoa com acesso ao repositório pode acessar o projeto Supabase. Em caso de key leak, o projeto fica vulnerável.
- **Como corrigir**:
  1. Adicionar `.env` ao `.gitignore`
  2. Criar `.env.example` com os nomes das variáveis sem valores
  3. Rodar `git rm --cached .env` para remover do tracking
  4. Considerar rotacionar as chaves se o repositório for público
- **Arquivos afetados**: `.gitignore`, novo `.env.example`

### 3. Habilitar TypeScript strict mode

**Impacto**: ALTO | **Esforço**: ALTO (1-2 semanas para corrigir erros)

- **Problema**: `strict: false`, `strictNullChecks: false`, `noImplicitAny: false`. TypeScript funciona como "any-script" — não previne bugs de null/undefined.
- **Por que importa**: A maioria dos bugs em runtime em projetos React vem de valores `null`/`undefined` inesperados. Sem strict, o compilador não alerta.
- **Como corrigir**:
  1. Ativar incrementalmente: primeiro `strictNullChecks: true`, corrigir erros
  2. Depois `noImplicitAny: true`, corrigir erros
  3. Finalmente `strict: true`
  4. Reativar `noUnusedLocals` e `noUnusedParameters` como `"warn"` no ESLint
- **Arquivos afetados**: `tsconfig.json`, `tsconfig.app.json`, praticamente todos os `src/**/*.tsx`

### 4. Configurar CI/CD pipeline

**Impacto**: CRÍTICO | **Esforço**: MÉDIO (2-4h)

- **Problema**: Sem CI/CD. Nenhuma verificação automática em PRs (lint, type-check, testes, build).
- **Por que importa**: Código quebrado pode ser mergeado sem detecção. Sem CI, a qualidade depende exclusivamente da disciplina individual.
- **Como corrigir**:
  1. Criar `.github/workflows/ci.yml` com steps: install → lint → type-check → test → build
  2. Adicionar branch protection rules no GitHub (require CI pass)
  3. Opcional: adicionar deploy preview (Vercel/Netlify)
  4. Adicionar step de `tsc --noEmit` para type checking
- **Arquivos afetados**: novo `.github/workflows/ci.yml`

### 5. Restringir CORS e segurança das Edge Functions

**Impacto**: ALTO | **Esforço**: BAIXO (1-2h)

- **Problema**: CORS permite `*`, `verify_jwt = false`, `calculate-freight` usa service role key sem verificação de auth.
- **Por que importa**: Qualquer pessoa pode invocar a API de cálculo de frete sem estar autenticada, possivelmente com payload malicioso.
- **Como corrigir**:
  1. Restringir `Access-Control-Allow-Origin` ao domínio de produção (variável de ambiente)
  2. Ativar `verify_jwt = true` em `supabase/config.toml`
  3. Em `calculate-freight`, trocar `SUPABASE_SERVICE_ROLE_KEY` por `SUPABASE_ANON_KEY` + auth header do request (como `import-price-table` já faz)
  4. Adicionar validação de payload com Zod ou validação manual mais robusta
- **Arquivos afetados**: `supabase/config.toml`, `supabase/functions/calculate-freight/index.ts`

### 6. Implementar code splitting (lazy loading de rotas)

**Impacto**: ALTO | **Esforço**: BAIXO (1-2h)

- **Problema**: Todas as 8 páginas são importadas eagerly em `App.tsx`. Usuário baixa ~100% do código mesmo acessando só o Dashboard.
- **Por que importa**: Tempo de carregamento inicial mais lento, especialmente em conexões lentas. Recharts sozinho adiciona ~500KB.
- **Como corrigir**:
  1. Trocar imports estáticos por `React.lazy()` em `App.tsx`
  2. Envolver `<Routes>` com `<Suspense fallback={<Loading />}>`
  3. Testar navegação entre rotas para garantir experiência fluida
  ```tsx
  const Dashboard = lazy(() => import('./pages/Dashboard'));
  const Commercial = lazy(() => import('./pages/Commercial'));
  // ...
  ```
- **Arquivos afetados**: `src/App.tsx`

### 7. Configurar Prettier e pre-commit hooks

**Impacto**: MÉDIO | **Esforço**: BAIXO (1-2h)

- **Problema**: Sem formatador automático nem git hooks. Cada dev pode commitar código com estilos diferentes.
- **Por que importa**: Inconsistência de formatação dificulta code reviews e gera diffs desnecessários.
- **Como corrigir**:
  1. Instalar prettier, eslint-config-prettier
  2. Criar `.prettierrc` com configuração do projeto
  3. Instalar husky + lint-staged
  4. Configurar pre-commit: `lint-staged` roda prettier + eslint em arquivos staged
  5. Adicionar `.editorconfig`
- **Arquivos afetados**: `package.json`, novos `.prettierrc`, `.editorconfig`, `.husky/pre-commit`

### 8. Reescrever README e documentação de setup

**Impacto**: MÉDIO | **Esforço**: BAIXO (1-2h)

- **Problema**: README é template genérico do Lovable. Não explica o domínio, setup local, ou como contribuir.
- **Por que importa**: Novos devs perdem tempo descobrindo como rodar o projeto. Sem `.env.example` nem documentação de Supabase, o onboarding é confuso.
- **Como corrigir**:
  1. Reescrever README com: descrição do projeto, stack, pré-requisitos, setup local (com `.env.example`), scripts disponíveis, estrutura de pastas
  2. Documentar setup do Supabase local (`supabase start`, migrações)
  3. Adicionar seção de contribuição e padrões de código
  4. Documentar endpoints das Edge Functions
- **Arquivos afetados**: `README.md`

### 9. Configurar React Query com staleTime adequado

**Impacto**: MÉDIO | **Esforço**: BAIXO (< 1h)

- **Problema**: `QueryClient` usa defaults (staleTime: 0). Toda troca de aba/foco do browser refaz todas as queries Supabase.
- **Por que importa**: Excesso de requests para o Supabase, flickers na UI, e experiência degradada. Combinado com realtime subscriptions, as queries manuais são redundantes.
- **Como corrigir**:
  1. Configurar `defaultOptions` no `QueryClient`:
  ```tsx
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutos
        refetchOnWindowFocus: false, // já tem realtime
      },
    },
  });
  ```
  2. Manter `refetchOnMount: true` para dados críticos
  3. Realtime subscriptions já invalidam queries quando há mudanças
- **Arquivos afetados**: `src/App.tsx`

### 10. Adicionar autorização por role no frontend

**Impacto**: MÉDIO | **Esforço**: MÉDIO (4-8h)

- **Problema**: `ProtectedRoute` apenas verifica se `user` existe, mas não confere roles. Um usuário com role `leitura` vê a mesma interface que um `admin`.
- **Por que importa**: Embora o RLS proteja no backend, o frontend não esconde botões/ações que o usuário não tem permissão de executar, gerando erros confusos quando tentam agir.
- **Como corrigir**:
  1. Criar hook `useUserRole()` que consulta `user_roles` via Supabase
  2. Criar componente `<RoleGuard allowedRoles={['admin', 'comercial']}>` para proteger seções da UI
  3. Adicionar prop `requiredRoles` ao `ProtectedRoute`
  4. Esconder/desabilitar botões de ação baseado no role (ex.: botão "Deletar" só para admin)
- **Arquivos afetados**: novo `src/hooks/useUserRole.tsx`, `src/components/auth/ProtectedRoute.tsx`, componentes com ações CRUD

---

## 5. Quick Wins (< 1 hora cada)

| # | Ação | Tempo |
|---|------|-------|
| QW1 | Adicionar `.env` ao `.gitignore` + criar `.env.example` + `git rm --cached .env` | 15 min |
| QW2 | Implementar `React.lazy()` nas rotas em `App.tsx` | 30 min |
| QW3 | Configurar `staleTime` e `refetchOnWindowFocus` no QueryClient | 15 min |
| QW4 | Atualizar `index.html` com título e meta tags corretos (Vectra Cargo) | 10 min |
| QW5 | Atualizar `package.json` name para `"cargo-flow-navigator"` | 5 min |
| QW6 | Remover `mockData.ts` ou marcar como dev-only | 10 min |
| QW7 | Reativar `@typescript-eslint/no-unused-vars: "warn"` no ESLint | 10 min |

---

## 6. Plano de Melhoria em 3 Fases

### Fase 1: Fundação (1-2 dias)

- [x] Quick wins acima (QW1-QW7)
- [ ] Instalar e configurar Vitest + Testing Library
- [ ] Configurar Prettier + Husky + lint-staged
- [ ] Criar pipeline CI mínimo (lint + type-check + build)
- [ ] Corrigir CORS e segurança das Edge Functions

### Fase 2: Qualidade (1-2 semanas)

- [ ] Escrever testes para hooks críticos (useAuth, useQuotes, useOrders)
- [ ] Escrever testes para Edge Functions (calculate-freight, import-price-table)
- [ ] Habilitar `strictNullChecks: true` e corrigir erros
- [ ] Implementar autorização por role no frontend
- [ ] Reescrever README com documentação completa
- [ ] Decompor `Dashboard.tsx` em subcomponentes menores
- [ ] Unificar tipos duplicados entre frontend e Edge Functions

### Fase 3: Maturidade (1-2 meses)

- [ ] Habilitar `strict: true` completo no TypeScript
- [ ] Atingir cobertura de testes > 60% em hooks e componentes
- [ ] Adicionar testes E2E (Playwright/Cypress) para fluxos críticos
- [ ] Configurar deploy automatizado (Vercel/Netlify/Cloud Run)
- [ ] Implementar monitoramento (Sentry para erros, analytics)
- [ ] Adicionar rate limiting nas Edge Functions
- [ ] Documentar ADRs para decisões arquiteturais
- [ ] Otimizar bundle: analisar com `vite-bundle-visualizer`, remover componentes shadcn não usados
- [ ] Implementar i18n se internacionalização for necessária

---

## 7. Resumo Executivo

| Categoria | Nota | Comentário |
|-----------|------|-----------|
| **Estrutura** | B | Boa separação por domínio, hooks coesos. Pontos fracos: TypeScript fraco, duplicações. |
| **Qualidade** | D | Zero testes, TypeScript não-strict, sem formatador. Risco alto de regressões. |
| **Segurança** | C- | RLS bem implementado no Supabase, mas `.env` exposto, CORS `*`, Edge Functions sem JWT. |
| **CI/DevOps** | F | Inexistente. Nenhum pipeline, hook, ou automação. |
| **Documentação** | D | README genérico, sem .env.example, sem docs de API. |
| **Performance** | C+ | Funcional, mas sem code splitting, sem cache tuning, bundle potencialmente grande. |
| **DX (Dev Experience)** | C | Aliases configurados, hot reload funciona, mas falta lint automático, testes, e docs. |

**Avaliação geral**: O projeto tem uma base sólida de componentes e modelagem de dados, mas carece de práticas fundamentais de engenharia (testes, CI, segurança de credenciais, TypeScript strict). A prioridade imediata é proteger credenciais, configurar CI, e começar a construir cobertura de testes.
