# Load Composition Engine — Phase 2 ✅ Completo

**Data:** 18/03/2026
**Status:** Phase 2 (UI Components & Hooks) finalizado
**Próximo:** Phase 3 (Integração Kanban Comercial)

---

## O que foi feito

### 1. Correção de Bug
- ✅ **File:** `src/hooks/useLoadCompositionSuggestions.ts`
- **Issue:** Missing `import React from 'react'` — necessário para `React.useEffect` na função `useLoadCompositionSuggestionsRealtime`
- **Fix:** Adicionado import no topo do arquivo

---

### 2. Hooks — React Query Mutations & Queries

#### `src/hooks/useApproveComposition.ts` ⭐ (Novo)
```typescript
// Hook mutation para aprovar sugestão de consolidação
const { mutate: approve, isPending } = useApproveComposition();

// Uso
approve(
  { composition_id: 'uuid', notes?: 'Aprovado' },
  { onSuccess: () => refetch() }
);
```

**Responsabilidades:**
- Chama Edge Function `approve-composition` via Supabase
- Obtém user_id do contexto de auth se não fornecido
- Invalida queries relacionadas (suggestions, quotes, orders)
- Toast notifications (sucesso/erro) com sonner
- Retorna response com order_id e summary (quotes_consolidated, savings, km)

**Contato:** Supabase → Edge Function → Approval Orchestration

---

### 3. Componentes de UI

#### `src/components/LoadCompositionCard.tsx` ⭐ (Novo)
Card individual para exibir um sugestão na lista.

**Features:**
- Score de viabilidade com badge
- Economia estimada em BRL (formatada)
- Distância extra em %
- Validation warnings em accordion
- Status badge (pending/approved/rejected/executed)
- Buttons: "Detalhes" e "Aprovar" (condicional)

**Props:**
```typescript
interface LoadCompositionCardProps {
  suggestion: LoadCompositionSuggestionWithDetails;
  onApprove?: (compositionId: string) => void;
  onView?: (compositionId: string) => void;
  isApproving?: boolean;
}
```

---

#### `src/components/LoadCompositionPanel.tsx` ⭐ (Novo)
Painel principal que lista todas as sugestões com filtros.

**Features:**
- Fetch com TanStack Query (staleTime: 5min, gcTime: 10min)
- Filtros por status: All | Pending | Approved | Executed
- Summary cards: Total sugestões, Economia total, Viáveis
- Loading states com Skeleton
- Error states com AlertCircle icon
- Empty state com mensagem contextual
- Refresh button
- Modal para view detalhes

**Props:**
```typescript
interface LoadCompositionPanelProps {
  shipperId: string;
  dateRange?: { from: Date; to: Date };
}
```

**Uso esperado:**
```tsx
<LoadCompositionPanel shipperId={currentShipperId} />
```

---

#### `src/components/LoadCompositionModal.tsx` ⭐ (Novo)
Dialog modal com **4 tabs** de visualização detalhada:

1. **Overview** (Resumo)
   - Score viabilidade (0-100%)
   - Economia estimada
   - Detalhes: # cargas, desvio rota, data criação, # paradas

2. **Route** (Rota)
   - Map placeholder (Leaflet/Mapbox integration ready)
   - Summary: distância total, duração, # paradas
   - Sequência de paradas com janelas de tempo e tempo estimado

3. **Financial** (Financeiro)
   - Custo original vs. consolidado
   - Economia (BRL + %)
   - Eficiência de quilometragem
   - Redução de CO₂ (se disponível)

4. **Warnings** (Validação)
   - Lista de validation_warnings
   - Green checkmark se nenhum aviso
   - Informativo se atende critérios

**Props:**
```typescript
interface LoadCompositionModalProps {
  compositionId: string;
  onClose: () => void;
  onApprove: () => void;
}
```

**Controle:**
- Button "Fechar"
- Button "Aprovar Consolidação" (visível só se pending + feasible)

---

#### `src/components/RouteMapVisualization.tsx` ⭐ (Novo)
Visualização de rota dentro do modal.

**Features (MVP):**
- Map placeholder (pronto para Leaflet/Mapbox)
- Summary grid: distância total, duração, # paradas
- Leg breakdown detalhado:
  - Sequence badge (1, 2, 3...)
  - Distance + duration
  - Time windows (pickup_window_start/end)
  - Estimated arrival
  - Feasibility indicator
  - Polyline preview (codificado)
- Footer tip sobre integração de map

**Props:**
```typescript
interface RouteMapVisualizationProps {
  routings: RoutingLeg[];
}
```

---

## Arquitetura de Dados

### Flow Completo
```
LoadCompositionPanel (lista)
  └─ useLoadCompositionSuggestions + TanStack Query
     └─ Supabase: load_composition_suggestions (com routings + metrics)

  └─ LoadCompositionCard (por sugestão)
     └─ onApprove → useApproveComposition (mutation)
     │  └─ Edge Function: approve-composition
     │     └─ Cria order, atualiza quotes, envia WhatsApp
     │
     └─ onView → LoadCompositionModal (detalhes)
        └─ useLoadCompositionSuggestion (single fetch com details)
        │  └─ Supabase: load_composition_suggestions + routings + metrics
        │
        └─ 4 tabs:
           ├─ Overview: consolidation_score, estimated_savings_brl
           ├─ Route: RouteMapVisualization + legs
           ├─ Financial: metrics (original_cost, composed_cost, savings_percent)
           └─ Warnings: validation_warnings
```

