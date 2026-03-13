---
plan_number: 02
plan_slug: plan-02-metodologia-precificacao-lotacao-vs-fracionado
version: v0.2.0
role: Analista de Produto + Engenheiro(a) de Software (Supabase + TypeScript)
focus: Metodologia de Precificação (Lotação vs Fracionado)
created_at: 2026-03-06
supersedes: v0.1.0
change_type: minor
schema_tables_used:
  - price_tables
  - price_table_rows
  - quotes
  - orders
  - payment_terms
  - pricing_parameters
  - pricing_rules_config
  - conditional_fees
  - icms_rates
  - antt_floor_rates
  - tac_rates
  - ltl_parameters
  - waiting_time_rules
  - vehicle_types
code_entrypoints:
  - supabase/functions/calculate-freight/index.ts
  - supabase/functions/_shared/freight-schema.ts
  - supabase/functions/_shared/freight-types.ts
  - supabase/functions/price-row/index.ts
  - supabase/functions/calculate-distance-webrouter/index.ts
  - src/lib/freightCalculator.ts
  - src/hooks/useCalculateFreight.ts
  - src/hooks/usePriceTableRows.ts
  - src/hooks/usePricingRules.ts
  - src/components/forms/QuoteForm.tsx
  - src/components/forms/quote-form/QuoteFormWizard.tsx
  - src/components/modals/QuoteDetailModal.tsx
  - src/components/pricing/FreightSimulator.tsx
---

## Plan 02 — Metodologia de Precificação (Lotação vs Fracionado) — v0.2.0

### O que mudou da v0.1.0 → v0.2.0

- **Nova seção**: Provas negativas (busquei e NÃO encontrei uso de `min_freight`, `min_freight_cargo_limit`, `ltl_parameters.cubage_factor`, `ltl_parameters.correction_factor`, `toll_routes` no motor; origem de `tollPlazas` documentada).
- **Nova subseção**: Contrato de precedência (fonte da verdade) para modalidade.
- **Evidências estáveis**: referências por arquivo + função + trecho completo, sem dependência de line numbers frágeis; trechos truncados corrigidos.
- **Dicionário de configuração**: regerado por grep em `calculate-freight/index.ts` (paramsMap.get, resolveRule, resolveRulePercent).
- **Pedágio**: evidência de `calculate-distance-webrouter` e `extractTollPlazas`; `code_entrypoints` atualizado.
- **MRE**: payloads reprodutíveis com `payment_term_code`, `toll_value` explícitos, pré-condições e campos esperados.
- **Matriz TS vs Edge**: separação (A) rounding/validação interna do TS vs (B) seleção de faixa via hook/REST/Edge.

---

### 1. Sumário executivo

O motor de precificação consolida uma metodologia única para cálculo de frete, diferenciando **Lotação (FTL)** e **Fracionado (LTL)** a partir de `price_tables.modality` (`'lotacao'` ou `'fracionado'`), utilizando sempre a mesma base de entrada (origem, destino, distância, peso, volume, valor da carga, tabela de preços e parâmetros fiscais) e compondo um `CalculateFreightResponse` com `meta`, `components`, `rates`, `totals` e `profitability`, que é persistido em `quotes.pricing_breakdown` (e, indiretamente, em `orders` e documentos financeiros), permitindo auditoria completa do cálculo.

---

### 2. Contrato de precedência (fonte da verdade) — Modalidade

#### Evidência: Edge usa exclusivamente `price_tables.modality`

- **Schema de input** — `supabase/functions/_shared/freight-schema.ts` → `calculateFreightInputSchema`:
  - O schema **não inclui** `modality` nem `freight_modality`. Campos aceitos: `origin`, `destination`, `km_distance`, `weight_kg`, `volume_m3`, `cargo_value`, `toll_value`, `price_table_id`, `vehicle_type_code`, `payment_term_code`, etc.
