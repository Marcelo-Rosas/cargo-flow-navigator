
# Auditoria Periódica — Cargo Flow Navigator

**Data:** 2026-03-21
**Branch:** claude/run-dbexpert-audit-mwSLr
**Último commit:** 8128c8e chore: add periodic audit report

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
**Componentes com error boundary:** 4
**Páginas sem error boundary:** 14 de 18

## 4. Code Splitting / Lazy Loading

**React.lazy imports:** 2
**Suspense wrappers:** 2
**Páginas total:** 18

⚠️ **Recomendação:** 16 páginas sem lazy loading

## 5. Segurança

✅ Nenhum problema de segurança encontrado

## 6. Padrões de Arquitetura

| Padrão | Status | Ocorrências |
| --- | --- | --- |
| useMutation sem invalidateQueries | ⚠️ | 77 |
| useEffect com fetch/supabase | ⚠️ | 8 |
| State libs proibidas (Zustand/Redux) | ✅ | 0 |

## 7. Dependências

**Dependências:** 65 produção, 27 dev

## 8. Acessibilidade

| Verificação | Status | Ocorrências |
| --- | --- | --- |
| Imagens sem alt | ✅ | 0 |
| Botões de ícone sem aria-label | ⚠️ | 1 |
| eslint-plugin-jsx-a11y instalado | ❌ | — |

## Score de Compliance


**Score: 50% (4/8 checks passando)**

⚠️ Melhorias necessárias antes de release