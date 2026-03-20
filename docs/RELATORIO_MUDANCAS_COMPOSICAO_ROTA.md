# Relatório: mudanças — composição de carga, métricas de rota e debug de pedágio

Documento de apoio para **atualizar outros arquivos `.md`** (CLAUDE.md, RELATORIO_ENGENHARIA, guias de deploy, etc.).  
**Escopo:** diff da branch `feat/load-composition-v2-sprint1` em relação à `main` (resumo técnico).

---

## 1. Objetivo das mudanças

| Tema | O que foi feito |
|------|------------------|
| **Separação de hooks** | Métricas de **mapa/composição** não reutilizam mais o nome `useRouteMetrics` no mesmo arquivo que **relatórios** (RPC `get_route_metrics`). |
| **UI de rota** | Cards de resumo (distância, duração, pedágio, paradas) extraídos para `RouteStats`; mapa permanece em `RouteMapVisualization`. |
| **Observabilidade** | Logs explícitos na Edge `generate-optimal-route` e em `calculateRouteDistanceFull` (`webrouter-client`) para diagnosticar pedágio zero. |
| **Qualidade de tooling** | Ajustes ESLint no pacote `mcp-debugger` (handler MCP, `prefer-const`, tipos). |

---

## 2. Arquivos novos

| Arquivo | Função |
|---------|--------|
| `src/hooks/useCompositionRouteMetrics.ts` | Hook puro (`useMemo`): agrega distância, duração, pedágio (centavos), paradas, avisos; suporta `legs` e fallback `routings` (DB legado). |
| `src/components/RouteStats.tsx` | Apresentação dos cards + alertas de `warnings`. |
| `docs/TOLL_DEBUG_CHECKLIST.md` | Checklist operacional: o que buscar nos logs Supabase quando `total_toll_centavos === 0`. |

**Sugestão para outros MD:** citar explicitamente que **composição** → `useCompositionRouteMetrics`; **relatórios/dashboard** → `useRouteMetrics` em `useRouteMetrics.ts`.

---

## 3. Arquivos modificados (por área)

### 3.1 Frontend — composição / mapa

| Arquivo | Mudança |
|---------|---------|
| `src/components/RouteMapVisualization.tsx` | Passa a usar `useCompositionRouteMetrics` + `RouteStats`; tipo de pernas `CompositionRouteLeg[]`; import de `formatCurrencyFromCents` para detalhe por trecho; `hasMap` depende de `metrics.hasValidCoordinates`. |

**Comportamento a documentar:**

- **Duração** nos cards: formato **horas + minutos** (`Xh Ym`), pois `totalDurationMin` vem em **minutos**.
- **Pedágio:** sempre formatado com `formatCurrencyFromCents`; quando total é zero, exibe **R$ 0,00** e texto auxiliar **(sem pedagio)** (não mais apenas "—" nos cards antigos).
- **Paradas com `legs`:** `stopCount = legs.length - 1`. Com só **`routings`** (sem legs): `stopCount = routings.length` (compatível com resumo legado).

### 3.2 Frontend — relatórios (sem alteração de API neste diff)

| Arquivo | Observação |
|---------|------------|
| `src/hooks/useRouteMetrics.ts` | **Permanece** o hook de relatórios: `useRouteMetrics`, `useRouteMetricsConfig`, `useUpsertRouteMetricsConfig`, `useDeleteRouteMetricsConfig`. **Não** foi substituído pelo hook de composição. |

**Atualizar em MDs que mencionem “route metrics”:** distinguir **métricas de rota comercial (UF/OS)** vs **métricas de rota de composição (mapa)**.

