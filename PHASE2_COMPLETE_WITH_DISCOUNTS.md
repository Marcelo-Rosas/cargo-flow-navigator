# Phase 2 ✅ Completo — Com Sistema de Descontos

**Data:** 18/03/2026
**Status:** Phase 2 finalizado (UI + Hooks + Desconto Propostos)
**Próximo:** Phase 3 (Integração Kanban + Aplicar Migrations)

---

## 📦 Tudo que foi criado

### Fase 1 ✅ (Prévio)
- ✅ Database schema (3 tabelas)
- ✅ TSP algorithm (tsp-solver.ts)
- ✅ 3 Edge Functions (analyze, route, approve)

### Fase 2 ✅ (Hooks & UI)
- ✅ 6 componentes React
- ✅ 3 hooks (useApproveComposition, useLoadCompositionSuggestions, etc)

### Fase 2.1 ✅ (Desconto Propostos) — NOVO
- ✅ `load_composition_discount_breakdown` table
- ✅ Edge Function `calculate-discount-breakdown`
- ✅ Hook `useCalculateDiscounts`
- ✅ Componente `DiscountProposalBreakdown`
- ✅ Modal com 5º tab **"Descontos"**
- ✅ Button **"Calcular Descontos"** em LoadCompositionCard

---

## 🎯 Fluxo Completo (End-to-End)

```
USUÁRIO (Commercial.tsx)
  ↓
LoadCompositionPanel (shipper_id, filters)
  ├─ TanStack Query: fetch suggestions + discounts + routings
  ├─ Tab Filters: All | Pending | Approved | Executed
  └─ Map Suggestions
      ├─ LoadCompositionCard (por sugestão)
      │  ├─ Score + Economia + Warnings
      │  ├─ Button "Detalhes"
      │  ├─ Button "Calcular Descontos" (se pending + sem desconto)
      │  ├─ Button "Aprovar" (se viável)
      │  └─ Badge "Descontos OK" (se já calculado)
      │     └─ onClick "Detalhes" → LoadCompositionModal
      │
      └─ LoadCompositionModal (composição detalhada)
         ├─ Tab 1: Resumo (score, economia)
         ├─ Tab 2: Rota (mapa + legs)
         ├─ Tab 3: Financeiro (custos + margem)
         ├─ Tab 4: Descontos ← NOVO! (DiscountProposalBreakdown)
         │  ├─ Summary: preço original, desconto total, final
         │  ├─ Análise de margem
         │  ├─ Tabela: Original → Desconto → Final → Margem
         │  └─ Warnings (margem violada, etc)
         ├─ Tab 5: Validação (warnings)
         └─ Buttons: Fechar | Aprovar Consolidação

FLUXO DE DESCONTO:
  ↓
onClick "Calcular Descontos" (LoadCompositionCard)
  ↓
useCalculateDiscounts() mutation
  ├─ Chama Edge Function: calculate-discount-breakdown
  ├─ Passa: composition_id, strategy, minimum_margin_percent
  └─ Edge Function:
      ├─ Busca composição + quotes + costs
      ├─ Calcula margem original por cliente
      ├─ Define desconto máximo (respeitando 30% margin)
      ├─ Distribui economia (proportional_to_original)
      ├─ Valida margens finais
      └─ Salva em load_composition_discount_breakdown
  ↓
Toast: "Descontos calculados! Total: R$ 1.188 • Margem média: 32.5%"
  ↓
Query invalidation: refetch compositions + discounts
  ↓
Card atualiza:
  - Remove button "Calcular Descontos"
  - Mostra badge "Descontos OK" (verde)
  - Modal agora mostra Tab 4: Descontos com tabela
```

---

## 🔧 Arquitetura de Desconto

### Database

```sql
load_composition_discount_breakdown {
  id: UUID,
  composition_id: UUID,
  quote_id: UUID,
  shipper_id: UUID,

  -- Valores (centavos)
  original_quote_price_brl,           -- R$ original
  original_freight_cost_brl,          -- Custo frete
  original_margin_brl,                -- Lucro = price - cost
  original_margin_percent,            -- % de margem

  -- Cálculo
  max_discount_allowed_brl,           -- Máximo sem violar 30%
  discount_offered_brl,               -- Desconto real
  discount_percent,                   -- % desconto

  -- Resultado
  final_quote_price_brl,              -- price - discount
  final_margin_brl,                   -- new price - cost
  final_margin_percent,               -- % margem final

  -- Regra aplicada
  margin_rule_source,                 -- 'global' | 'customer'
  minimum_margin_percent_applied,     -- Ex: 30%
  discount_strategy,                  -- 'proportional_to_original'

  is_feasible,                        -- Valida margem
  validation_warnings[]               -- Avisos
}
```

### Cálculo de Desconto (Exemplo)

