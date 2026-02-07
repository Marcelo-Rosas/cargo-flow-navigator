#!/usr/bin/env bash
# =============================================================================
# Cria as 10 issues de melhoria do relatório de auditoria (AUDITORIA_PROJETO.md)
# Uso: ./scripts/create-audit-issues.sh
# Pré-requisito: gh auth login
# =============================================================================
set -euo pipefail

create_issue() {
  local title="$1"
  local labels="$2"
  local body="$3"
  echo "Criando: $title"
  gh issue create --title "$title" --label "$labels" --body "$body"
  echo "---"
  sleep 1
}

# Criar labels se não existirem
for label in "quality" "security" "dx" "performance" "documentation" "ci/cd" \
             "priority:critical" "priority:high" "priority:medium"; do
  gh label create "$label" 2>/dev/null || true
done

# ─── Issue 1 ──────────────────────────────────────────────────────────────────
create_issue \
  "[Auditoria] Adicionar testes e framework de teste" \
  "quality,priority:critical" \
  "$(cat <<'BODY'
## Problema observado

Zero testes no projeto. Nenhum arquivo `*.test.*` ou `*.spec.*`. Nenhuma dependência de test runner (vitest, jest) no `package.json`.

## Por que importa

Sem testes, a confiança em deploys é zero. Qualquer refatoração ou nova feature pode introduzir regressões silenciosas que só serão descobertas em produção.

## Como corrigir

1. Instalar dependências:
   ```bash
   npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
   ```
2. Criar `vitest.config.ts` com alias `@/` e environment `jsdom`
3. Adicionar scripts ao `package.json`:
   ```json
   "test": "vitest",
   "test:run": "vitest run",
   "test:coverage": "vitest run --coverage"
   ```
4. Começar por testes dos hooks (`useQuotes`, `useAuth`) e componentes críticos (`ProtectedRoute`, `KanbanColumn`)
5. Adicionar testes para Edge Functions (Deno test runner)

## Arquivos afetados

- `package.json`
- Novo `vitest.config.ts`
- Novos `src/**/*.test.tsx`
- `supabase/functions/**/*.test.ts`

## Referência

[AUDITORIA_PROJETO.md — Item Q1](../AUDITORIA_PROJETO.md)
BODY
)"

# ─── Issue 2 ──────────────────────────────────────────────────────────────────
create_issue \
  "[Auditoria] Habilitar TypeScript strict mode" \
  "quality,priority:high" \
  "$(cat <<'BODY'
## Problema observado

`tsconfig.json` e `tsconfig.app.json` têm `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false` e `noUnusedParameters: false`. TypeScript funciona como "any-script".

## Por que importa

A maioria dos bugs em runtime em projetos React vem de valores `null`/`undefined` inesperados. Sem strict mode, o compilador não alerta sobre nenhum deles.

## Como corrigir (incrementalmente)

1. **Fase 1**: Ativar `strictNullChecks: true` → corrigir erros de compilação
2. **Fase 2**: Ativar `noImplicitAny: true` → tipar todos os `any` implícitos
3. **Fase 3**: Ativar `strict: true` (inclui strictBindCallApply, noImplicitThis, etc.)
4. Reativar `noUnusedLocals` e `noUnusedParameters` (já feito como warn no ESLint)

## Arquivos afetados

- `tsconfig.json`
- `tsconfig.app.json`
- Praticamente todos os `src/**/*.tsx` terão erros a corrigir

## Referência

[AUDITORIA_PROJETO.md — Item E2](../AUDITORIA_PROJETO.md)
BODY
)"

# ─── Issue 3 ──────────────────────────────────────────────────────────────────
create_issue \
  "[Auditoria] Configurar CI/CD pipeline" \
  "ci/cd,priority:critical" \
  "$(cat <<'BODY'
## Problema observado

Sem pipeline de CI/CD. Nenhum `.github/workflows/`, nenhuma configuração de GitHub Actions. Sem pre-commit hooks (Husky/lint-staged).

