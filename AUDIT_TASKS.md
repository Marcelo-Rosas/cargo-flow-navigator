# 🔍 CFN — Auditoria de Código & Tarefas de Desenvolvimento

**Data:** 20 de Março de 2026
**Projeto:** Cargo Flow Navigator (TMS)
**Status:** 421 arquivos analisados | 94 erros | 129 avisos

---

## 📊 Resumo Executivo

| Categoria | Erros | Avisos | Impacto |
|-----------|-------|--------|---------|
| **BRL/Moeda** | 91 | 41 | Alto — Exibição incorreta de valores |
| **React Hooks** | 0 | 10 | Médio — Possíveis bugs em re-renders |
| **Fast Refresh** | 3 | 14 | Médio — DX ruim, hot reload quebra |
| **TypeScript** | 3 | 0 | Baixo — Segurança de tipos |
| **Outros** | 0 | 64 | Variado |

---

## 🔴 PRIORIDADE 1 — Crítico (Impacto Alto)

### 1.1 Formatação BRL Inconsistente (91 erros)

**Problema:** Múltiplos componentes exibem valores monetários sem 2 casas decimais ou com formatação manual.

**Arquivos Afetados:**
- `src/components/DiscountProposalBreakdown.tsx` (linhas 142, 188)
- `src/components/LoadCompositionModal.tsx` (linha 213)
- `src/components/dashboard/MarketInsightsCard.tsx` (linhas 167, 174+)
- `src/components/dashboard/NtcIndicesCard.tsx` (múltiplas linhas)
- `src/components/financial/` (vários arquivos)

**Exemplo do Erro:**
```typescript
// ❌ ERRADO
<FormattedNumber
  value={totalValue}
  maximumFractionDigits={0}  // Sem casas decimais!
/>

// ✅ CORRETO
<FormattedNumber
  value={totalValue}
  minimumFractionDigits={2}
  maximumFractionDigits={2}
/>
```

**Ação Recomendada:**
1. Criar helper `formatCurrency(value: number, locale = 'pt-BR')`
2. Usar `Intl.NumberFormat` com `{style: 'currency', currency: 'BRL', minimumFractionDigits: 2}`
3. Substituir todos os `toFixed().replace()` manuais
4. Rodar `npm run audit` pós-fix para validar

**Esforço:** 2-3 horas | **Complexidade:** Baixa | **Risco:** Baixo

---

### 1.2 React Hooks com Dependências Faltantes (6 warnings críticos)

**Problema:** `useEffect` e `useMemo` com dependências incompletas → possível stale state.

**Arquivos Afetados:**
- `src/components/approvals/ApprovalModal.tsx` (linha 109)
  - **Falta:** `approval`, `requestAi`

- `src/components/forms/QuoteForm.tsx` (linhas 836+)
  - **Falta:** `quote`
  - **Complexidade:** medium expression

- `src/components/financial/CashFlowReport.tsx` (linhas 233-235)
  - **Falta:** `pendingRows`, `items` → wrap em `useMemo`

- `src/components/forms/DriverForm.tsx` (linha 67)
  - **Falta:** `linkedVehicles` → wrap em `useMemo`

**Exemplo:**
```typescript
// ❌ ERRADO
useEffect(() => {
  // usa 'approval' aqui
}, []) // esqueceu 'approval'!

// ✅ CORRETO
useEffect(() => {
  // usa 'approval' aqui
}, [approval])
```

**Ação Recomendada:**
1. Abrir cada arquivo e adicionar dependências conforme ESLint sugere
2. Para dependencies complexas, extrair em `useMemo`
3. Testar com React Devtools Profiler
4. Rodar `npm run lint` para confirmar

**Esforço:** 1-2 horas | **Complexidade:** Média | **Risco:** Médio (pode expor bugs existentes)

---

## 🟡 PRIORIDADE 2 — Alto (Impacto Médio)

### 2.1 Fast Refresh Quebrado (17 warnings)

**Problema:** Exports de constants/utilities junto com componentes React quebra hot reload.

**Arquivos Afetados:**
- `src/components/insurance/InsuranceSelectorLazy.tsx` (linhas 77)
- `src/components/layout/LayoutContext.tsx` (linhas 14, 36)
- `src/components/quotes/AdditionalFeesSection.tsx` (linha 256)
- `src/components/ui/badge.tsx`, `button.tsx`, `form.tsx`, etc.
- `src/hooks/useAuth.tsx` (linha 88)

**Exemplo:**
```typescript
// ❌ ERRADO — constants + componente no mesmo arquivo
export const INSURANCE_TYPES = {...}
export const Badge = () => {...}

// ✅ CORRETO — separar
// badge.tsx → só componente
// badge.constants.ts → só constants
```

**Ação Recomendada:**
1. Criar arquivos `.constants.ts` para cada arquivo com exports mistas
2. Exemplo: `badge.constants.ts`, `form.constants.ts`
3. Importar constantes onde necessário
4. Testar hot reload: `npm run dev` e editar arquivo

