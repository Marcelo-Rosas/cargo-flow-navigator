# Issue #4 – TypeScript Strict Mode – Avaliação

## Escopo verificado

Com `strictNullChecks: true` habilitado em `tsconfig.app.json`, o `tsc` reporta **~200+ erros** em dezenas de arquivos.

## Padrões de erro mais comuns

| Categoria | Descrição | Exemplos |
|-----------|-----------|----------|
| **Supabase GetResult** | Queries retornam `Data \| SelectQueryError`; acesso a propriedades sem checar erro | ExportReports, useAdvancedDashboardStats, useClients |
| **Form inputs (unknown)** | `event.target.value` ou `formData.get()` retornam `unknown` | ClientForm, ShipperForm |
| **Supabase .eq() / .insert()** | Tipos literais do schema (ex: `"id"`) vs `string` genérico | useClients, useAuditLogs, QuoteDetailModal |
| **Union narrowing** | `marginStatus: "UNKNOWN"` não está no tipo esperado | QuoteDetailModal |
| **Spread em unions** | Spread de valor que pode ser erro (não-object) | Sidebar, ExportReports |

## Estimativa

- **Fase 1** (strictNullChecks): 4–8 horas de correções pontuais
- **Fase 2** (noImplicitAny): 2–4 horas adicionais
- **Fase 3** (strict: true): 1–2 horas

## Estratégia recomendada

1. **Branch dedicada**: `feat/typescript-strict` para não bloquear o fluxo principal
2. **Fase 1 por arquivo**: Habilitar `strictNullChecks` e corrigir arquivo a arquivo
3. **Padrão para Supabase**: Sempre validar `if (data && !('error' in data))` antes de usar `data`
4. **Forms**: Usar `String(value ?? '')` ou type guards para `unknown`

## Arquivos mais afetados (ordem sugerida)

1. `src/hooks/useAdvancedDashboardStats.tsx`
2. `src/hooks/useDashboardStats.tsx`
3. `src/components/dashboard/ExportReports.tsx`
4. `src/hooks/useClients.tsx`
5. `src/hooks/useAuditLogs.tsx`
6. `src/components/modals/QuoteDetailModal.tsx`
7. `src/components/layout/Sidebar.tsx`
8. `src/components/forms/ClientForm.tsx`
9. `src/components/forms/ShipperForm.tsx`
10. Demais arquivos (useAnttFloorRate, useShippers, etc.)

## Status: Encerrada ✅

Issue #4 concluída e encerrada (Fase 1 – strictNullChecks).

## Status atual (branch feat/typescript-strict)

- **strictNullChecks**: ✅ Habilitado em tsconfig.app.json
- **Utilitários**: `filterSupabaseRows`, `filterSupabaseSingle`, `asDb`, `asInsert` em `src/lib/supabase-utils.ts`
- **Fase 1 concluída**: ✅ Todos os erros de strictNullChecks corrigidos
- **Build**: `tsc --noEmit` e `npm run build` passam sem erros
- **Correções adicionais**: Sidebar (filtro por role), ExportReports (formatDate), App (404 sem auth)
- **Próximas fases (opcional)**: noImplicitAny, strict: true
