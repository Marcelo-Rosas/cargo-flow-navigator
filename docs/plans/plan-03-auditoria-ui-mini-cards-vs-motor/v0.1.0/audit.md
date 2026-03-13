---
plan_number: 03
plan_slug: plan-03-auditoria-ui-mini-cards-vs-motor
version: v0.1.1
role: Analista de Produto + Engenheiro(a) de Software (Supabase + TypeScript)
focus: Auditoria de métricas UI vs motor de cálculo (precificação/frete)
created_at: 2026-03-06
audited_at: 2026-03-06
audit_status: COMPLETA — evidências lidas diretamente do código
depends_on:
  - plan-02-metodologia-precificacao-lotacao-vs-fracionado@v0.2.2
schema_tables_used:
  - quotes
  - orders
  - price_tables
  - price_table_rows
  - pricing_parameters
  - pricing_rules_config
  - payment_terms
  - conditional_fees
  - antt_floor_rates
  - icms_rates
  - tac_rates
  - ltl_parameters
  - waiting_time_rules
  - toll_routes
code_entrypoints:
  - supabase/functions/calculate-freight/index.ts
  - supabase/functions/_shared/freight-types.ts
  - src/hooks/useCalculateFreight.ts
  - src/components/modals/QuoteDetailModal.tsx
  - src/components/modals/quote-detail/QuoteModalFinancialSummary.tsx
  - src/components/modals/quote-detail/QuoteModalLogisticsGrid.tsx
  - src/components/modals/quote-detail/QuoteModalCostCompositionTab.tsx
notes:
  - "v0.1.1: auditoria completa com leitura real dos arquivos. Evidencias verificadas linha a linha."
  - "v0.1.0 tinha hipoteses — agora sao fatos com arquivo:linha."
output_file: docs/plans/plan-03-auditoria-ui-mini-cards-vs-motor/v0.1.0/audit.md
---

# Plan 03 — Auditoria UI (mini-cards / badges / R$/km) vs motor de cálculo
## Status: AUDITORIA COMPLETA (v0.1.1)

---

## 0) Prova rápida — Perguntas respondidas com evidência verificada

| Pergunta | Resposta |
|----------|----------|
| A UI usa `quote.value` ou `breakdown.totals.totalCliente` como "Venda"? | **`totals.totalCliente`** — `QuoteDetailModal.tsx:209`. `quote.value` só em fallback `totalAmount` (L424). |
| "Custo pago ao motorista" no Spread é qual campo? | **`custosCarreteiro` (= `ntc_base`)** via fallback — porque `custo_motorista` não é salvo pelo builder (`useCalculateFreight.ts:189-197`). |
| `ntc_base` vs `frete_peso` — são iguais? | **NÃO.** `calculate-freight/index.ts:459,479`: `ntc_base = frete_peso + frete_valor + gris + tso + dispatchFee`. `ntc_base > frete_peso`. |
| O divisor do km é correto? | **Sim.** `QuoteDetailModal.tsx:142`; `QuoteModalLogisticsGrid.tsx:130-134`: guard `kmDistance > 0`. Não divide por zero. |
| "Receita Líquida" mini-card aparece? | **Não, nunca**, para quotes recalculadas. `receitaLiquidaView = null` sempre (não salvo). `QuoteModalFinancialSummary.tsx:37`: `{receitaLiquida != null && ...}`. Grid sempre 2 colunas. |
| Badge de margem atualiza após Recalcular? | **Sim** — `useCalculateFreight.ts:196` mapeia `margemPercent`. `invalidateQueries(['quotes'])` em `QuoteDetailModal.tsx:397`. Se "não muda": input idêntico. |
| `targetMarginPercent` é dinâmico? | **Não.** Hardcoded `15` em `useCalculateFreight.ts:206`. `QuoteDetailModal.tsx:249-252` tenta ler `profitMarginTarget` mas não está salvo. |

---

## 1) UI Surface Map — inventário verificado

### 1.1 Comandos executados

```
Read QuoteDetailModal.tsx           (831 linhas)
Read QuoteModalFinancialSummary.tsx  (84 linhas)
Read QuoteModalLogisticsGrid.tsx    (176 linhas)
Read QuoteModalCostCompositionTab.tsx (599 linhas)
Read useCalculateFreight.ts         (213 linhas)
Read calculate-freight/index.ts     (L760-920)
Read freight-types.ts               (L130-152)
Grep custo_motorista|receita_liquida em supabase/functions
Grep ntc_base|frete_peso em calculate-freight/index.ts
```

