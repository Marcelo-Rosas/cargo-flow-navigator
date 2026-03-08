---
name: cargo-flow-navigator
description: >
  Skill de contexto mínimo para o projeto cargo-flow-navigator (Vectra Cargo).
  Use SEMPRE que trabalhar em qualquer arquivo, feature ou bug deste projeto no Cursor/Claude Code.
  Ativa em menções a: cotação, ordem de serviço, frete, kanban comercial, kanban operacional,
  kanban financeiro, tabela de preço, motorista, veículo, embarcador, cliente, documento, CT-e,
  aprovação, notificação WhatsApp, Evolution API, calculate-freight, Edge Function,
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

## Decisões arquiteturais tomadas (não questionar)

- Cálculo de frete roda **localmente** (`src/lib/freightCalculator.ts`) e **também** na Edge `calculate-freight` — duplicidade intencional para latência
- Kanban usa `DndContext` + `SortableContext` do dnd-kit em todas as 3 boards
- Aprovações têm workflow próprio: `approval_requests` + `approval_rules`
- WhatsApp via `notification-hub` → Evolution API; se `EVOLUTION_API_URL` não configurado → status `pending_whatsapp`
- Rotas `/configuracoes`, `/integracoes`, `/ajuda` existem no Sidebar mas **comentadas** (pendente)
- Env var correta do frontend: `VITE_SUPABASE_PUBLISHABLE_KEY` — ignorar `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` do `.env.example` (typo)