### 3.3 Edge Functions — WebRouter e pedágio

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/_shared/webrouter-client.ts` | Em `calculateRouteDistanceFull`: `console.error` em falhas HTTP/API/km inválido; `console.log` de sucesso; bloco **TOLL CALCULATION** (contagem de praças, soma, fallback `custos.pedagio`, total final em centavos). |
| `supabase/functions/generate-optimal-route/index.ts` | Log antes da chamada WebRouter (origem, destino, qtd waypoints); log de sucesso com km, toll em ¢ e R$, praças, coords; `console.warn` se sucesso com toll zero; log de falha padronizado com mensagem de erro. |

**Strings úteis para runbooks / MD:**

- `[generate-optimal-route] Calling WebRouter with: ...`
- `[generate-optimal-route] WebRouter SUCCESS ✓ | ...`
- `[generate-optimal-route] WebRouter FAILED ✗ | ...`
- `[webrouter-full] ✓ API call successful | ...`
- `[webrouter-full] 📊 TOLL CALCULATION:`

### 3.4 MCP debugger (secundário)

| Arquivo | Mudança |
|---------|---------|
| `mcp-debugger/src/index.ts` | `CallToolRequestSchema`: uso de `request.params` e `args` default `{}`. |
| `mcp-debugger/src/tools/debug-component.ts` | `shouldCheck` tipado sem `as any`. |
| `mcp-debugger/src/tools/monitor-edge-functions.ts` | `successCount` como `const`. |
| `mcp-debugger/src/tools/validate-intl.ts` | `code` como `const`. |

---

## 4. Fluxo de dados (para diagramas em MD)

```
LoadCompositionModal
  → invokeEdgeFunction('generate-optimal-route')
    → Edge: generate-optimal-route/index.ts
      → calculateRouteDistanceFull (webrouter-client.ts)
        → API WebRouter
        → toll: informacaoPedagios.result.pedagios[] OU custos.pedagio
  ← JSON: route.legs[], total_toll_centavos, polyline_coords, route_source

RouteMapVisualization
  → useCompositionRouteMetrics({ legs, total*, polylineCoords, routings })
  → RouteStats(metrics)
```

---

## 5. O que atualizar em documentos existentes (checklist)

- [x] **CLAUDE.md:** módulo Composição, tabela de hooks, debug de pedágio, `generate-optimal-route` na tabela Edge, regra em “Não fazer”.
- [ ] **`docs/TOLL_DEBUG_CHECKLIST.md` — seção Referências:** se o arquivo estiver bloqueado no editor, aplicar o texto de `docs/TOLL_DEBUG_CHECKLIST_REFERENCIAS.md` (substituir de `## Referências` até o EOF).
- [ ] **docs de engenharia / API:** mencionar logs de debug de pedágio e `docs/TOLL_DEBUG_CHECKLIST.md`.
- [ ] **Runbook de deploy Supabase:** após alterar `_shared/webrouter-client.ts` ou `generate-optimal-route`, redeploy das Edge Functions afetadas (conforme workflow do repo).
- [ ] **Guia de troubleshooting:** pedágio zero → ver `route_source` na resposta + logs `[webrouter-full]` e `[generate-optimal-route]`.
- [ ] **Submodule `openai-cookbook`:** se aparecer `-dirty` no `git status`, tratar à parte (não faz parte deste escopo funcional).

---

## 6. Trecho pronto para colar em “Arquitetura” ou “Módulos”

```markdown
### Composição de carga — rota no mapa

- **Componentes:** `RouteMapVisualization`, `RouteStats`.
- **Hook:** `useCompositionRouteMetrics` (`src/hooks/useCompositionRouteMetrics.ts`) — métricas agregadas e avisos; aceita `legs` (resposta `generate-optimal-route`) ou `routings` legados.
- **Relatórios (não confundir):** `useRouteMetrics` em `src/hooks/useRouteMetrics.ts` chama RPC `get_route_metrics` e tabela `route_metrics_config`.

### Debug de pedágio (WebRouter)

- Documentação: `docs/TOLL_DEBUG_CHECKLIST.md`.
- Logs: Supabase → Edge Functions → `generate-optimal-route` e funções que usam `calculateRouteDistanceFull`.
```

---

## 7. Avaliação de reconciliação (resumo)

- **Conflito real:** o hook `useRouteMetrics` (RPC `get_route_metrics`, relatórios) não pode ser substituído pela lógica de mapa/composição — quebraria `Reports.tsx` e `RouteMetricsCards.tsx`.
- **Solução:** `useCompositionRouteMetrics` + componentes `RouteMapVisualization` / `RouteStats`; `useRouteMetrics.ts` permanece só para relatórios.
- **Validação:** `npx tsc --noEmit` sem erros; ESLint nos arquivos tocados conforme seu pipeline.

---

## 8. Versão e branch

- **Referência de implementação:** branch `feat/load-composition-v2-sprint1` (commits de refactor + chore mcp-debugger, quando aplicável).
- **Data do relatório:** alinhar ao merge em `main` quando aplicável.

---

*Gerado para facilitar sincronização da documentação Markdown do repositório com o código.*
