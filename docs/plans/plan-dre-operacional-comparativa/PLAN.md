# Plano: DRE Operacional Comparativa

## 1. Diagnóstico do modelo atual (errado)

### Localização do código atual

| Arquivo | O que faz | Problema |
|---------|-----------|----------|
| [src/pages/Reports.tsx](src/pages/Reports.tsx) | Página principal de relatórios | Mistura R$/km flat, DRE flat resumida e Conciliação |
| [src/hooks/useRsKmDetailedReport](src/hooks/useDashboardStats.tsx) | R$/km por rota | Métricas flat (avgRsKmPrevisto, avgRsKmReal), não DRE |
| [src/hooks/useDreComparativoReport.ts](src/hooks/useDreComparativoReport.ts) | DRE comparativo | Retorna `DreComparativoRow[]` — **uma linha por entidade**, não por linha contábil |
| [src/modules/dre/](src/modules/dre/) | dre.types, mappers, groupers | `DreComparativoRow` é flat: Receita, Custos Dir., Resultado, Δ. Sem hierarquia DRE |
| [DreComparativoSection](src/pages/Reports.tsx) | Tabela DRE | Colunas: Entidade, Receita, Custos Dir. Presumidos/Reais, Resultado, Δ — **não é DRE por linhas** |

### O que está errado

1. **Modelo flat** — Colunas como `base_resultado`, `custosDiretosPresumidos` em uma única linha por OS/COT, em vez de linhas contábeis hierárquicas.
2. **Confiança cega em `resultadoLiquido`** — O mapper usa `pb.profitability.resultadoLiquido` como fonte primária; deve recomputar a partir das linhas atômicas.
3. **DRE resumida** — Mostra só Receita + Custos Diretos + Resultado, não a estrutura contábil completa (DAS, ICMS, Overhead, sublinhas de custos).
4. **Falta de hierarquia** — Não há `(+) Faturamento`, `(-) Impostos`, `(=) Receita líquida`, etc.
5. **Filtros limitados** — Ano/mês apenas; sem intervalo dd/mm/yyyy, quote_code, os_number.
6. **Consolidação limitada** — Só groupBy order/trip/quote; sem consolidação mensal/trimestral/anual.

---

## 2. Nova modelagem de dados

### 2.1 Estrutura canônica: `DreLine`

```ts
export type DreLineCode =
  | 'faturamento_bruto'
  | 'impostos'
  | 'das'
  | 'icms'
  | 'receita_liquida'
  | 'overhead'
  | 'custos_diretos'
  | 'custo_motorista'
  | 'pedagio'
  | 'carga_descarga'
  | 'espera'
  | 'taxas_condicionais'
  | 'outros_custos'
  | 'resultado_liquido'
  | 'margem_liquida';

export type DreLineGroup = 'receita' | 'impostos' | 'custos' | 'resultado';
export type BadgeDirection = 'up' | 'down' | 'neutral';
export type BadgeColor = 'green' | 'red' | 'neutral';

export interface DreLine {
  lineCode: DreLineCode;
  lineLabel: string;
  lineGroup: DreLineGroup;
  sortOrder: number;
  indentLevel: 0 | 1 | 2; // 0=principal, 1=sublinha, 2=sub-sublinha
  presumedValue: number;
  realValue: number;
  varianceValue: number;
  variancePercent: number;
  badgeDirection: BadgeDirection;
  badgeColor: BadgeColor;
  hasFormulaWarning?: boolean;
}
```

### 2.2 DRE por entidade (COT/OS)

```ts
export interface DreTable {
  periodKey: string;       // ex: '2026-02', '2026-Q1', '2026', 'COT-2026-02-0001', 'OS-2026-02-0002'
  periodType: 'detail' | 'month' | 'quarter' | 'year';
  quoteCode: string | null;
  osNumber: string | null;
  lines: DreLine[];
}
```

### 2.3 Mapeamento pricing_breakdown → linhas presumidas (recomposição)

| Line Code | Fonte Presumido | Fórmula/fallback |
|-----------|-----------------|------------------|
| faturamento_bruto | totals.totalCliente | fallback quotes.value |
| das | totals.das | 0 se ausente |
| icms | totals.icms | 0 se ausente |
| receita_liquida | profitability.receitaLiquida | faturamento - das - icms |
| overhead | profitability.overhead | 0 se ausente |
| custo_motorista | profitability.custoMotorista \|\| custosCarreteiro | 0 |
| pedagio | components.toll | 0 |
| carga_descarga | profitability.custosDescarga | 0 |
| espera | components.waitingTimeCost | 0 |
| taxas_condicionais | components.conditionalFeesTotal | 0 |
| aluguel_maquinas | components.aluguelMaquinas | 0 |
| custos_diretos | **soma das sublinhas** | NUNCA de profitability.custosDiretos como única fonte |
| resultado_liquido | **receita_liquida - overhead - custos_diretos** | NUNCA de profitability.resultadoLiquido como única fonte |
| margem_liquida | resultado_liquido / faturamento_bruto * 100 | |

**Validação de inconsistência:** Se `|resultado_recomputado - profitability.resultadoLiquido| > 0.01`, set `hasFormulaWarning = true`.

### 2.4 Mapeamento orders + trip_cost_items → linhas reais