- **Cálculo** — `supabase/functions/calculate-freight/index.ts` → handler principal:
  - Inicializa `modality = 'lotacao'`.
  - Se `input.price_table_id` definido: `supabase.from('price_tables').select('modality').eq('id', input.price_table_id)`; se `ptData?.modality === 'fracionado'`, define `modality = 'fracionado'`.
  - **Conclusão**: a Edge nunca lê modalidade do payload; usa exclusivamente `price_tables.modality` associada à tabela selecionada.

#### Evidência: TS local usa `input.modality` do formulário

- **Origens** — `src/components/forms/QuoteForm.tsx`:
  - O formulário possui campo `freight_modality` (watch em L415–416).
  - O objeto debounced inclui `freightModality: (stable[8])` e é repassado ao cálculo local como `modality`.
- **Cálculo** — `src/lib/freightCalculator.ts` → `calculateFreight`:
  - `input.modality === 'fracionado'` em L699 (ltlMinWeightApplied) e L706 (isLtl).
  - `input.modality` é o valor vindo do form (`debounced.freightModality`).

#### Risco de drift

- Se o usuário seleciona `freight_modality=lotacao` e uma tabela com `price_tables.modality=fracionado`:
  - **TS**: Lotação (sem `dispatch_fee`, sem min 1000 kg LTL).
  - **Edge** (ao recalcular em `QuoteDetailModal` ou ao criar ordem): Fracionado (`dispatch_fee`, min 1000 kg).
  - Resultado divergente entre cálculo local e resposta da Edge.
- Fluxo onde isso ocorre: `QuoteForm` → cálculo local com `freight_modality`; `QuoteDetailModal` → `useCalculateFreight` envia `price_table_id` sem `modality`, e a Edge deriva de `price_tables.modality`.

#### Recomendação operacional (sem alterar código)

- No client: derivar `modality` a partir da tabela selecionada (`price_tables.modality`) e validar que o campo de formulário `freight_modality` seja igual antes de permitir envio; ou exibir aviso quando divergir.

---

### 3. Metodologia LOTAÇÃO (FTL)

#### 3.1 Inputs e campos usados

- **Entrada HTTP (Edge Function)** — `supabase/functions/calculate-freight/index.ts`:
  - Validação via `calculateFreightInputSchema` em `../_shared/freight-schema.ts`:
    - Obrigatórios: `origin`, `destination`, `km_distance`, `weight_kg`, `volume_m3`, `cargo_value`.
    - Opcionais: `toll_value`, `price_table_id`, `vehicle_type_code`, `payment_term_code`, `tde_enabled`, `tear_enabled`, `conditional_fees[]`, `waiting_hours`, `das_percent`, `markup_percent`, `overhead_percent`, `carreteiro_percent`, `descarga_value`, `aluguel_maquinas_value`.
- **Campos relevantes em Supabase** (consultados na Edge Function): `pricing_rules_config`, `pricing_parameters`, `vehicle_types`, `price_tables`, `price_table_rows`, `ltl_parameters`, `conditional_fees`, `waiting_time_rules`, `antt_floor_rates`, `icms_rates`, `tac_rates`, `payment_terms`.
- **Persistência** — `QuoteForm.tsx`: `quotes.weight`, `quotes.volume`, `quotes.cubage_weight`, `quotes.billable_weight`, `quotes.price_table_id`, `quotes.vehicle_type_id`, `quotes.payment_term_id`, `quotes.km_distance`, `quotes.toll_value`, `quotes.cargo_value`, `quotes.value`, `quotes.pricing_breakdown` recebem valores do cálculo local (`calculateFreight` + `buildStoredBreakdown`).

#### 3.2 Seleção da faixa de km (Lotação)

- **Edge** — `calculate-freight/index.ts` → handler:
  - `kmBand = Math.ceil(Number(input.km_distance))`; `kmBandUsed = kmBand`.
  - Consulta: `price_table_rows` com `price_table_id`, ordenado por `km_from`.
  - Seleção: `r.km_from <= kmBand && r.km_to >= kmBand`.
