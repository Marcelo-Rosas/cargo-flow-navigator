# Anexo: seção **Referências** para `TOLL_DEBUG_CHECKLIST.md`

> **Quando usar:** se `docs/TOLL_DEBUG_CHECKLIST.md` estiver aberto no editor e bloqueado para gravação, feche-o ou salve; depois **substitua** do cabeçalho `## Referências` até o fim do arquivo pelo conteúdo abaixo (ou mescle manualmente).

---

## Referências

### Backend
- Edge Function: `supabase/functions/generate-optimal-route/index.ts`
- WebRouter client: `supabase/functions/_shared/webrouter-client.ts`
- Logs: Supabase Dashboard → Edge Functions → Logs (real-time)

### Frontend — Composição de carga (mapa + cards)
- Visualização: `src/components/RouteMapVisualization.tsx`
- Cards de resumo: `src/components/RouteStats.tsx`
- Hook de métricas: `src/hooks/useCompositionRouteMetrics.ts`

### Frontend — Relatórios (não confundir)
- Hook de relatórios: `src/hooks/useRouteMetrics.ts` (RPC `get_route_metrics`)
- Usado por: `Reports.tsx`, `RouteMetricsCards.tsx`
- **Não substituir pelo hook de composição** — são domínios diferentes
