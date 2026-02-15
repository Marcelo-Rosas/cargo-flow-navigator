# Issue #6 – Segurança Edge Functions – Verificação

## Checklist de implementação

| Item | Status | Detalhes |
|------|--------|----------|
| **CORS restrito** | ✅ | `getCorsHeaders(req)` em `_shared/cors.ts` – usa `ALLOWED_ORIGIN` / `ALLOWED_ORIGINS` |
| **verify_jwt = true** | ✅ | `config.toml`: `import-price-table`, `calculate-freight`, `lookup-cep` |
| **calculate-freight: ANON_KEY + JWT** | ✅ | Usa `SUPABASE_ANON_KEY` + header `Authorization` (respeita RLS) |
| **calculate-freight: validação Zod** | ✅ | `calculateFreightInputSchema` em `_shared/freight-schema.ts` |
| **import-price-table: ANON_KEY + JWT** | ✅ | Usa `SUPABASE_ANON_KEY` + header `Authorization` |
| **lookup-cep: CORS** | ✅ | Usa `getCorsHeaders(req)` |
| **Documentação** | ✅ | `docs/api.md` e `README.md` com instruções de `ALLOWED_ORIGIN` |

## Arquivos verificados

- `supabase/config.toml` – verify_jwt em todas as funções
- `supabase/functions/_shared/cors.ts` – CORS restrito
- `supabase/functions/_shared/freight-schema.ts` – schema Zod
- `supabase/functions/calculate-freight/index.ts` – auth + Zod
- `supabase/functions/import-price-table/index.ts` – auth + CORS
- `supabase/functions/lookup-cep/index.ts` – CORS

## Conclusão

**Issue #6 implementada e verificada.** Pode ser encerrada.