- **Hook/REST (B)** — `usePriceTableRows.ts` → `usePriceTableRowByKmRange`:
  - Recebe `kmDistance` (no QuoteForm, `debouncedKmBand = Math.ceil(Number(debounced.kmDistance || 0))`).
  - Query: `.lte('km_from', kmRounded).gte('km_to', kmRounded)` com `kmRounded = Math.round(kmDistance)` (o valor recebido já é ceil no QuoteForm).
- **TS interno (A)** — `freightCalculator.ts` → `calculateFreight`:
  - `kmBandUsed = Math.round(Number(input.kmDistance || 0))` para validação da faixa.
  - Condição: `kmBandUsed < kmFrom || kmBandUsed > kmTo` → OUT_OF_RANGE.
  - **Divergência**: TS usa `Math.round` para validação; Edge usa `Math.ceil` para seleção. Para km 500,3: Edge encontra faixa 501–1000; TS pode rejeitar se row tiver `km_from=501` (500 < 501).

#### 3.3 Peso faturável (Lotação)

- **Edge** — `calculate-freight/index.ts`:
  - `cubageFactor = paramsMap.get('cubage_factor') ?? FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3`.
  - `cubageWeightKg = volume_m3 * cubageFactor`; `billableWeightKg = max(weight_kg, cubageWeightKg)`.
  - Lotação: sem trava de 1.000 kg.
- **TS** — `freightCalculator.ts` → `calculateFreight`:
  - Mesma lógica; trava 1.000 kg apenas se `input.modality === 'fracionado'`.

#### 3.4 Cálculo base Lotação

- **Edge** — ramo Lotação:
  - `costPerTon = priceRow.cost_per_ton || 0`.
  - `baseCost = (billableWeightKg / 1000) * costPerTon`.
- **TS** — `freightCalculator.ts`:
  - Se `row.cost_per_ton > 0`: `baseCost = (billableWeightKg/1000) * cost_per_ton`; senão: `baseCost = billableWeightKg * cost_per_kg`.

#### 3.5 Pedágio e tollPlazas

- **Motor** — `calculate-freight/index.ts` → handler:
  - `toll = input.toll_value ?? 0`. Não há cálculo de pedágio dentro do motor.
- **Origem de tollPlazas** — `supabase/functions/calculate-distance-webrouter/index.ts`:
  - Função `extractTollPlazas(rota)` extrai praças de `rota.informacaoPedagios.result.pedagios`.
  - Resposta inclui `toll_plazas`, `km_distance`, `toll` (custos.pedagio).
  - O client (`QuoteForm`, `OrderDetailModal`) chama essa Edge para rota e preenche `toll_value` e `meta.tollPlazas` em `pricing_breakdown` via `buildStoredBreakdownFromEdgeResponse`.
- **toll_routes**: consumida por `useTollRoutes` em `usePricingRules.ts` e por `usePricingMutations.ts` para CRUD administrativo; **não entra no motor** `calculate-freight`.

#### 3.6 Adicionais Lotação

- **GRIS, TSO e frete valor** — `calculate-freight/index.ts`:
  - Resolução via `resolveRulePercent` (gris_percent, tso_percent, cost_value_percent); precedência: Central > linha km > default.
  - Fórmulas: gris = cargo_value × (grisPercent/100); tso = cargo_value × (tsoPercent/100); frete_valor = cargo_value × (costValuePercent/100).
- **Despacho**: Lotação: `dispatchFee = 0`.
- **Taxas condicionais** — lidas de `conditional_fees`; base: cargo_value ou conditionalFeeFreightBase.
- **Estadia** — `waiting_time_rules` por vehicle_type_id; fallback 5h franquia, R$146,44/h.

#### 3.7 Impostos e ajustes (Lotação)

- **DAS, markup, overhead, margem** — paramsMap + resolveRule; flags regimeSimplesNacional, excessoSublimite.
- **ICMS** — icms_rates(origin_state, destination_state); fallback icms_default; isSimples força 0.
- **TAC** — tac_rates por reference_date; tacPercent por steps de 5%; tacAdjustment = frete_peso × (tacPercent/100).
- **Prazo** — payment_terms.adjustment_percent; paymentAdjustmentPercent → totals.

