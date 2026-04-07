---
name: cargo-flow-navigator
description: >
  Skill de contexto mínimo para o projeto cargo-flow-navigator (Vectra Cargo).
  Use SEMPRE que trabalhar em qualquer arquivo, feature ou bug deste projeto no Cursor/Claude Code.
  Ativa em menções a: cotação, ordem de serviço, frete, kanban comercial, kanban operacional,
  kanban financeiro, dashboard, relatório, métricas, monitoramento, tabela de preço,
  motorista, veículo, embarcador, cliente, documento, CT-e, aprovação, notificação WhatsApp,
  Evolution API, calculate-freight, Edge Function,
  cargo-flow-navigator, Vectra, Navegantes, Itajaí.
  Objetivo: reduzir consumo de tokens carregando apenas o contexto essencial de cada módulo.
---

# Cargo Flow Navigator — Skill de Contexto Otimizado

## Stack

| Camada | Tecnologia |
|---|---|
| Build | Vite 7 + TypeScript 5.8 |
| UI | React 18 + Tailwind 3.4 + shadcn/ui (Radix) + Framer Motion 12 |
| Routing | React Router 6 |
| Estado servidor | TanStack React Query 5 |
| Formulários | React Hook Form + Zod + @hookform/resolvers |
| Banco / Auth | Supabase (PostgreSQL + Auth + RLS) |
| DnD | @dnd-kit/core + sortable + utilities |
| Utilitários | date-fns, recharts, exceljs, sonner, lucide-react |
| Deploy | Cloudflare Pages (Wrangler) |
| E2E | Playwright |

---

## Mapa de módulos → referência

Leia **somente** o arquivo do módulo da tarefa atual:

| Módulo | Arquivo |
|---|---|
| Cotação, Kanban Comercial, QuoteForm, QuoteCard | `references/quotes.md` |
| Ordem de Serviço, Kanban Operacional, trips | `references/orders.md` |
| Cálculo de frete, tabelas de preço, ANTT, ICMS | `references/pricing.md` |
| Kanban Financeiro, FAT/PAG, parcelas, reconciliação | `references/financial.md` |
| Dashboard executivo, KPIs, IA, NTC/News | `references/dashboard.md` |
| Relatórios (DRE, R$/KM, Route Metrics) | `references/reports.md` |
| Monitoramento de seguros (Buonny), latência/fallback | `references/monitoring.md` |
| Motoristas, veículos, proprietários, qualificação AI | `references/fleet.md` |
| Clientes, embarcadores | `references/entities.md` |
| Documentos, CT-e, POD, upload, discharge checklist | `references/documents.md` |
| Aprovações, workflow, eventos, audit | `references/approvals.md` |
| WhatsApp, email, notification-hub, Evolution API | `references/notifications.md` |
| Auth, roles, ProtectedRoute, profiles | `references/auth.md` |
| Edge Functions, Supabase RLS, views, backend | `references/backend.md` |

**Regra:** nunca carregue mais de 1 arquivo por tarefa. Se tocar 2 módulos, carregue o primário e declare no início da resposta as dependências assumidas.

---

## Convenções (não perguntar)

- **Sem Next.js** — React Router 6, sem App Router
- **Sem Zustand** — estado servidor via React Query; Context para estado local compartilhado
- **UI:** sempre shadcn/ui sobre Radix; nunca criar primitivos do zero
- **Toasts:** `sonner` (não react-hot-toast)
- **Moeda no DB:** centavos como inteiro (`150000` = R$ 1.500,00)
- **Roles:** `admin` | `financeiro` | `operacional`
- **Supabase client:** `src/integrations/supabase/client.ts`
- **Tipos gerados:** `src/integrations/supabase/types.generated.ts` — importar, não redefinir
- **Edge Functions:** `supabase/functions/` — invocar via helpers em `src/lib/edgeFunctions.ts`
- **WhatsApp:** Evolution API — chamada **somente** pela Edge Function `notification-hub`; nunca chamar `EVOLUTION_API_URL` direto no frontend
- **Buonny (risco/seguro):** `RiskWorkflowWizard` usa consulta **simulada** — integração real pendente

---

## Padrão de resposta para código

```typescript
// [MÓDULO] — [arquivo alterado]
// Tokens salvos: não incluí [o que foi omitido]

[código]
```

---

## Anti-patterns (desperdiçam tokens)

❌ Não inclua `types.generated.ts` completo — importe só os tipos usados  
❌ Não inclua todas as 93 migrations — cite só a tabela relevante  
❌ Não inclua `package.json` completo  
❌ Não cole hook inteiro quando só 1 função está errada — trecho máx 60 linhas  
❌ Não reimplemente auth — usar `useAuth` de `src/hooks/useAuth.tsx`  
❌ Não chame Evolution API diretamente do frontend  
❌ Não crie componente UI do zero se existe equivalente no shadcn/ui  