### 1.2 UI Metric Inventory — verificado

| Métrica (label UI) | Componente:linha | Fonte no breakdown | Risco |
|---|---|---|---|
| Faturamento Bruto | `QuoteModalFinancialSummary.tsx:31-35` | `totals.totalCliente` | Médio: label "Bruto" mas valor inclui impostos |
| Receita Líquida (mini-card) | `QuoteModalFinancialSummary.tsx:37-47` | `profitability.receitaLiquida` | **CRÍTICO: nunca aparece** (campo não salvo) |
| Resultado Líquido | `QuoteModalFinancialSummary.tsx:57-66` | `profitability.resultadoLiquido` | Baixo (campo salvo) |
| Margem % (badge) | `QuoteModalFinancialSummary.tsx:67-69` | `profitability.margemPercent` | Baixo (campo salvo) |
| Venda R$/km | `QuoteModalLogisticsGrid.tsx:165-168` | `totalCliente / kmDistance` | Baixo |
| Custo R$/km (Spread) | `QuoteModalLogisticsGrid.tsx:159-163` | `custoMotoristaView` = `ntc_base` via fallback | **CRÍTICO: valor errado** |
| Spread R$/km | `QuoteModalLogisticsGrid.tsx:148-150` | `(totalCliente - ntc_base) / kmDistance` | **Alto: numerador usa ntc_base** |
| DRE "Custo Motorista (Frete Base)" | `QuoteModalCostCompositionTab.tsx:84,293-298` | `components.baseFreight` = `frete_peso` | Baixo |
| DRE "Receita Líquida" | `QuoteModalCostCompositionTab.tsx:76-78` | deriva: `totalCliente - das - icms` | Baixo (derivação correta) |
| Mínimo Viável % | `QuoteDetailModal.tsx:249-252` | `profitability.profitMarginTarget` | Médio: sempre 15% (não salvo) |

---

## 2) Data Lineage verificado

### 2.1 Fluxo completo com evidências

```
calculate-freight/index.ts (Edge)
  L459:  frete_peso = baseCost
  L479:  ntc_base = frete_peso + frete_valor + gris + tso + dispatchFee
  L768:  custoMotorista = frete_peso        ← custo real do motorista
  L782:  custosCarreteiro = ntc_base        ← pacote NTC completo
  L824:  receitaLiquida = totalCliente - totalImpostos
  L887:  totals.receita_bruta = receitaLiquida  ← NOME ERRADO (bug existente)
  L896-909: profitability = {
    custos_carreteiro, custo_motorista,       ← ambos na resposta
    receita_liquida, regime_fiscal,           ← ambos na resposta
    profit_margin_target, ...
  }

buildStoredBreakdownFromEdgeResponse (useCalculateFreight.ts:121-213)
  L189-197: profitability = {
    custosCarreteiro:  custo_carreteiro   ✓
    custosDescarga:    custos_descarga    ✓
    custosDiretos:     custos_diretos     ✓
    margemBruta:       margem_bruta       ✓
    overhead:          overhead           ✓
    resultadoLiquido:  resultado_liquido  ✓
    margemPercent:     margem_percent     ✓
    custo_motorista:   --                 ✗ GAP 1
    receita_liquida:   --                 ✗ GAP 2
    profit_margin_target: --              ✗ GAP 3
    regime_fiscal:     --                 ✗ GAP 4
  }
  L206: rates.targetMarginPercent = 15    ← hardcoded (GAP 5)

QuoteDetailModal.tsx
  L211: receitaLiquidaView = profitability.receitaLiquida ?? null    → sempre null
  L218-220: custoMotoristaView = profitability.custoMotorista
              ?? custosCarreteiroView  → usa ntc_base
  L249-252: targetMargin = profitability.profitMarginTarget ?? 15   → sempre 15
```

### 2.2 Gaps confirmados