#### 3.8 Markup, overhead, margem (Lotação)

- **Gross-up híbrido** — taxaBruta; se taxaBruta >= 1: modelo por fora; senão: totalCliente = custosDiretos/(1-taxaBruta).
- **custoServicos**, **custosCarreteiro** (ntc_base), **custosDescarga**, **margemPercent**, **marginStatus**.

#### 3.9 Piso ANTT e status

- **Piso** — antt_floor_rates por axes_count, km; pisoAnttCarreteiro em meta.
- **Status** — OK, OUT_OF_RANGE, MISSING_DATA; persistência em QuoteForm, QuoteDetailModal.

---

### 4. Metodologia FRACIONADO (LTL)

#### 4.1 Detecção de modalidade

- **Backend**: `price_tables.modality = 'fracionado'` para o `price_table_id` informado.

#### 4.2 Parâmetros LTL (ltl_parameters)

- **Usados**: `gris_percent`, `gris_min`, `gris_min_cargo_limit`, `min_tso`, `dispatch_fee`.
- **Não usados** (ver Provas negativas): `min_freight`, `min_freight_cargo_limit`, `cubage_factor`, `correction_factor`.

#### 4.3 Peso faturável e trava de 1t

- Edge e TS: se fracionado e `billableWeightKg < 1000` → `billableWeightKg = 1000`; `ltl_min_weight_applied`, `original_weight_kg`.

#### 4.4 Seleção de faixa km e peso

- **km**: mesma lógica que Lotação (ceil, price_table_rows).
- **Peso LTL**: `getLtlWeightColumn(billableWeightKg)` → weight_rate_10..200 ou weight_rate_above_200; `baseCost = billableWeightKg × ratePerKg`.

#### 4.5 Adicionais Fracionado

- **dispatch_fee**: `ltlParams?.dispatch_fee ?? 102.9`.
- **GRIS/TSO**: precedência Central > linha > ltlParams (GRIS) > default; mínimos NTC (gris_min, min_tso) aplicados.

#### 4.6 Impostos, markup e persistência

- Mesma lógica de Lotação; persistência idêntica.

---

### 5. Provas negativas (busquei e NÃO encontrei)

Para cada item, busquei no repo e registrei o resultado.

| Item | Busca realizada | Resultado |
|------|-----------------|-----------|
| `ltl_parameters.min_freight` | Grep em `calculate-freight` e `freightCalculator` | Carregado em `ltlParams` (L310–311), **não entra em fórmula**. Nenhum `baseCost = max(baseCost, min_freight)` ou similar. |
| `ltl_parameters.min_freight_cargo_limit` | Idem | Carregado (L311), **não usado**. Deveria condicionar aplicação de `min_freight` (ex.: `if cargo_value <= min_freight_cargo_limit`). |
| `ltl_parameters.cubage_factor` | Grep em todo o repo | `ltl_parameters` tem coluna `cubage_factor` em `migration_fracionado.sql`. O motor usa `paramsMap.get('cubage_factor')` de `pricing_parameters`, **não** `ltl_parameters.cubage_factor`. |
| `ltl_parameters.correction_factor` | Idem | `calculate-freight` usa `paramsMap.get('correction_factor_inctf')` de `pricing_parameters`. `ltl_parameters.correction_factor` **não é referenciado**. |
| `toll_routes` no motor | Grep `toll_routes` em `calculate-freight` | **Não encontrado**. `toll_routes` é usada por `usePricingRules`, `usePricingMutations` (admin) e migrations; motor usa só `input.toll_value`. |
| Origem de `tollPlazas` | Grep `tollPlazas`, `extractTollPlazas`, `toll_plazas` | `calculate-distance-webrouter` → `extractTollPlazas(rota)`; retorna em `data.toll_plazas`. Client persiste em `meta.tollPlazas` via `buildStoredBreakdownFromEdgeResponse`. |

