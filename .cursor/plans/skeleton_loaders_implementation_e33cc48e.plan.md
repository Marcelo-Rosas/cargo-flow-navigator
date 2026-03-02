---
name: Skeleton Loaders Implementation
overview: Substituir spinners genéricos por Skeleton Loaders nas telas de carregamento pesado (Financial, CashFlowReport, Commercial), criando componentes reutilizáveis que evitam layout shift e melhoram a percepção de performance.
todos:
  - id: create-kanban-card-skeleton
    content: Criar KanbanCardSkeleton.tsx
    status: pending
  - id: create-kanban-skeleton
    content: Criar KanbanSkeleton.tsx (5 ou 7 colunas)
    status: pending
  - id: create-table-skeleton
    content: Criar TableSkeleton.tsx (CashFlowReport)
    status: pending
  - id: create-trips-skeleton
    content: Criar TripsGridSkeleton.tsx
    status: pending
  - id: apply-financial
    content: Aplicar skeletons em Financial.tsx
    status: pending
  - id: apply-cashflow
    content: Aplicar TableSkeleton em CashFlowReport.tsx
    status: pending
  - id: apply-commercial
    content: Aplicar KanbanSkeleton em Commercial.tsx
    status: pending
isProject: false
---

# Plano: Skeleton Loaders - Infraestrutura de Polimento

## Contexto

O projeto já possui:

- `Skeleton` em [src/components/ui/skeleton.tsx](src/components/ui/skeleton.tsx) - primitivo com `animate-pulse rounded-md bg-muted`
- `AnalysisSkeleton` em [src/components/ai/AnalysisSkeleton.tsx](src/components/ai/AnalysisSkeleton.tsx) - usado no FinancialAiAnalysis

Objetivo: criar skeletons compostos que replicam o layout das telas em carregamento, evitando layout shift e melhorando a percepção de tempo de espera.

## Estratégia

1. **Componentes base reutilizáveis** - prontos para uso no futuro Wizard (QuoteForm)
2. **Substituição cirúrgica** - trocar apenas o bloco de loading, manter estrutura da página
3. **Fidelidade visual** - skeletons ocupam o mesmo espaço que o conteúdo real

---

## Componentes a Criar

### 1. KanbanCardSkeleton

**Arquivo:** `src/components/skeletons/KanbanCardSkeleton.tsx`

Mimica um card do Kanban (FinancialCard / QuoteCard):

- Container: `bg-card rounded-lg border shadow-sm p-4` (mesmas classes do [FinancialCard](src/components/financial/FinancialCard.tsx))
- Code: `Skeleton` w-16 h-3 (font-mono)
- Nome: `Skeleton` w-3/4 h-4
- Rota: `Skeleton` w-1/2 h-3
- Valor: `Skeleton` w-24 h-6 (text-lg)
- Chips: 2 linhas de `Skeleton` w-20 h-5 rounded

### 2. KanbanSkeleton

**Arquivo:** `src/components/skeletons/KanbanSkeleton.tsx`

Props:

```ts
interface KanbanSkeletonProps {
  columnCount?: number;      // default 5 (FAT/PAG) ou 7 (Commercial)
  columnLabels?: { id: string; label: string }[];  // opcional, para headers
}
```

Estrutura:

- Container: `flex gap-4 overflow-x-auto pb-4 -mx-6 px-6` (igual ao [FinancialKanbanBoard](src/components/financial/kanban/FinancialKanbanBoard.tsx))
- Por coluna (min-w-[280px] max-w-[320px] flex-shrink-0):
  - Header: círculo bg-muted + Skeleton w-20 h-4 + Skeleton w-8 h-5 rounded-full
  - Área: `flex-1 p-2 rounded-lg bg-muted/30 min-h-[200px]` com 2-3 `KanbanCardSkeleton` em `space-y-3`

Para Financial: usar `FAT_COLUMNS` ou `PAG_COLUMNS` de [financial-kanban.ts](src/lib/financial-kanban.ts). Para Commercial: usar `QUOTE_STAGES`.

### 3. TableSkeleton

**Arquivo:** `src/components/skeletons/TableSkeleton.tsx`

Props:

