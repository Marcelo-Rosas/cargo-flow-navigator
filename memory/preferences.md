# Preferências de Desenvolvimento

## Idioma
- **Código**: inglês (variáveis, funções, tipos, commits)
- **UI / user-facing**: português brasileiro
- **Docs técnicos**: português ou inglês conforme contexto
- **Comentários no código**: inglês (exceto domínio específico BR como ANTT, NTC)

## Moeda
- Sempre em **centavos** (inteiro): R$ 1.500,00 = `150000`
- Exibição: sempre com `R$` e 2 casas decimais
- Nunca armazenar como float/decimal no frontend

## Estilo de código
- TypeScript strict
- Tipos: importar de `@/integrations/supabase/types.generated` — nunca redefinir
- State management: TanStack Query (useQuery/useMutation) — nunca Zustand/Redux/MobX
- Formulários: React Hook Form + Zod
- Auth: usar hook `useAuth` — nunca reimplementar
- Edge Functions: chamar via `invokeEdgeFunction` em `src/lib/edgeFunctions.ts`

## Formatação
- Prettier via pre-commit (Husky + lint-staged)
- ESLint com auto-fix
- Sem emojis no código (ok em docs e UI)

## Git
- Commits em inglês, concisos
- Branch naming: `feat/`, `fix/`, `chore/`, `claude/`
- Nunca force push em main/master
- Preferir novo commit a amend

## Deploy
- Nunca deploy manual — sempre via GitHub Actions
- Preview deploys automáticos em PRs (Cloudflare Pages)