**Efeito esperado não implementado** (onde deveria entrar):

- `min_freight` / `min_freight_cargo_limit`: na etapa de base cost LTL, aplicar `baseCost = max(baseCost, min_freight)` quando `cargo_value <= min_freight_cargo_limit`.
- `ltl_parameters.cubage_factor`: se o fracionado tivesse fator próprio, deveria sobrescrever `pricing_parameters.cubage_factor` no branch LTL.
- `ltl_parameters.correction_factor`: idem para gross-up/conditional fees, se NTC prever fator específico LTL.
- `toll_routes`: se existir pipeline para somar pedágios por rota, poderia alimentar `input.toll_value` antes da chamada; hoje é manual.

---

### 6. Dicionário de configuração (derivado por grep)

Extraído de `supabase/functions/calculate-freight/index.ts`.

#### pricing_parameters (paramsMap.get)

| key | Fallback | Outputs afetados |
|-----|----------|------------------|
| `cubage_factor` | FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3 (300) | cubageWeightKg, billableWeightKg |
| `correction_factor_inctf` | 1.0 | conditional fees base, gross-up |
| `das_percent` | via resolveRule/default | das, totals |
| `markup_percent` | via resolveRule | gross-up |
| `overhead_percent` | via resolveRule | profitability.overhead |
| `profit_margin_percent` | via resolveRule | meta.margin_percent |
| `carreteiro_percent` | 0 | profitability.custosCarreteiro |
| `das_provision_min_value` | 0 | das provision floor |

#### pricing_rules_config (resolveRule / resolveRulePercent)

| key | Uso | Outputs afetados |
|-----|-----|------------------|
| `das_percent` | resolveRule | rates.das_percent |
| `markup_percent` | resolveRule | gross-up |
| `overhead_percent` | resolveRule | overhead |
| `profit_margin_percent` | resolveRule | meta.margin_percent |
| `regime_simples_nacional` | resolveRule | icms = 0 se Simples |
| `excesso_sublimite` | resolveRule | icms quando Simples com excesso |
| `icms_default` | resolveRule | icms fallback |
| `icms_uf_XX` | via map de regras | icms por UF |
| `gris_percent` | resolveRulePercent | gris |
| `tso_percent` | resolveRulePercent | tso |
| `cost_value_percent` | resolveRulePercent | frete_valor |

#### payment_terms

| coluna | Onde lido | Uso |
|--------|-----------|-----|
| `adjustment_percent` | select por `payment_term_code` | `payment_adjustment_percent` → totals.payment_adjustment |
| `advance_percent` | Não lido em calculate-freight | Usado em QuoteDetailModal, CarreteiroTab, process-payment-proof |
| `days` | Não entra no motor | Exibição e email |

---

### 7. MRE (Mínimo reprodutível)

**Pré-condições**: `price_table_rows` cobre `kmBand` (ceil do km); `payment_terms` com código `D30` existente; tabela Lotação/Fracionado conforme exemplo.

**Exemplo 1 — Lotação**

```json
{
  "origin": "São Paulo, SP",
  "destination": "Rio de Janeiro, RJ",
  "km_distance": 450,
  "weight_kg": 5000,
  "volume_m3": 10,
  "cargo_value": 50000,
  "toll_value": 0,
  "price_table_id": "<uuid-tabela-lotacao>",
  "vehicle_type_code": "VUC",
  "payment_term_code": "D30"
}
```

**Esperado**: `success: true`, `status: OK`, `meta.km_status: OK`, `meta.km_band_label` (ex.: "0-500"), `components.base_cost > 0`, `components.dispatch_fee: 0`, `totals.total_cliente > 0`, `rates.payment_adjustment_percent` conforme D30.

**Exemplo 2 — Fracionado**