### Database Schema (já criado em Phase 1)
```sql
load_composition_suggestions (id, shipper_id, quote_ids[], consolidation_score, estimated_savings_brl, distance_increase_percent, validation_warnings[], status, created_order_id, created_by, approved_by, approved_at, created_at, updated_at)

load_composition_routings (id, composition_id, route_sequence, quote_id, leg_distance_km, leg_duration_min, leg_polyline, pickup_window_start/end, estimated_arrival, is_feasible)

load_composition_metrics (id, composition_id, original_total_cost, composed_total_cost, savings_brl, savings_percent, original_km_total, composed_km_total, km_efficiency_percent, co2_reduction_kg)
```

---

## Checklist Phase 2 ✅

- [x] Fix React import bug em useLoadCompositionSuggestions.ts
- [x] Criar useApproveComposition hook (mutation)
- [x] Criar LoadCompositionCard component
- [x] Criar LoadCompositionPanel component
- [x] Criar LoadCompositionModal component (4 tabs)
- [x] Criar RouteMapVisualization component

---

## Próximas Tarefas — Phase 3

### 3.1 Integração Kanban Comercial

**Local:** `src/pages/Commercial.tsx` (Kanban board)

**Objetivo:** Exibir LoadCompositionPanel na seção apropriada do kanban

**Opções de integração:**

**Opção A:** Adicionar aba "Consolidações" no Kanban
```tsx
<Tabs>
  <TabsTrigger value="quotes">Cotações</TabsTrigger>
  <TabsTrigger value="consolidations">Consolidações</TabsTrigger>
  {/* ... */}
</Tabs>

<TabsContent value="consolidations">
  <LoadCompositionPanel shipperId={currentShipperId} />
</TabsContent>
```

**Opção B:** Adicionar painel lateral flutuante
```tsx
{showLoadCompositionPanel && (
  <aside className="w-96 border-l bg-white overflow-y-auto">
    <LoadCompositionPanel shipperId={currentShipperId} />
  </aside>
)}
```

**Opção C:** Widget dentro do card de cotação
- Ao selecionar múltiplas cotações, mostrar opção "Consolidar"
- Abre LoadCompositionModal direto

---

### 3.2 Testes

**Unit tests:**
```bash
# TSP solver (já existe)
deno test --allow-all src/lib/__tests__/tsp-solver.test.ts

# Próximo: testes dos hooks
npm test src/hooks/useLoadCompositionSuggestions.test.ts
npm test src/hooks/useApproveComposition.test.ts
```

**E2E tests (Playwright):**
```bash
# Fluxo: Ver sugestões → Aprovar → Confirmação
npx playwright test e2e/load-composition.spec.ts
```

---

### 3.3 Deploy & Validação

**Supabase:**
```bash
# Aplicar migrations
supabase migration up --linked

# Verificar RLS policies
supabase db policies --schema public --table load_composition_suggestions
```

**Edge Functions:**
```bash
# Verificar status
supabase functions list

# Ver logs
supabase functions logs approve-composition
```

**Frontend:**
```bash
# Build
npm run build

# Preview
npm run preview
```

---

## Stack Utilizado — Phase 2

| Recurso | Versão | Uso |
|---------|--------|-----|
| React Query | 5.x | `useQuery`, `useMutation` |
| shadcn/ui | latest | Card, Tabs, Badge, Dialog, Button, Skeleton |
| Lucide Icons | latest | CheckCircle, AlertCircle, MapPin, TrendingDown, RefreshCw, Loader |
| sonner | latest | Toast notifications (onSuccess, onError) |
| date-fns | latest | Date formatting (já importado no projeto) |
| Supabase JS | 2.39.0+ | `supabase.auth.getUser()`, `supabase.functions.invoke()` |

---

## Notas de Implementação

1. **Real-time updates:** `useLoadCompositionSuggestionsRealtime` cuida de subscriptions automáticas quando nova sugestão é criada
2. **Query invalidation:** `useApproveComposition` invalida queries relacionadas automaticamente → refetch
3. **Error handling:** Todos os hooks usam TanStack Query's `onError` + toast notifications
4. **Loading states:** Skeletons em LoadCompositionPanel enquanto fetch é feito
5. **Formatação de moeda:** BRL centavos → reais com `.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`
6. **Acessibilidade:** Dialog, Tabs, Buttons seguem shadcn/ui accessibility patterns

---

## Próximas Melhorias (Roadmap)

- [ ] Leaflet/Mapbox integration em RouteMapVisualization
- [ ] Export de consolidação para PDF (cotação consolidada)
- [ ] Comparação de múltiplas sugestões lado a lado
- [ ] Histórico de aprovações com auditoria
- [ ] Webhook de atualização em tempo real (sem polling)
- [ ] Agendamento de consolidação para data futura
- [ ] Integração com motorista (assign driver após aprovação)

---

**Última atualização:** 18/03/2026 • Phase 2 Complete ✅