| Gap | Arquivo:linha | Campo Edge | Stored | Impacto |
|-----|------------|-----------|--------|---------|
| GAP 1 — custo_motorista | `useCalculateFreight.ts:189-197` | `profitability.custo_motorista` | ausente | Spread usa ntc_base em vez de frete_peso |
| GAP 2 — receita_liquida | `useCalculateFreight.ts:189-197` | `profitability.receita_liquida` | ausente | Mini-card nunca aparece |
| GAP 3 — profit_margin_target | `useCalculateFreight.ts:189-197` | `profitability.profit_margin_target` | ausente | Meta de margem sempre 15% |
| GAP 4 — regime_fiscal | `useCalculateFreight.ts:189-197` | `profitability.regime_fiscal` | ausente | Alerta regime fiscal nunca aparece |
| GAP 5 — targetMarginPercent hardcode | `useCalculateFreight.ts:206` | — | `15` fixo | Idem GAP 3 |
| BUG NOME — receita_bruta | `calculate-freight/index.ts:887` | `totals.receita_bruta = receitaLiquida` | `totals.receitaBruta` = líquido | Linha "Receita Bruta" na Memória mostra valor errado |

---

## 3) Bugs confirmados

### 3.1 Spread "Custo pago ao motorista" = ntc_base (CRÍTICO — P0)

**Causa raiz**: GAP 1 — `custo_motorista` não é mapeado pelo builder.

Prova:
- `calculate-freight/index.ts:479`: `ntc_base = frete_peso + frete_valor + gris + tso + dispatchFee`
- `calculate-freight/index.ts:768`: `custoMotorista = frete_peso` ← só o frete peso
- `calculate-freight/index.ts:782`: `custosCarreteiro = ntc_base`
- `useCalculateFreight.ts:189-197`: builder NÃO mapeia `custo_motorista`
- `QuoteDetailModal.tsx:218-220`: `custoMotoristaView = profitability.custoMotorista ?? custosCarreteiroView` → usa `ntc_base`
- `QuoteModalLogisticsGrid.tsx:159-162`: label "Custo (pago ao motorista)" exibe `ntc_base / km`

**Consequência**: `ntc_base` inclui GRIS + TSO + frete_valor + dispatchFee que o motorista não recebe.
Spread exibido = `(totalCliente - ntc_base) / km` < `(totalCliente - frete_peso) / km` real.

**Agravante — inconsistência DRE vs Spread**:
- `QuoteModalCostCompositionTab.tsx:84`: `custoEfetivoMotorista = baseFreight` = `frete_peso`
- DRE mostra `frete_peso` como "Custo Motorista (Frete Base)"
- Spread mostra `ntc_base` como "Custo (pago ao motorista)"
- Mesmo conceito, valores diferentes, visíveis na mesma tela.

---

### 3.2 Mini-card "Receita Líquida" nunca aparece (CRÍTICO — P1)

**Causa raiz**: GAP 2 — `receita_liquida` não mapeada pelo builder.

Prova:
- `calculate-freight/index.ts:902`: `profitability.receita_liquida = receitaLiquida` ← presente na resposta Edge
- `useCalculateFreight.ts:189-197`: NÃO mapeado
- `QuoteDetailModal.tsx:210-211`: `receitaLiquidaView = breakdown.profitability.receitaLiquida ?? null` → `null`
- `QuoteModalFinancialSummary.tsx:37`: `{receitaLiquida != null && ...}` → bloco nunca renderiza
- Grid sempre 2 colunas (Faturamento Bruto + Resultado Líquido)

Nota: a aba DRE ainda exibe "Receita Líquida" por derivação (`totalCliente - das - icms`, `QuoteModalCostCompositionTab.tsx:76-78`). Correto matematicamente.

---

### 3.3 totals.receita_bruta armazena valor líquido (MÉDIO — P1)

Prova:
- `calculate-freight/index.ts:887`: `totals.receita_bruta: receitaLiquida` ← nome vs conteúdo divergem
- `useCalculateFreight.ts:181`: `receitaBruta: response.totals.receita_bruta` ← propaga
- `QuoteModalCostCompositionTab.tsx:180-183`: linha "Receita Bruta" na aba Memória exibe `receitaBruta` = valor líquido

Impacto visual: usuário vê "Receita Bruta = R$ X" onde X é pós-DAS/ICMS.

---

### 3.4 targetMarginPercent sempre 15% (MÉDIO — P2)

Prova:
- `calculate-freight/index.ts:907`: `profit_margin_target: profitMarginPercent` ← na resposta
- `useCalculateFreight.ts:189-197`: NÃO mapeado
- `useCalculateFreight.ts:206`: `targetMarginPercent: 15` hardcoded
- `QuoteDetailModal.tsx:74`: `const TARGET_MARGIN_PERCENT = 15`
- `QuoteDetailModal.tsx:249-252`: tentativa de ler campo, mas nunca achado → sempre 15