**Esforço:** 2-3 horas | **Complexidade:** Baixa | **Risco:** Baixo

---

### 2.2 TypeScript `any` Type (3 errors)

**Problema:** `google-maps.ts` usa `any` em 3 funções → perda de segurança de tipos.

**Arquivo:** `src/lib/google-maps.ts` (linhas 88, 91, 94)

```typescript
// ❌ ERRADO
export function calculateDistance(origin: any, destination: any): any {
  // ...
}

// ✅ CORRETO
interface Coordinates {
  lat: number
  lng: number
}

export function calculateDistance(
  origin: Coordinates,
  destination: Coordinates
): Promise<number> {
  // ...
}
```

**Ação Recomendada:**
1. Definir interfaces `Coordinates`, `DistanceResult`
2. Atualizar assinaturas de função
3. Rodar `npm run lint:types` para validar

**Esforço:** 30-45 min | **Complexidade:** Baixa | **Risco:** Muito Baixo

---

## 🟠 PRIORIDADE 3 — Médio (Melhorias)

### 3.1 Intl.NumberFormat sem fractionDigits Explícito (41 warnings)

**Problema:** `currency: 'BRL'` sem `minimumFractionDigits: 2` explícito → comportamento inconsistente.

**Arquivos Afetados:**
- `src/components/boards/OrderCard.tsx`
- `src/components/boards/QuoteCard.tsx`
- `src/components/dashboard/ExportReports.tsx`
- `src/components/dashboard/MonthlyTrendsChart.tsx`

**Fix:** Adicionar `minimumFractionDigits: 2, maximumFractionDigits: 2` em todos os casos.

**Esforço:** 1-2 horas | **Complexidade:** Baixa | **Risco:** Muito Baixo

---

### 3.2 useFinancialBoardData — Logical Expressions em Dependências

**Arquivo:** `src/hooks/useFinancialBoardData.ts` (linhas 17, 23)

**Problema:** `rows` criado inline → muda toda render → quebra cache.

```typescript
// ❌ ERRADO
const items = useMemo(() => {
  const rows = [...data] // novo array a cada render!
  return rows
}, [rows])

// ✅ CORRETO
const rows = useMemo(() => [...data], [data])
const items = useMemo(() => rows, [rows])
```

**Esforço:** 30 min | **Complexidade:** Baixa | **Risco:** Baixo

---

## 📋 Checklist por Módulo

### Módulo Comercial
- [ ] QuoteForm: adicionar `quote` em dependências (linha 836)
- [ ] DiscountProposalBreakdown: fix BRL em linhas 142, 188

### Módulo Aprovações
- [ ] ApprovalModal: adicionar `approval`, `requestAi` (linha 109)

### Módulo Financeiro
- [ ] CashFlowReport: refactor `pendingRows`, `items` em useMemo
- [ ] MarketInsightsCard: fix formatação manual de diesel
- [ ] Todas as linhas com `maximumFractionDigits: 0`

### Módulo Frota
- [ ] DriverForm: wrap `linkedVehicles` em useMemo

### Módulo Google Maps
- [ ] Definir tipos para `Coordinates`, `DistanceResult`
- [ ] Remover `any` types

---

## 🚀 Roadmap Sugerido

### Sprint 1 (Esta Semana)
1. **BRL Formatting** — Fix 91 erros (2-3h)
2. **React Hooks** — Fix 6 dependências críticas (1-2h)
3. **TypeScript `any`** — Fix 3 erros (30-45 min)

### Sprint 2 (Próxima Semana)
1. **Fast Refresh** — Separar constants (2-3h)
2. **Intl.NumberFormat** — 41 warnings (1-2h)
3. **useFinancialBoardData** — Refactor (30 min)

---

## 📊 Métricas de Sucesso

| Métrica | Antes | Alvo |
|---------|-------|------|
| **Erros ESLint** | 3 | 0 |
| **Warnings ESLint** | 23 | 0 |
| **Audit Errors** | 94 | < 10 |
| **Audit Warnings** | 129 | < 30 |
| **TypeScript Errors** | 0 | 0 |

---

## 🔧 Comando de Validação

Após cada tarefa, rodar:

```bash
npm run lint           # ESLint + TypeScript check
npx tsx scripts/audit-compliance.ts  # Auditoria rápida
```

---

## 💡 Notas Importantes

- **Moeda:** Regra do projeto: BRL sempre em centavos (R$ 1.500,00 = 150000)
- **Sem Zustand/Redux:** Use React Query + Context
- **WhatsApp:** Sempre via OpenClaw, nunca Evolution API direto
- **Edge Functions:** Chamar via `supabaseInvoke` helper
- **Tipos:** Importar de `@/integrations/supabase/types.generated`

---

**Próximos Passos:** Escolha qual tarefa iniciar primeiro! Recomendo começar por **BRL** (maior impacto) e depois **React Hooks** (risco moderado).