## Por que importa

Código quebrado pode ser mergeado sem detecção. Sem CI, a qualidade depende exclusivamente da disciplina individual.

## Como corrigir

1. Criar `.github/workflows/ci.yml`:
   ```yaml
   name: CI
   on: [push, pull_request]
   jobs:
     check:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 22, cache: npm }
         - run: npm ci
         - run: npx tsc --noEmit
         - run: npm run lint
         - run: npm test -- --run
         - run: npm run build
   ```
2. Instalar Husky + lint-staged para pre-commit hooks:
   ```bash
   npm install -D husky lint-staged
   npx husky init
   ```
3. Adicionar branch protection rules no GitHub (require CI pass)

## Arquivos afetados

- Novo `.github/workflows/ci.yml`
- `package.json` (scripts + lint-staged config)
- Novo `.husky/pre-commit`

## Referência

[AUDITORIA_PROJETO.md — Itens CI1, CI2](../AUDITORIA_PROJETO.md)
BODY
)"

# ─── Issue 4 ──────────────────────────────────────────────────────────────────
create_issue \
  "[Auditoria] Restringir CORS e segurança das Edge Functions" \
  "security,priority:high" \
  "$(cat <<'BODY'
## Problema observado

- CORS com `Access-Control-Allow-Origin: '*'` nas Edge Functions
- `verify_jwt = false` em `supabase/config.toml` para ambas as functions
- `calculate-freight` usa `SUPABASE_SERVICE_ROLE_KEY` (key admin) sem verificar auth do request
- Sem rate limiting

## Por que importa

Qualquer pessoa pode invocar a API de cálculo de frete sem autenticação, de qualquer domínio, ilimitadamente. A service role key bypassa todas as políticas RLS.

## Como corrigir

1. Restringir CORS ao domínio de produção (usar variável de ambiente):
   ```ts
   const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || 'https://seu-dominio.com';
   const corsHeaders = { 'Access-Control-Allow-Origin': allowedOrigin, ... };
   ```
2. Ativar `verify_jwt = true` em `supabase/config.toml`
3. Em `calculate-freight`, trocar `SUPABASE_SERVICE_ROLE_KEY` por `SUPABASE_ANON_KEY` + auth header (como `import-price-table` já faz)
4. Adicionar validação de payload com Zod

## Arquivos afetados

- `supabase/config.toml`
- `supabase/functions/calculate-freight/index.ts`
- `supabase/functions/import-price-table/index.ts` (CORS)

## Referência

[AUDITORIA_PROJETO.md — Itens S2, S3, S4, Q6](../AUDITORIA_PROJETO.md)
BODY
)"

# ─── Issue 5 ──────────────────────────────────────────────────────────────────
create_issue \
  "[Auditoria] Configurar Prettier e pre-commit hooks" \
  "dx,priority:medium" \
  "$(cat <<'BODY'
## Problema observado

Sem formatador automático (Prettier) e sem `.editorconfig`. A formatação depende do editor de cada dev.

## Por que importa

Inconsistência de formatação dificulta code reviews e gera diffs desnecessários com mudanças apenas de whitespace.

## Como corrigir

1. Instalar dependências:
   ```bash
   npm install -D prettier eslint-config-prettier
   ```
2. Criar `.prettierrc`:
   ```json
   { "semi": true, "singleQuote": true, "trailingComma": "es5", "printWidth": 100 }
   ```
3. Criar `.editorconfig`:
   ```ini
   root = true
   [*]
   indent_style = space
   indent_size = 2
   end_of_line = lf
   charset = utf-8
   trim_trailing_whitespace = true
   insert_final_newline = true
   ```
4. Adicionar script `"format": "prettier --write src/"` ao `package.json`
5. Integrar com lint-staged (da issue de CI):
   ```json
   "lint-staged": { "*.{ts,tsx}": ["prettier --write", "eslint --fix"] }
   ```