```json
{
  "origin": "São Paulo, SP",
  "destination": "Rio de Janeiro, RJ",
  "km_distance": 450,
  "weight_kg": 200,
  "volume_m3": 2,
  "cargo_value": 10000,
  "toll_value": 0,
  "price_table_id": "<uuid-tabela-fracionado>",
  "vehicle_type_code": "VUC",
  "payment_term_code": "D30"
}
```

**Esperado**: `success: true`, `status: OK`, `meta.billable_weight_kg: 1000` (min LTL), `meta.ltl_min_weight_applied: true`, `components.dispatch_fee > 0`.

---

### 8. Matriz TS vs Edge (A vs B)

| Item | (A) TS interno `freightCalculator` | (B) Seleção faixa (hook/REST/Edge) | Resultado |
|------|-----------------------------------|-----------------------------------|-----------|
| **km rounding** | `kmBandUsed = Math.round(Number(input.kmDistance))` para validação | Edge: `kmBand = Math.ceil(km_distance)`; QuoteForm passa `Math.ceil` a `usePriceTableRowByKmRange` | **Diferente**: (A) round pode rejeitar faixa que (B) aceita (ex.: 500,3 → ceil 501 vs round 500). |
| **price_table_row** | Recebe row já selecionado; valida `kmFrom <= kmBandUsed <= kmTo` | Edge: filtra em memória com ceil; REST: `lte('km_from',km).gte('km_to',km)` com km passado pelo QuoteForm (ceil) | (B) alinhado; (A) pode divergir na validação. |
| **min weight LTL** | `input.modality === 'fracionado' && billableWeightKg < 1000 → 1000` | Idêntico | **Igual** |
| **base cost Lotação** | `(billableWeightKg/1000)*cost_per_ton` ou `billableWeightKg*cost_per_kg` | `(billableWeightKg/1000)*costPerTon` | **Igual** |
| **base cost LTL** | `billableWeightKg * ratePerKg` via `getLtlWeightColumn` | Idêntico | **Igual** |
| **dispatch_fee** | `input.ltlParams?.dispatchFee ?? 102.9` | `ltlParams?.dispatch_fee ?? 102.9` | **Igual** |
| **correction factor** | `params.correctionFactor` (resolveParams → pricing_parameters) | `paramsMap.get('correction_factor_inctf') ?? 1.0` | **Igual** |
| **impostos** | Mesma lógica via resolveParams | paramsMap + resolveRule | **Igual** |

---

### 9. Tabela comparativa Lotação vs Fracionado

| Aspecto                         | Lotação (FTL)                                                                                                                                              | Fracionado (LTL)                                                                                                                                                                      |
|---------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Base de custo**               | `baseCost = (billableWeightKg / 1000) * cost_per_ton` (ou `billableWeightKg * cost_per_kg`) a partir de `price_table_rows.cost_per_ton/kg`.   | `baseCost = billableWeightKg * ratePerKg`, onde `ratePerKg` vem de `weight_rate_10..200` ou `weight_rate_above_200` (NTC LTL Dez/25).                          |
| **Peso / cubagem**             | `billableWeightKg = max(weight_kg, volume_m3 * cubageFactor)`, sem trava mínima.          | Mesma fórmula, mas com trava de 1.000 kg; `ltl_min_weight_applied`, `original_weight_kg`. |
| **Faixa de km**                | `kmBand = ceil(km_distance)`, seleção por `km_from <= kmBand <= km_to`.                    | Idêntico.                                                |
| **Mínimos / gatilhos NTC**     | Não há mínimos explícitos além do piso ANTT; `das_provision_min_value` pode impor mínimo.                          | Mínimos em `gris` (`gris_min`/`gris_min_cargo_limit`) e `tso` (`min_tso`); `min_freight`/`min_freight_cargo_limit` existem mas não são aplicados. |
| **Impostos e ajustes**         | DAS, markup, overhead, profit_margin, icms, tac, payment_adjustment; gross-up híbrido. | Mesma lógica.                                                                                   |
| **Conditional fees & waiting** | conditional_fees; waiting_time_rules. | Idêntico.                         |
| **Despacho (dispatch_fee)**    | `dispatchFee = 0`.                                                                                                               | `dispatchFee = ltlParams.dispatch_fee` ou 102,9 R$/CTe.                                                        |
| **Piso ANTT carreteiro**       | Calculado por axesCount e km_distance.     | Mesmo cálculo disponível.                                       |
| **Persistência em quotes**   | `pricing_breakdown`, `value`, `toll_value`, `billable_weight`, `cubage_weight`, etc.     | Mesmos campos; modalidade inferida via `price_tables.modality` e `freight_modality`.                             |