```
Entrada:
├─ Composição 4 cargas
├─ Economia total: R$ 500
└─ Margem mínima: 30%

Cliente A (Original: R$ 2.000):
├─ Custo: R$ 1.200 (60%)
├─ Margem: R$ 800 (40%)
├─ Max desconto: R$ 200 (800 - 600 mín)
├─ Desconto oferecido: R$ 200 (proporcional)
└─ Final: R$ 1.800 (margem 33% ✅)

Cliente B (Original: R$ 1.500):
├─ Custo: R$ 900
├─ Margem: R$ 600 (40%)
├─ Max desconto: R$ 150
├─ Desconto oferecido: R$ 150
└─ Final: R$ 1.350 (margem 33% ✅)

[... Cliente C, D ...]

RESULTADO:
├─ Total desconto: R$ 500 ✅
├─ Margem média: 32% ✅ (> 30%)
└─ Todos clientes ganham desconto competitivo 🚀
```

---

## 🎨 Componentes Atualizados

### LoadCompositionCard — ATUALIZADO

**Props adicionados:**
```typescript
onCalculateDiscounts?: (compositionId: string) => void;
isCalculatingDiscounts?: boolean;
```

**Novo Button:**
```
[Detalhes]  [Calcular Descontos] (enquanto não há discounts)
[Detalhes]  [Aprovar]           (após calcular ou já viável)
[Detalhes]  [✓ Descontos OK]    (após cálculo bem-sucedido)
```

**Lógica:**
- Se `status === 'pending'` + sem discounts → mostra "Calcular Descontos"
- Se `status === 'pending'` + com discounts → mostra "Descontos OK" (badge verde)
- Se `status !== 'pending'` → sem botão de desconto

### LoadCompositionPanel — ATUALIZADO

**Novo hook:**
```typescript
const { mutate: calculateDiscounts, isPending: isCalculatingDiscounts } =
  useCalculateDiscounts();
```

**Novo handler:**
```typescript
const handleCalculateDiscounts = (compositionId: string) => {
  calculateDiscounts({
    composition_id: compositionId,
    discount_strategy: 'proportional_to_original',
    minimum_margin_percent: 30,
    simulate_only: false,
  });
};
```

**Passa para Card:**
```tsx
<LoadCompositionCard
  suggestion={suggestion}
  onCalculateDiscounts={handleCalculateDiscounts}
  isCalculatingDiscounts={isCalculatingDiscounts}
  {...otherProps}
/>
```

### LoadCompositionModal — ATUALIZADO

**Novo Tab 4: "Descontos"**
```tsx
<TabsTrigger value="discounts">Descontos</TabsTrigger>

<TabsContent value="discounts">
  {composition.discounts?.length > 0 ? (
    <DiscountProposalBreakdown
      discounts={composition.discounts}
      minimumMarginPercent={30}
    />
  ) : (
    <div>Descontos ainda não calculados...</div>
  )}
</TabsContent>
```

---

## 🎯 Estratégias de Distribuição de Desconto

### 1️⃣ Equal Share (Igual)
```
Economia: R$ 500
Clientes: 4
Desconto/cliente: R$ 125 (ou menos se violar margem)
```
**Pros:** Simples, justo, fácil de entender
**Cons:** Clientes pequenos recebem mesmo desconto que grandes

### 2️⃣ Proportional to Original (Padrão)
```
Cliente A: R$ 2.000 (40% do total) → R$ 200 desconto
Cliente B: R$ 1.500 (30% do total) → R$ 150 desconto
Cliente C: R$ 1.000 (20% do total) → R$ 100 desconto
Cliente D: R$ 500 (10% do total) → R$ 50 desconto
```
**Pros:** Proporcional, clientes maiores recebem mais, mais competitivo
**Cons:** Nenhum, é a recomendação

### 3️⃣ Weighted by Weight (Peso)
```
Carga A: 5.000kg (50%) → R$ 250 desconto
Carga B: 3.000kg (30%) → R$ 150 desconto
Carga C: 2.000kg (20%) → R$ 100 desconto
```
**Pros:** Reflete tamanho real da carga
**Cons:** Requer weight_kg dados precisos (MVP usa proportional)

---

## 📊 Exemplo Completo (Vectra Cargo)

### Cenário
```
4 cotações do embarcador X, datas próximas
├─ COT-001: R$ 3.000 | Navegantes → São Paulo
├─ COT-002: R$ 2.500 | Itajaí → São Paulo
├─ COT-003: R$ 1.800 | Navegantes → Curitiba
└─ COT-004: R$ 1.200 | Itajaí → Curitiba
TOTAL: R$ 8.500
```

### Consolidação
```
✅ Score viabilidade: 78%
✅ Rota otimizada: Nav → Itajaí → SP → Curitiba
✅ Economia de frete: R$ 1.200
```