## Arquivos afetados

- `package.json`
- Novos `.prettierrc`, `.editorconfig`

## Referência

[AUDITORIA_PROJETO.md — Item Q3](../AUDITORIA_PROJETO.md)
BODY
)"

# ─── Issue 6 ──────────────────────────────────────────────────────────────────
create_issue \
  "[Auditoria] Reescrever README e documentação de setup" \
  "documentation,priority:high" \
  "$(cat <<'BODY'
## Problema observado

README é template genérico do Lovable com placeholders (`REPLACE_WITH_PROJECT_ID`). Não explica o domínio, setup de Supabase local, variáveis de ambiente, ou como contribuir. Sem `.env.example` (já corrigido) e sem docs de API.

## Por que importa

Novos devs perdem tempo descobrindo como rodar o projeto. Sem documentação de Supabase, o onboarding de backend é impossível.

## Como corrigir

1. Reescrever `README.md`:
   - Descrição do projeto e domínio (CRM logístico Vectra Cargo)
   - Stack tecnológica
   - Pré-requisitos (Node 22+, Supabase CLI)
   - Setup local passo a passo (clone, .env, supabase start, migrations, npm dev)
   - Scripts disponíveis
   - Estrutura de pastas resumida
   - Seção de contribuição e padrões de código
2. Documentar endpoints das Edge Functions (request/response)
3. Opcional: criar `CONTRIBUTING.md`

## Arquivos afetados

- `README.md`
- Opcional: novo `CONTRIBUTING.md`, novo `docs/api.md`

## Referência

[AUDITORIA_PROJETO.md — Itens D1, D2, D4](../AUDITORIA_PROJETO.md)
BODY
)"

# ─── Issue 7 ──────────────────────────────────────────────────────────────────
create_issue \
  "[Auditoria] Adicionar autorização por role no frontend" \
  "security,priority:medium" \
  "$(cat <<'BODY'
## Problema observado

`ProtectedRoute` apenas verifica se `user` existe (`!user`), mas não confere roles. Um usuário com role `leitura` vê a mesma interface que um `admin`, incluindo botões de criar/editar/deletar.

## Por que importa

Embora o RLS proteja no backend, o frontend não esconde ações que o usuário não tem permissão de executar, gerando erros confusos (ex.: 403 ao tentar criar uma cotação como `leitura`).

## Como corrigir

1. Criar hook `useUserRole()` que consulta `user_roles` via Supabase
2. Criar componente `<RoleGuard allowedRoles={['admin', 'comercial']}>`:
   ```tsx
   function RoleGuard({ allowedRoles, children, fallback }) {
     const { role } = useUserRole();
     if (!allowedRoles.includes(role)) return fallback || null;
     return children;
   }
   ```
3. Adicionar prop `requiredRoles` ao `ProtectedRoute`
4. Esconder/desabilitar botões de ação baseado no role

## Arquivos afetados

- Novo `src/hooks/useUserRole.tsx`
- `src/components/auth/ProtectedRoute.tsx`
- Componentes com ações CRUD (formulários, botões de delete, etc.)

## Referência

[AUDITORIA_PROJETO.md — Item S5](../AUDITORIA_PROJETO.md)
BODY
)"

# ─── Issue 8 ──────────────────────────────────────────────────────────────────
create_issue \
  "[Auditoria] Decompor Dashboard.tsx e unificar tipos duplicados" \
  "quality,priority:medium" \
  "$(cat <<'BODY'
## Problema observado

1. `Dashboard.tsx` tem 471 linhas com lógica de formatação, gráficos inline e markup extenso
2. Interfaces `CalculateFreightInput`, `FreightBreakdown`, etc. são duplicadas entre `src/types/pricing.ts` e `supabase/functions/calculate-freight/index.ts`

## Por que importa

- Componentes grandes são difíceis de manter e testar
- Tipos duplicados ficam dessincronizados com o tempo, gerando bugs sutis

