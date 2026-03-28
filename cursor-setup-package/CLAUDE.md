# Cargo Flow Navigator — Contexto para Agentes AI

## Projeto
TMS (Transport Management System) da Vectra Cargo, operação em Navegantes e Itajaí, SC.
Sistema web para gestão de cotações de frete, ordens de serviço, precificação, financeiro, documentos de transporte, frota e notificações.

## Stack
Vite + React 18 + TypeScript + Tailwind 3.4 + shadcn/ui + Supabase + React Router 6 + TanStack Query 5
- Dependências e scripts: **npm** + `package-lock.json` — **não usar Bun** (evita `bun.lockb` e quebra de ferramentas que detectam Bun sem ele instalado, ex.: `update-browserslist-db`)

## Comandos
```bash
npm run dev          # Dev server (Vite)
npm run build        # Build produção
npm run lint         # ESLint
npx tsc --noEmit     # Type check
npx tsx scripts/audit-compliance.ts        # Auditoria rápida
npx tsx scripts/audit-periodic.ts          # Auditoria completa
npm run docs:claude                        # Regenera CLAUDE.md UTF-8 (repo principal)
```

## Arquitetura
- SPA com React Router 6 (sem Next.js)
- Server state via TanStack Query 5 (useQuery/useMutation)
- Formulários via React Hook Form + Zod
- Kanban via dnd-kit
- Backend: Supabase (Postgres + Auth + Edge Functions + RLS)
- Deploy: Cloudflare Pages via GitHub Actions

## Convenções críticas
- Moeda em centavos (inteiro): R$ 1.500,00 = 150000 — SEMPRE exibir com 2 casas decimais
- Tipos: importar de `@/integrations/supabase/types.generated` — nunca redefinir
- Auth: usar `useAuth` hook — nunca reimplementar
- WhatsApp: sempre via Edge Function `notification-hub` → OpenClaw — nunca Evolution API direto
- Cálculo de frete: existe em dois lugares (local + Edge Function) — duplicidade intencional
- Edge Functions: chamar via `invokeEdgeFunction` em `src/lib/edgeFunctions.ts`

## Supabase
- Project ref: epgedaiukjippepujuzc
- Region: sa-east-1
- RLS habilitado em todas as tabelas
- Service Role Key: apenas em Edge Functions

## Edge Functions
| Função | Propósito |
|---|---|
| calculate-freight | Cálculo de frete server-side |
| notification-hub | Envio email + WhatsApp via OpenClaw |
| workflow-orchestrator | Eventos de workflow/aprovações |
| generate-optimal-route | Rota otimizada para composição (WebRouter + pedágio) |
| calculate-distance-webrouter | Roteirização simples |

## Módulos principais
- **Comercial**: cotações (draft→pending→approved→rejected→converted), Kanban, wizard 4 passos
- **Operacional**: ordens de serviço, trips, tracking, despacho
- **Financeiro**: faturamento (FAT), pagamento (PAG), parcelas
- **Precificação**: tabelas de preço, cálculo de frete, ANTT, ICMS, peso cubado
- **Composição de carga**: rota no mapa, métricas agregadas (distância, duração, pedágio, paradas)
- **Frota**: motoristas, veículos, proprietários, qualificação
- **Documentos**: CT-e, POD, upload
- **Aprovações**: approval_requests + approval_rules

## Hooks de métricas de rota (não confundir)
| Hook | Arquivo | Propósito | Usado por |
|---|---|---|---|
| `useCompositionRouteMetrics` | `src/hooks/useCompositionRouteMetrics.ts` | Métricas de composição: legs, mapa, pedágio centavos | `RouteMapVisualization`, `RouteStats` |
| `useRouteMetrics` | `src/hooks/useRouteMetrics.ts` | Relatórios: RPC `get_route_metrics`, config UF/OS | `Reports.tsx`, `RouteMetricsCards` |

**Regra**: nunca substituir um pelo outro — são domínios diferentes (composição vs relatórios).

