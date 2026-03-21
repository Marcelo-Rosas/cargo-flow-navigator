
# Auditoria Periódica — Cargo Flow Navigator

**Data:** 2026-03-21
**Branch:** claude/run-dbexpert-audit-mwSLr
**Último commit:** e487a3e fix: resolve all audit compliance and periodic issues

## 1. Estrutura do Projeto

| Métrica | Quantidade |
| --- | --- |
| Componentes (.tsx) | 233 |
| Hooks (.ts em hooks/) | 67 |
| Páginas | 18 |
| Arquivos de teste | 1 |
| Cobertura de teste | 1/300 (0%) |

## 2. Compliance de Formatação BRL

**Formatação correta:** 297 ocorrências
**Formatação incorreta:** 0 ocorrências

## 3. Error Boundaries

**Library instalada:** ✅ sim
**Páginas com error boundary (no próprio arquivo):** 0
**Páginas com RouteErrorBoundary (em App.tsx):** 13
**Total de páginas protegidas:** 13
**Páginas sem error boundary:** 5 de 18

## 4. Code Splitting / Lazy Loading

**React.lazy imports (em arquivos de página):** 0
**React.lazy imports (em App.tsx para páginas):** 16
**Total lazy imports:** 16
**Suspense wrappers:** 2
**Páginas total:** 18

⚠️ **Recomendação:** 2 páginas sem lazy loading

## 5. Segurança

✅ Nenhum problema de segurança encontrado

## 6. Padrões de Arquitetura

| Padrão | Status | Ocorrências |
| --- | --- | --- |
| useMutation sem invalidateQueries | ⚠️ | 39 |
| useEffect com fetch/supabase | ✅ | 0 |
| State libs proibidas (Zustand/Redux) | ✅ | 0 |

## 7. Dependências

**Dependências:** 65 produção, 27 dev

## 8. Acessibilidade

| Verificação | Status | Ocorrências |
| --- | --- | --- |
| Imagens sem alt | ✅ | 0 |
| Botões de ícone sem aria-label | ⚠️ | 1 |
| eslint-plugin-jsx-a11y instalado | ❌ | — |

## 9. Código & Higiene

| Métrica | Quantidade |
| --- | --- |
| TODO comments | 2 |
| FIXME comments | 0 |
| HACK comments | 0 |
| console.log em src/ (excl. testes) | 3 |
| Componentes >400 linhas | 33 |

**Top 5 maiores arquivos:**
1. `src/integrations/supabase/types.generated.ts` — 4246 linhas
2. `src/integrations/supabase/types.ts` — 2760 linhas
3. `src/components/forms/QuoteForm.tsx` — 2749 linhas
4. `src/components/modals/OrderDetailModal.tsx` — 1700 linhas
5. `src/lib/freightCalculator.ts` — 1115 linhas

## 10. Tendências


## Score de Compliance


**Score: 89% (8/9 checks passando)**

**Score anterior:** 50% → **Score atual:** 89% (+39)

✅ Projeto em boa forma para MVP