## Como corrigir

### Dashboard
1. Extrair gráficos inline para componentes: `ConversionChart.tsx`, `RevenueByClientChart.tsx`
2. Mover `formatCurrency` para `src/lib/utils.ts`
3. Extrair as TabsContent em componentes: `OverviewTab`, `CommercialTab`, `OperationsTab`

### Tipos duplicados
1. Criar `src/types/freight.ts` como fonte única
2. Em `calculate-freight/index.ts`, importar de um shared type ou duplicar com comentário `// Keep in sync with src/types/pricing.ts`
3. Alternativa: mover tipos compartilhados para `supabase/functions/_shared/types.ts` e importar de ambos os lados

## Arquivos afetados

- `src/pages/Dashboard.tsx` → decomposição
- `src/types/pricing.ts`
- `supabase/functions/calculate-freight/index.ts`

## Referência

[AUDITORIA_PROJETO.md — Itens E4, E6](../AUDITORIA_PROJETO.md)
BODY
)"

# ─── Issue 9 ──────────────────────────────────────────────────────────────────
create_issue \
  "[Auditoria] Corrigir KPIs de trend hardcoded no Dashboard" \
  "quality,priority:medium" \
  "$(cat <<'BODY'
## Problema observado

Os `KPICard` no Dashboard recebem valores de trend fixos:
```tsx
<KPICard trend={{ value: 12, isPositive: true }} ... />
<KPICard trend={{ value: 5, isPositive: true }} ... />
```

Esses valores nunca mudam — são decorativos, não dados reais.

## Por que importa

Usuários podem tomar decisões baseadas em indicadores de tendência que são falsos. Isso afeta a credibilidade do dashboard inteiro.

## Como corrigir

1. Calcular trends reais no hook `useDashboardStats`:
   - Comparar valor atual vs. período anterior (mês/semana)
   - Retornar `{ value: percentChange, isPositive: percentChange >= 0 }`
2. Passar dados calculados para o `KPICard`
3. Se dados históricos não estiverem disponíveis, remover o indicador de trend em vez de mostrar valores falsos

## Arquivos afetados

- `src/hooks/useDashboardStats.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/dashboard/KPICard.tsx` (tornar trend opcional)

## Referência

[AUDITORIA_PROJETO.md — Item Q5](../AUDITORIA_PROJETO.md)
BODY
)"

# ─── Issue 10 ─────────────────────────────────────────────────────────────────
create_issue \
  "[Auditoria] Otimizar bundle — analisar e reduzir tamanho" \
  "performance,priority:medium" \
  "$(cat <<'BODY'
## Problema observado

- Recharts adiciona ~500KB ao bundle do Dashboard
- 45+ componentes `ui/` instalados, muitos nunca usados (carousel, menubar, navigation-menu, input-otp)
- Sem análise de bundle configurada

## Por que importa

Bundle maior = tempo de carregamento maior, especialmente em conexões lentas. Code splitting (já implementado) ajuda, mas o tamanho individual dos chunks ainda pode ser reduzido.

## Como corrigir

1. Instalar e rodar `rollup-plugin-visualizer`:
   ```bash
   npm install -D rollup-plugin-visualizer
   ```
   Adicionar ao `vite.config.ts` para gerar relatório visual
2. Identificar componentes shadcn/ui não usados e remover
3. Considerar alternativas mais leves para gráficos se Recharts dominar o bundle
4. Verificar se tree shaking está funcionando para todas as libs (especialmente lucide-react e date-fns)

## Arquivos afetados

- `vite.config.ts`
- `src/components/ui/` (remover não usados)
- `package.json` (remover deps órfãs)

## Referência

[AUDITORIA_PROJETO.md — Itens P1, P2, P3](../AUDITORIA_PROJETO.md)
BODY
)"

echo ""
echo "✅ 10 issues criadas com sucesso!"
