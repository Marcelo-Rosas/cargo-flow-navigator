# Checklist de Compliance — Release / Milestone

> Usar antes de cada release ou milestone importante.
> Marcar cada item como ✅ (ok), ⚠️ (parcial), ❌ (falhou).

## 1. Formatação Monetária (BRL)

- [ ] Todos os campos de valor exibem R$ X.XXX,XX (2 casas decimais)
- [ ] Nenhum uso de `.toFixed().replace()` para valores monetários
- [ ] Inputs monetários usam vírgula como separador decimal
- [ ] Cálculos financeiros feitos em inteiros (centavos)
- [ ] Rodar: `npx tsx scripts/audit-compliance.ts --category=brl` → 0 erros

## 2. Segurança

- [ ] Nenhuma Service Role Key no código frontend (`src/`)
- [ ] Nenhuma chamada direta à Evolution API
- [ ] Nenhum `console.log` com dados sensíveis (password, token, key)
- [ ] `.env` e `.env.local` no `.gitignore`
- [ ] Env vars do frontend com prefixo `VITE_`
- [ ] RLS habilitado em todas as tabelas novas
- [ ] Edge Functions usam verificação de auth
- [ ] Rodar: `npx tsx scripts/audit-compliance.ts --category=security` → 0 erros

## 3. Arquitetura & Padrões

- [ ] Server state via TanStack Query (não useState + fetch)
- [ ] Todas as mutations com `invalidateQueries` no onSuccess
- [ ] Nenhum Zustand, Redux, MobX
- [ ] Toast via sonner (não react-hot-toast, não react-toastify)
- [ ] Tipos importados de `types.generated.ts` (não redefinidos)
- [ ] Imports com alias `@/` (sem ../../.. profundos)

## 4. Error Handling

- [ ] `react-error-boundary` instalado
- [ ] Cada página/seção principal tem ErrorBoundary
- [ ] Mutations com `onError` que dá feedback ao usuário (toast)
- [ ] Edge Function calls em try-catch
- [ ] Nenhum `console.log(error)` como tratamento final

## 5. Performance

- [ ] Rotas com React.lazy + Suspense (code splitting)
- [ ] Suspense fallback com Skeleton (não spinner genérico)
- [ ] `staleTime` configurado por recurso no TanStack Query
- [ ] Kanban com optimistic updates no drag
- [ ] Nenhum `useEffect` fazendo data fetching

## 6. Acessibilidade

- [ ] `eslint-plugin-jsx-a11y` instalado e ativo
- [ ] Imagens com `alt` descritivo
- [ ] Botões de ícone com `aria-label`
- [ ] Formulários com labels associados
- [ ] Navegação por teclado funcional nos Kanbans

## 7. Testes

- [ ] Vitest configurado e rodando
- [ ] Testes nos hooks críticos (useCalculateFreight, useQuotes)
- [ ] Teste de formatação BRL (centavos → R$ X.XXX,XX)
- [ ] Teste do wizard de cotação (navegação entre passos)
- [ ] `npm test` passa sem erros

## 8. Deploy & CI/CD

- [ ] `deploy-cloudflare.yml` ativo no GitHub Actions
- [ ] 5 secrets configurados (CF_API_TOKEN, CF_ACCOUNT_ID, SUPABASE_ACCESS_TOKEN, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
- [ ] Migrations testadas com `--dry-run`
- [ ] Build sem erros: `npm run build`
- [ ] Type check limpo: `npx tsc --noEmit`
- [ ] Lint limpo: `npm run lint`
- [ ] Auditoria CI passa: `npx tsx scripts/audit-compliance.ts --ci`

## 9. Documentação

- [ ] `.cursorrules` atualizado com mudanças recentes
- [ ] `CLAUDE.md` reflete estado atual do projeto
- [ ] Novas Edge Functions documentadas
- [ ] Novas tabelas/migrations documentadas

## Score Final

| Seção | Status | Notas |
|---|---|---|
| BRL | | |
| Segurança | | |
| Arquitetura | | |
| Error Handling | | |
| Performance | | |
| Acessibilidade | | |
| Testes | | |
| Deploy | | |
| Documentação | | |

**Score: ___/9 seções aprovadas**
**Aprovado para release:** ☐ Sim ☐ Não (corrigir itens marcados)
