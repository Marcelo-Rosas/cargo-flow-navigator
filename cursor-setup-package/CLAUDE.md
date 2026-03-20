# Cargo Flow Navigator — Contexto para Agentes AI

## Projeto
TMS (Transport Management System) da Vectra Cargo, operação em Navegantes e Itajaí, SC.
Sistema web para gestão de cotações de frete, ordens de serviço, precificação, financeiro, documentos de transporte, frota e notificações.

## Stack
Vite + React 18 + TypeScript + Tailwind 3.4 + shadcn/ui + Supabase + React Router 6 + TanStack Query 5

## Comandos
```bash
npm run dev          # Dev server (Vite)
npm run build        # Build produção
npm run lint         # ESLint
npx tsc --noEmit     # Type check
npx tsx scripts/audit-compliance.ts        # Auditoria rápida
npx tsx scripts/audit-periodic.ts          # Auditoria completa
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
- Edge Functions: chamar via `supabaseInvoke` helper em `src/lib/`

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
| calculate-distance-webrouter | Roteirização |

## Módulos principais
- **Comercial**: cotações (draft→pending→approved→rejected→converted), Kanban, wizard 4 passos
- **Operacional**: ordens de serviço, trips, tracking, despacho
- **Financeiro**: faturamento (FAT), pagamento (PAG), parcelas
- **Precificação**: tabelas de preço, cálculo de frete, ANTT, ICMS, peso cubado
- **Frota**: motoristas, veículos, proprietários, qualificação
- **Documentos**: CT-e, POD, upload
- **Aprovações**: approval_requests + approval_rules

## Deploy (CI/CD)
- `.github/workflows/deploy-cloudflare.yml` — detecção inteligente de mudanças
- `.github/workflows/audit-compliance.yml` — auditoria automática + semanal
- Alterou `src/` → build + deploy Cloudflare Pages
- Alterou `supabase/migrations/` → supabase db push
- Alterou `supabase/functions/` → supabase functions deploy (por função)
- Ordem: Migration → Tipos → Build → Deploy

## Não fazer
- Não usar Zustand, Redux, MobX
- Não usar Next.js patterns
- Não hardcodar alíquotas de ICMS
- Não fazer deploy manual
- Não chamar Evolution API diretamente
- Não reimplementar auth
- Não exibir valores sem R$ e 2 casas decimais