## Deploy (CI/CD)
- `.github/workflows/deploy-cloudflare.yml` — detecção inteligente de mudanças
- `.github/workflows/audit-compliance.yml` — auditoria automática + semanal
- Alterou `src/` → build + deploy Cloudflare Pages
- Alterou `supabase/migrations/` → supabase db push
- Alterou `supabase/functions/` → supabase functions deploy (por função)
- Ordem: Migration → Tipos → Build → Deploy

## Debug de pedágio (WebRouter)
- Documentação: `docs/TOLL_DEBUG_CHECKLIST.md` — referências expandidas (composição vs relatórios): `docs/TOLL_DEBUG_CHECKLIST_REFERENCIAS.md` (mesclar no checklist principal quando o arquivo não estiver bloqueado no editor)
- Logs: Supabase → Edge Functions → `generate-optimal-route` e `webrouter-client`
- Strings de busca nos logs: `[generate-optimal-route] WebRouter SUCCESS`, `WebRouter FAILED`, `[webrouter-full] TOLL CALCULATION`

## Não fazer
- Não usar Bun como runtime ou gerenciador de pacotes (`bun install`, commitar `bun.lockb`) — stack é **npm**; ver também `bun.lockb` no `.gitignore`
- Não usar Zustand, Redux, MobX
- Não usar Next.js patterns
- Não hardcodar alíquotas de ICMS
- Não fazer deploy manual
- Não chamar Evolution API diretamente
- Não reimplementar auth
- Não exibir valores sem R$ e 2 casas decimais
- Não sobrescrever `useRouteMetrics` para métricas de composição — usar `useCompositionRouteMetrics`

## Memória persistente
Ao iniciar uma sessão, leia os arquivos em `/memory/` para contexto:
- `memory/user.md` — perfil do usuário principal (Marcelo / Vectra Cargo)
- `memory/decisions.md` — decisões arquiteturais e de produto já tomadas
- `memory/preferences.md` — preferências de codificação e estilo
- `memory/people.md` — equipe e stakeholders

Ao encerrar, registre em `memory/decisions.md` qualquer decisão técnica nova tomada na sessão.

## NAVI (Assistente WhatsApp AI)
- **Edge Function**: `nina-orchestrator` (Deno, Supabase Edge Functions)
- **LLM**: Gemini 2.0 Flash (inline em nina-orchestrator) — modelo configurável
- **Gemini compartilhado**: `_shared/gemini.ts` → `callGemini()` + `selectGeminiModel()`
- **Tools registradas**: `sugerir_perdido`, `mover_para_perdido` (em `supabase/functions/nina-orchestrator/tools/`)
- **System prompt**: embutido em `nina-orchestrator/index.ts`
- **WhatsApp gateway**: OpenClaw (via `notification-hub`) — NUNCA Evolution API
- **Sessão**: stateless por request; `session_messages` passado pelo cliente
- **Tool loop**: máximo 5 iterações (hardcoded em `processWithToolLoop`)
- **maxOutputTokens**: 2048 (nina-orchestrator) / 1024 (_shared/gemini.ts)
- **Skill operacional**: `skills/navi-ops/SKILL.md`

### Convenções NAVI
- Respostas sempre em pt-BR com formatação WhatsApp (`*negrito*`, `_itálico_`), sem HTML
- Novas tools: adicionar declaration em `tools/index.ts`, handler em arquivo próprio, case no switch de `executeTool`
- Roteamento de modelo: Flash para queries simples/cotações, Pro para análises complexas (`selectGeminiModel`)

## Pacote cursor-setup
**Fonte canônica (UTF-8):** este arquivo. O `CLAUDE.md` na raiz do repositório é o **mesmo conteúdo sem esta seção**, gerado por `npm run docs:claude` (`scripts/patch-claude-md.mjs` lê este arquivo e grava a raiz). Não edite só a raiz e depois rode o script antigo baseado em `origin/main` — isso reaplicava texto já corrompido.