---

### 3.5 Alerta regime fiscal nunca aparece no DRE (BAIXO — P3)

Prova:
- `calculate-freight/index.ts:908`: `regime_fiscal: regimeFiscal` ← na resposta
- `useCalculateFreight.ts:189-197`: NÃO mapeado
- `QuoteModalCostCompositionTab.tsx:79-83`: `regimeFiscal = breakdown.profitability.regimeFiscal` → undefined
- `QuoteModalCostCompositionTab.tsx:213-232`: `{regimeFiscal && ...}` → nunca renderiza

---

### 3.6 Badge de margem — comportamento OK (REFUTADO)

- `useCalculateFreight.ts:196`: `margemPercent` IS mapeado ✓
- `QuoteDetailModal.tsx:397`: `invalidateQueries(['quotes'])` dispara refetch ✓
- Sem useMemo/cache estale nos derivados ✓
- "Badge não muda" → causa: input idêntico → Edge retorna mesmo resultado.

---

### 3.7 DRE — line items não reconciliam com Resultado Líquido (BAIXO/COSMÉTICO — P4)

Edge: `resultadoLiquido = receitaLiquida - overhead - ntc_base - descarga`
onde `ntc_base = frete_peso + frete_valor + gris + tso + dispatchFee`

DRE exibe adicionalmente: toll, tde, tear, aluguel (fora do ntc_base).
Somar linhas do DRE dá valor diferente do badge "Resultado Líquido" (que usa o valor salvo).
O badge está correto; o DRE é informativo mas não reconcilia.

---

## 4) Semântica do "custo"

| Conceito | Cálculo na Edge | Path no Stored | Spread | DRE |
|----------|----------------|----------------|--------|-----|
| frete_peso | `baseCost` | `components.baseFreight` ✓ | Não (deveria) | Sim (`custoEfetivoMotorista`) |
| ntc_base | `frete_peso + frete_valor + gris + tso + dispatchFee` | `profitability.custosCarreteiro` ✓ | Sim (fallback indevido) | Não como total |
| custo_motorista | alias de `frete_peso` | **ausente** (GAP 1) | via fallback = ntc_base | via `baseFreight` |
| Piso ANTT | `pisoAnttCarreteiro` | `meta.antt.total` (manual) | Não | Sim (tab Custos) |

---

## 5) Risk Register

| Sintoma | Status | P | Causa Raiz | Fix |
|---------|--------|---|------------|-----|
| Spread "Custo motorista" = ntc_base | CONFIRMADO | 0 | GAP 1 builder | Mapear `custo_motorista` |
| DRE "Custo Motorista" ≠ Spread "Custo" | CONFIRMADO | 0 | Idem GAP 1 | Idem |
| Mini-card "Receita Líquida" ausente | CONFIRMADO | 1 | GAP 2 builder | Mapear `receita_liquida` |
| "Receita Bruta" Memória = valor líquido | CONFIRMADO | 1 | Bug nome Edge L887 | Corrigir Edge + atualizar consumidores |
| Meta margem sempre 15% | CONFIRMADO | 2 | GAP 3+5 builder | Mapear `profit_margin_target` |
| Alerta regime fiscal ausente | CONFIRMADO | 3 | GAP 4 builder | Mapear `regime_fiscal` |
| Badge margem "não muda" | REFUTADO | — | Input idêntico | — |
| DRE linhas não reconciliam | CONFIRMADO | 4 | Cosmético | Nota ou refatorar DRE |

---

## 6) Plano de correção

### Opção A — Copiar campos faltantes no builder (RECOMENDADA)

Em `useCalculateFreight.ts:189-197`, adicionar ao bloco `profitability`:

```ts
custoMotorista:     response.profitability.custo_motorista,        // GAP 1
receitaLiquida:     response.profitability.receita_liquida,        // GAP 2
profitMarginTarget: response.profitability.profit_margin_target,   // GAP 3
regimeFiscal:       response.profitability.regime_fiscal,          // GAP 4
```

Em `useCalculateFreight.ts:206`, corrigir:
```ts
targetMarginPercent: response.profitability.profit_margin_target ?? 15,  // GAP 5
```