| Line Code | Fonte Real |
|-----------|------------|
| faturamento_bruto | orders.value |
| das | Calcular sobre value com taxa (ou 0 se não houver) |
| icms | Calcular ou 0 |
| receita_liquida | faturamento - das - icms |
| overhead | Mesmo % da cotação sobre receita_liquida_real |
| custo_motorista | orders.carreteiro_real |
| pedagio | orders.pedagio_real |
| carga_descarga | orders.descarga_real |
| espera | orders.waiting_time_cost |
| taxas_condicionais | trip_cost_items (scope=OS, category condicional) ou 0 |
| aluguel_maquinas | trip_cost_items ou 0 (orders não tem) |
| outros_custos | order_gris_services.amount_real, risk_costs, etc. |
| custos_diretos | **soma das sublinhas** |
| resultado_liquido | receita_liquida - overhead - custos_diretos |
| margem_liquida | resultado / faturamento * 100 |

---

## 3. Arquitetura de implementação

### 3.1 Camada de serviço (novo)

```
src/modules/dre/
├── dre.types.ts          # DreLine, DreTable, DreLineCode, etc.
├── dre.lines.ts          # Definição das linhas (labels, sortOrder, indentLevel)
├── dre.presumed.ts       # computePresumedFromBreakdown(breakdown, quoteValue) → DreLine[]
├── dre.real.ts           # computeRealFromOrder(order, tripCostItems?) → DreLine[]
├── dre.comparator.ts     # compare(presumedLines, realLines) → DreLine[] com variance e badge
├── dre.consolidator.ts   # aggregateDreTables(tables, periodType) → DreTable
├── dre.badges.ts         # badge logic (up/down/neutral, green/red)
└── index.ts
```

### 3.2 Hook e filtros

```
src/hooks/useDreOperacionalReport.ts
```

**Params:**
- `dateFrom: string` (dd/mm/yyyy)
- `dateTo: string` (dd/mm/yyyy)
- `quoteCode?: string | null`
- `osNumber?: string | null`
- `periodType: 'detail' | 'month' | 'quarter' | 'year'`
- `vehicleTypeId?: string | null`

**Query:**
- Buscar orders com `quote:quotes(quote_code, value, pricing_breakdown)` e filtros aplicados
- Buscar trip_cost_items por order_id (scope=OS) quando necessário
- Por ordem: chamar dre.presumed, dre.real, dre.comparator
- Se periodType != 'detail': chamar dre.consolidator

### 3.3 UI

- **Componente principal:** `DreOperacionalTable` — tabela hierárquica com colunas: Item | Presumido | Real | Var. R$ | Var. % | Badge
- **Filtros:** Inputs dd/mm/yyyy, quote_code, os_number, seletor periodType (Detalhado / Mês / Trimestre / Ano)
- **Remoção:** Cards R$/km, tabela R$/km por rota, DreComparativoSection atual (substituir pelo novo)
- **Manter:** Conciliação de Recebimento (pode ficar em seção separada ou aba)

---

## 4. Semântica dos badges

| Tipo de linha | real > presumido | real < presumido | real = presumido |
|---------------|------------------|------------------|------------------|
| **Positivas** (faturamento, receita, resultado, margem) | verde ↑ | vermelho ↓ | neutro |
| **Negativas** (impostos, overhead, custos) | vermelho ↑ | verde ↓ | neutro |

---

## 5. Fases de implementação

### Fase 1 — Tipos e linhas base
- [ ] `dre.types.ts` — DreLine, DreTable, DreLineCode, etc.
- [ ] `dre.lines.ts` — constante com todas as linhas (labels, sortOrder, indentLevel)

### Fase 2 — Cálculo presumido (recomposição)
- [ ] `dre.presumed.ts` — extrair do pricing_breakdown as linhas atômicas, recomputar custos_diretos e resultado_liquido
- [ ] Validar contra profitability.resultadoLiquido e setar hasFormulaWarning

### Fase 3 — Cálculo real
- [ ] `dre.real.ts` — orders.value, carreteiro_real, pedagio_real, descarga_real, waiting_time_cost
- [ ] Integrar trip_cost_items (scope=OS) quando existir
- [ ] Documentar order_gris_services e risk_costs (usar 0 se não houver dados)

### Fase 4 — Comparador e badges
- [ ] `dre.comparator.ts` — juntar presumed e real, calcular variance, aplicar badges
- [ ] `dre.badges.ts` — lógica de badge por tipo de linha

### Fase 5 — Consolidador
- [ ] `dre.consolidator.ts` — agregar DreTable[] por mês/trimestre/ano

### Fase 6 — Hook e dados
- [ ] `useDreOperacionalReport` — query Supabase, filtros (date range, quote_code, os_number), invocar camada DRE

### Fase 7 — UI
- [ ] `DreOperacionalTable` — tabela hierárquica
- [ ] Refatorar Reports.tsx — DRE como tela principal, filtros, remover R$/km flat

### Fase 8 — Validações e testes
- [ ] Garantir que resultado_liquido = receita - overhead - custos_diretos
- [ ] Garantir que custos_diretos = soma sublinhas
- [ ] Teste de inconsistência (hasFormulaWarning)

---

## 6. Schema de referência (campos usados)

### quotes
- id, quote_code, value, pricing_breakdown, created_at

### orders
- id, os_number, quote_id, value, pricing_breakdown, carreteiro_real, pedagio_real, descarga_real, waiting_time_cost, created_at

### trip_cost_items
- trip_id, order_id, scope ('OS'|'TRIP'), category, amount, source

### order_gris_services (se existir)
- order_id, amount_real

### risk_costs (se existir)
- order_id, amount