---

### 10. Mapa de Código

- **`supabase/functions/calculate-freight/index.ts`** — Handler principal; valida payload, lê tabelas, calcula frete, retorna `CalculateFreightResponse`.
- **`supabase/functions/_shared/freight-schema.ts`** — `calculateFreightInputSchema` (Zod); não inclui `modality` nem `freight_modality`.
- **`supabase/functions/_shared/freight-types.ts`** — Tipos e helpers (extractUf, formatRouteUf, normalizeIcmsRate, etc.).
- **`supabase/functions/price-row/index.ts`** — Edge para localizar `price_table_rows` por km com rounding configurável.
- **`supabase/functions/calculate-distance-webrouter/index.ts`** — Calcula distância e pedágio; `extractTollPlazas(rota)` → `rota.informacaoPedagios.result.pedagios`; retorna `km_distance`, `toll`, `toll_plazas`, `km_by_uf`.
- **`src/lib/freightCalculator.ts`** — Cálculo local TS; usa `input.modality`; `kmBandUsed = Math.round` para validação.
- **`src/hooks/useCalculateFreight.ts`** — Chama Edge; `buildStoredBreakdownFromEdgeResponse` preserva `meta.tollPlazas`.
- **`src/hooks/usePriceTableRows.ts`** — `usePriceTableRowByKmRange` (REST); `usePriceTableRowByKmFromEdgeFn` (Edge price-row).
- **`src/hooks/usePricingRules.ts`** — Fornece pricing_parameters, toll_routes, etc.; toll_routes não entra no motor.
- **`src/components/forms/QuoteForm.tsx`** — Orquestra inputs; `debouncedKmBand = Math.ceil`; salva `pricing_breakdown`.
- **`src/components/forms/quote-form/QuoteFormWizard.tsx`** — Gating por `calculationResult.status`, `priceTableRow`.
- **`src/components/modals/QuoteDetailModal.tsx`** — Recalcula via Edge; exibe `tollPlazas` de `breakdown.meta.tollPlazas`.
- **`src/components/pricing/FreightSimulator.tsx`** — UI analítica; sem persistência.

---

### 11. Gaps, dúvidas e riscos

1. **Mínimos de frete LTL (`min_freight`, `min_freight_cargo_limit`) não aplicados** — Carregados em ltlParams; nenhuma lógica os utiliza. Deveria aplicar `baseCost = max(baseCost, min_freight)` quando `cargo_value <= min_freight_cargo_limit`.
2. **`ltl_parameters.correction_factor` não usado** — Motor usa `pricing_parameters.correction_factor_inctf`; alinhar ou descontinuar.
3. **`ltl_parameters.cubage_factor` não usado** — Motor usa `pricing_parameters.cubage_factor`; campo em LTL pode estar obsoleto.
4. **`toll_routes` não entra no motor** — Usada em admin; motor usa só `input.toll_value`. Avaliar pipeline que some pedágios por rota.
5. **Origem de `tollPlazas`** — Documentada: `calculate-distance-webrouter` → `extractTollPlazas`; client persiste em `meta.tollPlazas`.
6. **TDE/TEAR desativados** — `pricing_rules_config` tem tde_percent, tear_percent; motor fixa 0; migrado para conditional_fees.
7. **Risco de modalidade** — `freight_modality` do form pode divergir de `price_tables.modality`; recomenda-se validar no client (Contrato de precedência, seção 2).

---