Para o bug de nome na Edge (`calculate-freight/index.ts:887`):
```ts
// Antes:
receita_bruta: receitaLiquida,
// Depois:
receita_bruta: receitaBruta,  // valor pre-impostos
```
> Atenção: corrigir receita_bruta na Edge requer atualizar `QuoteModalCostCompositionTab.tsx:75,180` e todos os consumidores do campo.

### Opção B — Stopgap: ajustar labels na UI

- `QuoteModalLogisticsGrid.tsx:159`: trocar "Custo (pago ao motorista)" por "Custo NTC (Carreteiro)"
- Não corrige inconsistência DRE vs Spread, mas remove expectativa errada

---

## 7) Checklist pós-fix

- [ ] Após Recalcular, mini-card "Receita Líquida" aparece
- [ ] Spread "Custo" = `frete_peso / km` (não `ntc_base / km`)
- [ ] DRE "Custo Motorista" = Spread "Custo" (mesma fonte)
- [ ] Alerta "Abaixo do Mínimo" usa `profit_margin_target` da regra
- [ ] DRE mostra alerta de regime fiscal correto
- [ ] Linha "Receita Bruta" na Memória exibe valor pré-impostos
- [ ] `kmDistance = 0` não divide por zero (já guardado — manter)
- [ ] Quotes legadas sem `profitability` → fallbacks defensivos funcionam

---

## 8) data-testid sugeridos

- `quote-metric-gross-revenue` — Faturamento Bruto
- `quote-metric-net-revenue` — Receita Líquida (só renderiza com GAP 2 corrigido)
- `quote-metric-net-result` — Resultado Líquido
- `quote-metric-margin-badge` — Badge margem %
- `quote-spread-sale-per-km`
- `quote-spread-cost-per-km`
- `quote-spread-spread-per-km`

---

## 9) Search Log (audit trail)

| Arquivo / busca | Linhas relevantes |
|----------------|------------------|
| `QuoteDetailModal.tsx` | L142, 194, 209-253, 389-403, 579-602 |
| `QuoteModalFinancialSummary.tsx` | L28, 37, 67-69 |
| `QuoteModalLogisticsGrid.tsx` | L130-173 |
| `QuoteModalCostCompositionTab.tsx` | L75-84, 180-183, 293-298 |
| `useCalculateFreight.ts` | L121-213 |
| `calculate-freight/index.ts` | L459, 479, 768, 782, 824, 887, 896-909 |
| `freight-types.ts` | L130-152 (campos opcionais: custo_motorista?, receita_liquida?) |
| Grep `custo_motorista\|receita_liquida` em `supabase/functions` | Presentes na Edge; ausentes no builder |
| Grep `ntc_base\|frete_peso` em `calculate-freight/index.ts` | ntc_base = frete_peso + frete_valor + gris + tso + dispatchFee |

---

## 10) Lacunas restantes

- [ ] Reprodução numérica com 1 quote real (seção 0.1) — depende de acesso ao banco.
- [ ] Quotes legadas com `pricing_breakdown` sem campo `profitability` — shape antigo.
- [ ] E2E seeded: "Recalcular → mini-card Receita Líquida aparece" (após GAP 2 corrigido).
- [ ] Impacto total de corrigir `totals.receita_bruta` na Edge — mapear todos os consumidores.
- [ ] `FreightSimulator.tsx` — verificar se consome `buildStoredBreakdownFromEdgeResponse` ou resposta direta.

---

## 11) Resumo executivo

| P | Problema | Onde corrigir |
|---|---------|--------------|
| P0 | Spread "Custo motorista" usa `ntc_base` (inclui seguros NTC) em vez de `frete_peso` | `useCalculateFreight.ts:189` — adicionar `custoMotorista` |
| P0 | DRE usa `frete_peso`; Spread usa `ntc_base` — inconsistência visível | idem |
| P1 | Mini-card "Receita Líquida" nunca aparece | `useCalculateFreight.ts:189` — adicionar `receitaLiquida` |
| P1 | Linha "Receita Bruta" na Memória exibe valor líquido | `calculate-freight/index.ts:887` — corrigir nome |
| P2 | Meta de margem sempre 15%, ignora `pricing_rules_config` | `useCalculateFreight.ts:189,206` — mapear `profit_margin_target` |
| P3 | Alerta regime fiscal nunca aparece no DRE | `useCalculateFreight.ts:189` — mapear `regime_fiscal` |
| P4 | DRE line items não reconciliam com Resultado Líquido | Cosmético — documentar |