### Cálculo de Desconto
```
Estratégia: Proportional to Original
Margem mínima: 30%

COT-001 (35% do total) → Desconto: R$ 420 → Final: R$ 2.580 (Margem 32%)
COT-002 (29% do total) → Desconto: R$ 348 → Final: R$ 2.152 (Margem 31%)
COT-003 (21% do total) → Desconto: R$ 252 → Final: R$ 1.548 (Margem 30%)
COT-004 (14% do total) → Desconto: R$ 168 → Final: R$ 1.032 (Margem 30%)

TOTAL DESCONTO: R$ 1.188
PREÇO FINAL: R$ 8.500 → R$ 7.312
MARGEM MÉDIA: 32.5% (acima de 30% ✅)
```

### Resultado
```
Antes:
- Sem consolidação, cada carga em rota separada
- Cliente X negocia desconto = você perde margem

Depois:
- Consolidação = economia R$ 1.200
- Você oferece R$ 1.188 de desconto
- Cliente X aprova = consolidação executada
- Você mantém margem de 32.5% (ao invés de 40% sem desconto)
- GANHO: rota otimizada + frete eficiente + cliente satisfeito

NET RESULT: Competitividade ⬆️ | Margens ✅ | Aprovação ✅
```

---

## 🚀 Checklist Completo

### Phase 1 ✅
- [x] Database migrations (3 tabelas)
- [x] TSP algorithm
- [x] Edge Functions (analyze, route, approve)

### Phase 2 ✅
- [x] React hooks (useLoadCompositionSuggestions, useApproveComposition)
- [x] Components (Card, Panel, Modal, RouteMap)
- [x] Modal 4 tabs

### Phase 2.1 ✅ (Desconto Propostos)
- [x] Database: discount_breakdown table
- [x] RLS policies + triggers
- [x] Edge Function: calculate-discount-breakdown
- [x] React hook: useCalculateDiscounts
- [x] Component: DiscountProposalBreakdown
- [x] Modal: novo tab "Descontos"
- [x] Card: button "Calcular Descontos"
- [x] Panel: integração do hook + handlers

### Phase 3 (Próximo)
- [ ] Integrar LoadCompositionPanel em Commercial.tsx
- [ ] Aplicar migrations: `supabase migration up --linked`
- [ ] Testar Edge Functions localmente
- [ ] Testar fluxo completo end-to-end
- [ ] WhatsApp notification (V1.1)
- [ ] PDF proposta comercial (V1.1)

---

## 🧪 Teste Rápido (Local)

### 1. Via Modal
```
1. Abra Commercial.tsx (Kanban Comercial)
2. Abra LoadCompositionPanel
3. Veja card com sugestão pending
4. Clique "Calcular Descontos"
5. Veja toast: "Descontos calculados..."
6. Clique "Detalhes"
7. Vá para tab "Descontos"
8. Veja tabela com proposta
```

### 2. Simular (sem salvar)
```typescript
const { mutate } = useCalculateDiscounts();

mutate({
  composition_id: 'test-123',
  simulate_only: true  // Não salva no DB
}, {
  onSuccess: (data) => {
    console.log('Discounts:', data.discount_breakdown);
  }
});
```

---

## 📝 Próximas Tarefas — Phase 3

### 3.1 Integração Kanban (Obrigatório)
**Arquivo:** `src/pages/Commercial.tsx`

**Opção A: Nova Aba**
```tsx
<Tabs>
  <TabsTrigger value="consolidations">Consolidações</TabsTrigger>
</Tabs>
<TabsContent value="consolidations">
  <LoadCompositionPanel shipperId={currentShipperId} />
</TabsContent>
```

**Opção B: Painel Lateral**
```tsx
{showLoadCompositionPanel && (
  <aside className="w-96 border-l">
    <LoadCompositionPanel shipperId={currentShipperId} />
  </aside>
)}
```

### 3.2 Aplicar Migrations (Obrigatório)
```bash
supabase migration up --linked
```

Migrations:
- ✅ `20260318_create_load_composition_tables.sql`
- ✅ `20260318_create_discount_breakdown_table.sql`

### 3.3 Testar Edge Functions
```bash
supabase functions serve

# Em outro terminal:
curl -X POST http://localhost:54321/functions/v1/calculate-discount-breakdown \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "composition_id": "test-id",
    "simulate_only": true
  }'
```

---

## 📚 Documentação Referência

- `LOAD_COMPOSITION_PHASE2_COMPLETE.md` — Fase 2 (UI + Hooks)
- `DISCOUNT_BREAKDOWN_FEATURE.md` — Feature de Desconto (detalhado)
- Este arquivo — Visão geral completa

---

## 🎓 Stack & Dependências

| Recurso | Uso |
|---------|-----|
| React Query 5.x | useQuery, useMutation |
| shadcn/ui | Card, Tabs, Badge, Dialog, Button |
| Lucide | CheckCircle, AlertCircle, DollarSign, Loader |
| sonner | Toast notifications |
| Supabase JS | Edge Functions, RLS |

---

**Status:** 🟢 Phase 2 + 2.1 Completo

**Próximo:** Phase 3 — Integração Kanban + Testes + Deploy

Quer prosseguir com Phase 3?