```ts
interface TableSkeletonProps {
  rows?: number;     // default 6
  columns?: number;  // default 4 (CashFlowReport)
  title?: boolean;   // default true - skeleton do título "Resumo por mês"
}
```

Estrutura:

- Card: `rounded-lg border bg-card p-4`
- Título: `Skeleton h-5 w-40 mb-4` (se title=true)
- Table com TableHeader (Skeleton em cada TableHead) + TableBody (N linhas com Skeleton em cada TableCell)

### 4. TripsGridSkeleton

**Arquivo:** `src/components/skeletons/TripsGridSkeleton.tsx`

Grid de cards para modo "Por Trip" do Financial:

- Container: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`
- 6 cards: cada um similar ao [TripReconciliationCard](src/components/financial/TripReconciliationCard.tsx) - retângulo com header (trip_number) + grid 3 colunas (Esperado, Pago, Delta)
- Pode usar um `CardSkeleton` genérico: `bg-card rounded-lg border p-4` com Skeleton para trip_number, badge, grid de valores

---

## Páginas a Atualizar


| Página                                                            | Loading atual                    | Substituir por                                                    |
| ----------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| [Financial.tsx](src/pages/Financial.tsx)                          | Loader2 (Kanban, linhas 129-132) | `<KanbanSkeleton columnCount={5} columnLabels={columnsConfig} />` |
| [Financial.tsx](src/pages/Financial.tsx)                          | Loader2 (Trips, linhas 110-112)  | `<TripsGridSkeleton />`                                           |
| [CashFlowReport.tsx](src/components/financial/CashFlowReport.tsx) | Loader2 (linhas 17-21)           | `<TableSkeleton rows={6} columns={4} />`                          |
| [Commercial.tsx](src/pages/Commercial.tsx)                        | Loader2 (linhas 287-289)         | `<KanbanSkeleton columnCount={7} columnLabels={QUOTE_STAGES} />`  |


---

## Fluxo de Implementação

```
Fase 1: Criar componentes
  KanbanCardSkeleton --> KanbanSkeleton (usa internamente)
  KanbanCardSkeleton --> TripsGridSkeleton (ou CardSkeleton genérico)
  TableSkeleton (standalone)

Fase 2: Integrar nas páginas
  Financial.tsx: KanbanSkeleton + TripsGridSkeleton
  CashFlowReport.tsx: TableSkeleton
  Commercial.tsx: KanbanSkeleton
```

---

## Detalhes de Implementação

### KanbanSkeleton - columnLabels

Se `columnLabels` for passado, usar para os headers. Se não, gerar placeholders:

```ts
const labels = columnLabels ?? Array.from({ length: columnCount }, (_, i) => ({
  id: `col-${i}`,
  label: `Coluna ${i + 1}`
}));
```

### TableSkeleton - estrutura do CashFlowReport

Header: Período | Entradas | Saídas | Saldo (4 colunas). Cada célula: `Skeleton h-4 w-full` ou w apropriado.

### Remoção de imports

Após substituir os loaders, remover `Loader2` do import de lucide-react nas páginas que não o usarem mais (verificar se Loader2 é usado em outros lugares como botões de submit).

---

## Arquivos Afetados


| Ação   | Arquivo                                           |
| ------ | ------------------------------------------------- |
| Criar  | `src/components/skeletons/KanbanCardSkeleton.tsx` |
| Criar  | `src/components/skeletons/KanbanSkeleton.tsx`     |
| Criar  | `src/components/skeletons/TableSkeleton.tsx`      |
| Criar  | `src/components/skeletons/TripsGridSkeleton.tsx`  |
| Editar | `src/pages/Financial.tsx`                         |
| Editar | `src/components/financial/CashFlowReport.tsx`     |
| Editar | `src/pages/Commercial.tsx`                        |


---

## Validação

- `npm run build` sem erros
- Troca de abas no Financial: skeleton aparece antes dos dados (sem flash de spinner)
- CashFlowReport: tabela skeleton em vez de spinner centralizado
- Commercial: board skeleton em vez de spinner
- Sem layout shift perceptível ao carregar dados reais
- `npm run lint` sem erros nos arquivos alterados