---

## Prompt Templates

### Bug Fix
```
Bug em [ARQUIVO:LINHA] — módulo [MÓDULO]
Erro: [mensagem / stack trace]
Trecho relevante (máx 60 linhas):
[código]
Fix esperado: [1 frase]
```

### Nova Feature
```
Feature: [nome] — módulo [MÓDULO]
Comportamento: [3 linhas máx]
Hooks / interfaces existentes relacionados:
[só os relevantes]
```

### Refactor
```
Refactor: [ARQUIVO]
Objetivo: [1 frase]
Restrições: [compatibilidades a manter]
[código atual]
```

---

## Quando usar cada referência

Use `@.cursor/skills/cargo-flow-navigator/references/<arquivo>.md` no início do prompt.

| Referência | Quando usar | Exemplo de prompt |
|---|---|---|
| `quotes.md` | Cotações, Kanban Comercial, QuoteForm/Wizard, QuoteCard | `@.cursor/skills/cargo-flow-navigator/references/quotes.md Corrija a validação do passo de carga no QuoteFormWizard.` |
| `orders.md` | Ordem de serviço, Kanban Operacional, trips e despacho | `@.cursor/skills/cargo-flow-navigator/references/orders.md Ajuste a transição de status da OS no board operacional.` |
| `pricing.md` | Cálculo de frete, ANTT, ICMS, tabelas e parâmetros | `@.cursor/skills/cargo-flow-navigator/references/pricing.md Investigue divergência no cálculo lotação vs fracionado.` |
| `financial.md` | FAT/PAG, parcelas, conciliação, fluxo de caixa | `@.cursor/skills/cargo-flow-navigator/references/financial.md Corrija o card de reconciliação no financeiro.` |
| `dashboard.md` | Dashboard executivo, KPIs, widgets de IA, NTC/news | `@.cursor/skills/cargo-flow-navigator/references/dashboard.md Ajuste a query e fallback dos KPIs do dashboard.` |
| `reports.md` | Relatórios DRE, R$/KM, métricas de rota | `@.cursor/skills/cargo-flow-navigator/references/reports.md Corrija agregação mensal no relatório de DRE.` |
| `monitoring.md` | Monitoramento de seguros (Buonny), latência, fallback | `@.cursor/skills/cargo-flow-navigator/references/monitoring.md Analise aumento de fallback ratio em 24h.` |
| `fleet.md` | Motoristas, veículos, proprietários, qualificação | `@.cursor/skills/cargo-flow-navigator/references/fleet.md Ajuste validação de documentos do motorista.` |
| `entities.md` | Clientes, embarcadores e dados mestre comerciais | `@.cursor/skills/cargo-flow-navigator/references/entities.md Corrija preenchimento automático de CEP do embarcador.` |
| `documents.md` | CT-e, POD, uploads, checklist de descarga | `@.cursor/skills/cargo-flow-navigator/references/documents.md Corrija regra de upload obrigatório antes da entrega.` |
| `approvals.md` | Regras de aprovação, eventos de workflow e auditoria | `@.cursor/skills/cargo-flow-navigator/references/approvals.md Ajuste o gatilho de aprovação por margem.` |
| `notifications.md` | WhatsApp/email, notification-hub, templates | `@.cursor/skills/cargo-flow-navigator/references/notifications.md Ajuste payload do notification-hub para WhatsApp.` |
| `auth.md` | Perfis, permissões, rotas protegidas e sessão | `@.cursor/skills/cargo-flow-navigator/references/auth.md Investigue falha de acesso para perfil operacional.` |
| `backend.md` | Supabase, RLS, Edge Functions, views e integrações | `@.cursor/skills/cargo-flow-navigator/references/backend.md Corrija policy RLS de leitura em tabela financeira.` |

---

## Decisões arquiteturais tomadas (não questionar)

- Cálculo de frete roda **localmente** (`src/lib/freightCalculator.ts`) e **também** na Edge `calculate-freight` — duplicidade intencional para latência
- Kanban usa `DndContext` + `SortableContext` do dnd-kit em todas as 3 boards
- Aprovações têm workflow próprio: `approval_requests` + `approval_rules`
- WhatsApp via `notification-hub` → Evolution API; se `EVOLUTION_API_URL` não configurado → status `pending_whatsapp`
- Rotas `/configuracoes`, `/integracoes`, `/ajuda` existem no Sidebar mas **comentadas** (pendente)
- Env var correta do frontend: `VITE_SUPABASE_PUBLISHABLE_KEY` — ignorar `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` do `.env.example` (typo)
