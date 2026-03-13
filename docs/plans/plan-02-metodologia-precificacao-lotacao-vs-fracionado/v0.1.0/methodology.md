---
plan_number: 02
plan_slug: plan-02-metodologia-precificacao-lotacao-vs-fracionado
version: v0.1.0
role: Analista de Produto + Engenheiro de Software (Supabase + TypeScript)
focus: Metodologia de Precificação (Lotação vs Fracionado)
created_at: 2026-03-06
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
  - src/lib/freightCalculator.ts
  - src/hooks/useCalculateFreight.ts
  - src/hooks/usePriceTableRows.ts
  - src/hooks/usePricingRules.ts
  - src/components/forms/QuoteForm.tsx
  - src/components/forms/quote-form/QuoteFormWizard.tsx
  - src/components/modals/QuoteDetailModal.tsx
  - src/components/pricing/FreightSimulator.tsx
---

## Plan 02 — Metodologia de Precificação (Lotação vs Fracionado) — v0.1.0

### 1. Sumário executivo

O motor de precificação consolida uma metodologia única para cálculo de frete, diferenciando **Lotação (FTL)** e **Fracionado (LTL)** a partir de `price_tables.modality` (`'lotacao'` ou `'fracionado'`), utilizando sempre a mesma base de entrada (origem, destino, distância, peso, volume, valor da carga, tabela de preços e parâmetros fiscais) e compondo um `CalculateFreightResponse` com `meta`, `components`, `rates`, `totals` e `profitability`, que é persistido em `quotes.pricing_breakdown` (e, indiretamente, em `orders` e documentos financeiros), permitindo auditoria completa do cálculo.

### 2. Metodologia LOTAÇÃO (FTL)

#### 2.1 Inputs e campos usados

- **Entrada HTTP (Edge Function)** — `supabase/functions/calculate-freight/index.ts`:
  - Validação via `calculateFreightInputSchema` em `../_shared/freight-schema.ts` (L6–L38):
    - `origin`, `destination`, `km_distance`, `weight_kg`, `volume_m3`, `cargo_value` (obrigatórios).
    - Opcionais: `toll_value`, `price_table_id`, `vehicle_type_code`, `payment_term_code`, `tde_enabled`, `tear_enabled`, `conditional_fees[]`, `waiting_hours`, `das_percent`, `markup_percent`, `overhead_percent`, `carreteiro_percent`, `descarga_value`, `aluguel_maquinas_value`.
  - Após o parse (L116–L124), o payload é tipado como `CalculateFreightInput` (`freight-types.ts`, L31–L71).
- **Campos relevantes em Supabase** (consultados na Edge Function):
  - `pricing_rules_config` (L151–L168) e `pricing_parameters` (L170–L175): `das_percent`, `markup_percent`, `overhead_percent`, `profit_margin_percent`, `regime_simples_nacional`, `excesso_sublimite`, `carreteiro_percent`, `correction_factor_inctf`, `cubage_factor`.
  - `vehicle_types` (L140–L149, L554–L563) para `axes_count` (ANTT e estadia).
  - `price_tables` (`modality`, L234–L241, L272–L281) e `price_table_rows` (L365–L385) para faixas de km, `cost_per_ton`, `cost_per_kg`, `gris_percent`, `tso_percent`, `cost_value_percent`.
  - `ltl_parameters` (L300–L331) apenas para fracionado (usado aqui como contraste).
  - `conditional_fees` (L505–L544) para taxas adicionais.
  - `waiting_time_rules` (L568–L585) para estadia.
  - `antt_floor_rates` (L625–L637) para piso carreteiro.
  - `icms_rates` (L653–L675) para alíquotas UF→UF.
  - `tac_rates` (L706–L720) para ajuste de combustível.
  - `payment_terms` (L729–L738) para `adjustment_percent` do prazo.

- **Persistência em `quotes` e `orders`** — `src/components/forms/QuoteForm.tsx` (L1168–L1205):
  - `quotes.weight`, `quotes.volume`, `quotes.cubage_weight`, `quotes.billable_weight`, `quotes.price_table_id`, `quotes.vehicle_type_id`, `quotes.payment_term_id`, `quotes.km_distance`, `quotes.toll_value`, `quotes.cargo_value`, `quotes.value`, `quotes.pricing_breakdown` recebem os valores do cálculo local (`calculateFreight` + `buildStoredBreakdown`).

#### 2.2 Seleção da faixa de km (Lotação)

- **Cálculo de km usado (`kmBandUsed`)** — `calculate-freight/index.ts`:
  - Quando há `price_table_id` e `km_distance` (L353–L360), calcula-se `kmBand = ceil(km_distance)` (L362–L363) e armazena-se em `kmBandUsed` (L257–L258).
- **Consulta às linhas da tabela** — `price_table_rows` (L365–L385):
  - `select('*').eq('price_table_id', input.price_table_id).order('km_from', { ascending: true })`.
  - Seleção da linha: `r.km_from <= kmBand && r.km_to >= kmBand` (L377–L380).
  - Se encontrada, define `kmBandLabel = "km_from-km_to"` e `priceTableRowId` (L382–L385), armazenados em `meta.km_band_label` e `meta.price_table_row_id` (L842–L851).
- **Condições de erro e status**:
  - Sem `price_table_id` → `responseStatus = 'MISSING_DATA'` com erro "Tabela de preços não selecionada" (L353–L357).
  - Sem `km_distance` → `responseStatus = 'MISSING_DATA'` com erro "km_distance ausente" (L357–L360).
  - Erro na consulta `price_table_rows` → `km_status = 'OUT_OF_RANGE'`, `responseStatus = 'MISSING_DATA'` (L371–L375).
  - Nenhuma linha encontrada para o `kmBand` → `km_status = 'OUT_OF_RANGE'`, `responseStatus = 'OUT_OF_RANGE'`, `responseError = "Não existe faixa para <kmBandUsed> km"` (L443–L447).
- **UI e RPC de apoio**:
  - `src/hooks/usePriceTableRows.ts` seleciona linhas por `price_table_id` (L11–L25) e por `km` (L28–L46).
  - `supabase/functions/price-row/index.ts` expõe o RPC `find_price_row_by_km` com `rounding` configurável (`ceil`/`round`/`floor`), usado por `usePriceTableRowByKmFromEdgeFn` para debug fino de OUT_OF_RANGE (L53–L77 em `usePriceTableRows.ts`).

#### 2.3 Peso faturável (Lotação)

- **Cálculo de cubagem e peso taxável** — `calculate-freight/index.ts` (L227–L243):
  - Fator de cubagem: `cubageFactor = pricing_parameters['cubage_factor'] ?? FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3` (L177–L182; `FREIGHT_CONSTANTS.CUBAGE_FACTOR_KG_M3 = 300` em `freight-types.ts`, L16–L25).
  - Cubagem: \(\text{cubageWeightKg} = \text{volume_m3} \times \text{cubageFactor}\).
  - Peso faturável inicial: \(\text{billableWeightKg} = \max(\text{weight_kg}, \text{cubageWeightKg})\).
  - Para Lotação, **não há** trava de 1.000 kg; a trava é aplicada apenas se `price_tables.modality = 'fracionado'` (L233–L241).
- **Persistência** — `QuoteForm.tsx` (L1180–L1189):
  - `quotes.cubage_weight` recebe `calculationResult.meta.cubageWeightKg`.
  - `quotes.billable_weight` recebe `calculationResult.meta.billableWeightKg`.
- **Breakdown** — `freight-types.ts` (L83–L95) e `freightCalculator.ts` (L981–L983):
  - `weights.cubageWeight`, `weights.billableWeight`, `weights.tonBillable` são preenchidos a partir de `billableWeightKg`.

#### 2.4 Cálculo base Lotação (frete de peso + valor)

- **Detecção de modalidade** — `calculate-freight/index.ts` (L272–L281):
  - `modality` inicia como `'lotacao'` (L272) e só vira `'fracionado'` se `price_tables.modality = 'fracionado'` para o `price_table_id` informado (L274–L281).
- **Base de custo Lotação** — ramo `else` em L422–L441:
  - Para `modality === 'lotacao'`:
    - `costPerTon = priceRow.cost_per_ton || 0` (L425).
    - Fórmula: \(\text{baseCost} = (\text{billableWeightKg} / 1000) \times \text{costPerTon}\) (L426).
    - `console.log` registra: `NTC Lotação Dez/25 | Faixa: kmBandLabel, cost_per_ton, frete_peso` (L439–L441).
  - Em `src/lib/freightCalculator.ts`, o espelho do cálculo local usa `cost_per_ton` ou `cost_per_kg` (L724–L731):
    - Se `row.cost_per_ton > 0`: \(\text{baseCost} = (\text{billableWeightKg}/1000) \times cost_per_ton\).
    - Senão: \(\text{baseCost} = \text{billableWeightKg} \times cost_per_kg\).
- **Frete valor (RCTR-C)** — depois da seleção da linha, independentemente da modalidade (L455–L463):
  - Percentual de frete valor: `costValuePercent` (L252, L430–L437, L747–L748 em `freightCalculator.ts`).
  - Fórmula: \(\text{frete_valor} = \text{cargo_value} \times (\text{costValuePercent} / 100)\) (L462).

#### 2.5 Adicionais Lotação

- **GRIS, TSO e frete valor** — `calculate-freight/index.ts`:
  - Resolução de percentuais via `resolveRulePercent` (L260–L267) e precedências:
    - Lotação: `grisPercent = ruleGris ?? ptGris ?? 0.3;` (L428–L435).
    - Lotação: `tsoPercent = ruleTso ?? ptTso ?? 0.15;` (L429–L436).
    - Lotação: `costValuePercent = ruleCostVal ?? ptCostVal ?? 0.3;` (L430–L437).
  - Cálculo dos componentes (L459–L463):
    - \(\text{gris} = \text{cargo_value} \times (\text{grisPercent}/100)\).
    - \(\text{tso} = \text{cargo_value} \times (\text{tsoPercent}/100)\).
    - \(\text{frete_valor} = \text{cargo_value} \times (\text{costValuePercent}/100)\).
- **Despacho (dispatch_fee)**:
  - No Lotação, `dispatchFee` permanece 0 (L298–L299, L420–L421); é específico de Fracionado.
- **Pedágio (`toll`)** — componente manual:
  - `toll = input.toll_value ?? 0` (L485) e entra em `components.toll` (L860).
  - O cálculo de pedágios por rota (`toll_routes`) é lido apenas via hooks UI (`useTollRoutes`) e não entra diretamente no motor da Edge Function — ver seção de gaps.
- **Taxas condicionais (`conditional_fees`)** — `calculate-freight/index.ts` (L499–L544):
  - Lê `conditional_fees` por `code` em `public.conditional_fees` (L505–L510).
  - Base de cálculo (L517–L519):
    - `feeBase = cargo_value` se `fee.applies_to = 'cargo_value'`.
    - Senão, `feeBase = conditionalFeeFreightBase`, onde
      \(\text{conditionalFeeFreightBase} = \text{frete_peso} \times correctionFactor \times (1 + markupPercent/100)\) (L494–L497).
  - Tipos de taxa (L520–L529):
    - `percentage`: \(feeValue = feeBase \times fee.fee_value / 100\).
    - `fixed`: \(feeValue = fee.fee_value\).
    - `per_kg`: \(feeValue = billableWeightKg \times fee.fee_value\).
  - Aplicação de `min_value`/`max_value` (L532–L536) e registro em
    `conditional_fees_breakdown[feeCode]` e `conditionalFeesTotal` (L538–L540).
- **Estadia (`waiting_time_cost`)** — `calculate-freight/index.ts` (L565–L613):
  - Seleciona `waiting_time_rules` por `vehicle_type_id` e fallback global com `vehicle_type_id IS NULL` (L568–L583).
  - Calcula `free_hours` (default 5h, L588–L589) e `excessHours` (L589–L591).
  - Se há `rate_per_day` e `excessHours >= 24`, cobra diárias cheias (L595–L599).
  - Senão, usa `rate_per_hour` (default 146.44) (L592–L600).
  - `min_charge` garante mínimo em R$ (L603–L605).
  - Fallback se não há regra cadastrada: 5h franquia e R$146,44/h, com registro em `fallbacks_aplicados` (L608–L612).

#### 2.6 Impostos e ajustes (Lotação)

- **DAS, markup, overhead, margem alvo** — `calculate-freight/index.ts` (L177–L196):
  - `dasPercent`, `markupPercent`, `overheadPercent`, `profitMarginPercent` lidos de:
    - `input.*_percent` (overrides opcionais) → `pricing_rules_config` (`resolveRule`) → `pricing_parameters` → `FREIGHT_CONSTANTS` defaults.
  - Flags fiscais: `regimeSimplesNacional` e `excessoSublimite` (L197–L200) determinam `isSimples` (L207–L208).
- **ICMS** — `calculate-freight/index.ts` (L641–L693):
  - Extrai UFs com `extractUf` (`freight-types.ts`, L178–L195).
  - Consulta `icms_rates(origin_state, destination_state)` (L653–L659).
  - Se encontrado, normaliza com `normalizeIcmsRate` (L661–L663).
  - Se não encontrado, tenta `pricing_rules_config('icms_default')`, senão fallback para
    `FREIGHT_CONSTANTS.DEFAULT_ICMS_PERCENT` com anotação em `fallbacks_aplicados` (L664–L673).
  - Validação: se `icmsPercent >= 100`, substitui pelo default (L685–L690).
  - `isSimples` força `icmsPercent = 0` (L692–L693).
- **TAC (Taxa de Ajuste de Combustível)** — `tac_rates` (L696–L721):
  - Lê a última linha de `tac_rates` com `reference_date <= today` (L706–L712).
  - Calcula `dieselVariationPercent = variation_percent` (L714–L716).
  - Se `dieselVariationPercent >= 5`, define `tacSteps = floor(dieselVariationPercent / 5)` e
    `tacPercent = tacSteps * 1.75` (L717–L719).
  - `tacAdjustment = frete_peso * (tacPercent / 100)` (L744).
- **Prazo de pagamento (`payment_terms`)** — `calculate-freight/index.ts` (L723–L739):
  - Determina `payment_term_code` default `'D30'` (L726–L728).
  - Carrega `payment_terms(code, adjustment_percent)` ativo (L729–L738).
  - `paymentAdjustmentPercent = adjustment_percent` (L736–L738).
  - `paymentAdjustment = receitaComTac * (paymentAdjustmentPercent / 100)` (L759), onde
    \(\text{receitaComTac} = \text{receitaBrutaPreTac} + tacAdjustment\) (L745–L758).

#### 2.7 Markup, overhead, margem (Lotação)

- **Custos diretos e DRE Asset-Light** — `calculate-freight/index.ts` (L768–L785):
  - `custoMotorista = frete_peso` (L768).
  - `custoServicos = toll + gris + tso + frete_valor + tde + tear + dispatchFee + conditionalFeesTotal + waitingTimeCost + aluguelMaquinasValue + tacAdjustment + paymentAdjustment` (L769–L781).
  - `custosCarreteiro = ntc_base` (L782), onde
    \(\text{ntc_base} = frete_peso + frete_valor + gris + tso + dispatchFee\) (L479).
  - `custosDescarga = descargaValue` (L783).
  - `custosDiretos = custoMotorista + custoServicos + custosDescarga` (L784).
- **Gross-up híbrido** — `calculate-freight/index.ts` (L786–L821):
  - Define `regimeFiscal` e se ICMS entra no divisor (`icmsNoDivisor`) conforme `regimeSimplesNacional` e `excessoSublimite` (L786–L797).
  - Calcula `taxaBruta`:
    - Se `icmsNoDivisor`: \(\text{taxaBruta} = (overheadPercent + dasPercent + icmsPercent + profitMarginPercent)/100\) (L799–L801).
    - Senão: \(\text{taxaBruta} = (overheadPercent + dasPercent + profitMarginPercent)/100\).
  - Se `taxaBruta >= 1`, aplica fallback "modelo por fora" (L807–L815):
    - `receitaFinal = receitaBrutaPreTac + tacAdjustment + paymentAdjustment`.
    - `das = max(receitaFinal * dasPercent/100, das_provision_min_value)` (L812–L813).
    - `icms = receitaFinal * icmsPercent/100` (L814–L815).
    - `totalCliente = receitaFinal + das + icms`.
  - Caso padrão (`taxaBruta < 1`): \(\text{totalCliente} = \text{custosDiretos} / (1 - \text{taxaBruta})\) (L817).
    - `das = totalCliente * dasPercent/100` (L818).
    - `icms = 0` se regime simples, ou `totalCliente * icmsPercent/100` (L819–L820).
  - `totalImpostos = das + icms` (L823), `receitaLiquida = totalCliente - totalImpostos` (L824).
  - `overhead = receitaLiquida * overheadPercent/100` (L825).
  - `resultadoLiquido = receitaLiquida - overhead - custosCarreteiro - custosDescarga` (L826–L828).
  - `margemBruta = receitaLiquida - overhead - custoMotorista - custoServicos` (L829).
  - `margemPercent = (resultadoLiquido / totalCliente) * 100` (L830–L831).
  - `marginStatus` é derivado de `getMarginStatus(margemPercent)` (L837–L838; `freight-types.ts` L283–L291).

#### 2.8 Piso ANTT carreteiro (Lotação)

- **Cálculo do piso** — `calculate-freight/index.ts` (L616–L637):
  - Pré-condições: `axesCount` definido e `km_distance > 0` (L622–L623).
  - Consulta `antt_floor_rates` com filtros fixos: `operation_table = 'A'`, `cargo_type = 'carga_geral'`, `axes_count = axesCount`, ordenando por `valid_from DESC` (L625–L633).
  - Se encontrado, calcula:
    - \(\text{pisoAnttCarreteiro} = roundCurrency(kmBand \times ccd + cc)\) (L635–L636).
  - Armazena em `meta.antt_piso_carreteiro` (L852).
- **Uso no frontend** — `QuoteDetailModal.tsx` (L143–L155, L213–L247):
  - Hook `useAnttFloorRate` combina `vehicle_types.axes_count` e `km_distance` para exibir `pisoAnttView` e salvar em `quotes.pricing_breakdown.meta.antt` via `handleSaveAntt` (L458–L486).

#### 2.9 Status, meta e persistência Lotação

- **Status do cálculo** — `CalculateFreightResponse` (L154–L167 em `freight-types.ts`):
  - `status` ∈ `{'OK','OUT_OF_RANGE','MISSING_DATA'}` e `error?: string` são preenchidos conforme fluxo de seleção de faixa e validações iniciais (L249–L256, L353–L360, L443–L447, L939–L952).
  - `meta.km_status` reflete `kmStatus` (`'OK'` ou `'OUT_OF_RANGE'`, L254, L843).
- **Persistência do breakdown**:
  - Backend (Edge): responde com `CalculateFreightResponse` contendo `meta`, `components`, `rates`, `totals`, `profitability`, `conditional_fees_breakdown`, `fallbacks_aplicados` (L911–L922).
  - Frontend (simulador/UI local): `src/lib/freightCalculator.ts` implementa `calculateFreight` e `buildStoredBreakdown` (L597–L944, L950–L1023), construindo `StoredPricingBreakdown` para salvar em `quotes.pricing_breakdown`.
  - `QuoteForm.tsx` salva `pricing_breakdown` e campos derivados (`value`, `toll_value`, `billable_weight`, `cubage_weight`, datas de vencimento) na criação/edição da cotação (L1168–L1218).
  - `QuoteDetailModal.tsx` recalcula via Edge (`useCalculateFreight`) e usa `buildStoredBreakdownFromEdgeResponse` para persistir novo breakdown em `quotes` (L357–L399).
  - `FreightSimulator.tsx` consome diretamente `CalculateFreightResponse` para fins analíticos, sem persistência.

### 3. Metodologia FRACIONADO (LTL)

#### 3.1 Detecção de modalidade

- **Backend** — `calculate-freight/index.ts` (L272–L281):
  - Inicializa `modality: 'lotacao' | 'fracionado' = 'lotacao'` (L272).
  - Se `input.price_table_id` estiver definido, carrega `price_tables.modality` (L275–L279); se `'fracionado'`, define `modality = 'fracionado'` (L280–L281).
  - O input de UI `freight_modality` é usado apenas no cálculo local (TS) em `freightCalculator.ts` (L705–L731, L706–L707), via `input.modality`, para escolher o branch de Fracionado/Lotação.

#### 3.2 Parâmetros LTL (`ltl_parameters`)

- **Leitura e fallback** — `calculate-freight/index.ts` (L284–L331):
  - Tipo local `LtlParams` (L287–L295) mapeia colunas de `ltl_parameters`:
    - `min_freight`, `min_freight_cargo_limit`, `min_tso`, `gris_percent`, `gris_min`, `gris_min_cargo_limit`, `dispatch_fee`.
  - Quando `modality === 'fracionado'`, lê o último registro por `created_at DESC LIMIT 1` (L300–L306).
  - Se encontrado, popula `ltlParams` convertendo para `number`, com defaults NTC Dez/25 caso alguma coluna venha nula (L308–L317).
  - Se não houver linha, cria `ltlParams` padrão com os valores NTC (L320–L328) e registra `fallbacksApplied.push('ltl_parameters: usando fallback NTC Dez/25')` (L329).
- **Observação**: os campos `min_freight` e `min_freight_cargo_limit` existem na tabela e são carregados (via `migration_fracionado.sql`, L25–L36), mas **não são usados explicitamente** na função `calculate-freight`. Isso é registrado como gap na seção 6.

#### 3.3 Peso faturável e trava de 1t (Fracionado)

- **Trava de 1.000 kg** — `calculate-freight/index.ts` (L227–L243):
  - Após calcular `cubageWeightKg` e `billableWeightKg` (L227–L228), se `price_tables.modality = 'fracionado'` e `billableWeightKg < 1000`, então:
    - `billableWeightKg = 1000` e `ltlMinWeightApplied = true` (L239–L241).
  - `meta.ltl_min_weight_applied = true` e `meta.original_weight_kg = originalWeightKg` (L852–L854).
- **Espelho em TS** — `freightCalculator.ts` (L694–L703):
  - `const ltlMinWeightApplied = input.modality === 'fracionado' && billableWeightKg < 1000;` (L699).
  - Se verdadeiro, `billableWeightKg = 1000` (L700–L702) e `meta.ltlMinWeightApplied`/`meta.originalWeightKg` são preenchidos (L889–L892).

#### 3.4 Seleção de faixa de km e de peso (Fracionado)

- **Faixa de km** — igual à Lotação:
  - Mesma consulta `price_table_rows` e filtragem por `km_from <= kmBand <= km_to` (L365–L380).
  - `kmBandLabel` e `priceTableRowId` preenchidos da mesma forma (L382–L385).
- **Faixa de peso (LTL)** — ramo `if (modality === 'fracionado')` (L386–L421):
  - Determinação da coluna de faixa de peso pela função `getLtlWeightColumn(weightKg)` (L337–L347):
    - Até 10 kg → `weight_rate_10`.
    - 11–20 kg → `weight_rate_20`.
    - 21–30 kg → `weight_rate_30`.
    - 31–50 kg → `weight_rate_50`.
    - 51–70 kg → `weight_rate_70`.
    - 71–100 kg → `weight_rate_100`.
    - 101–150 kg → `weight_rate_150`.
    - 151–200 kg → `weight_rate_200`.
    - Acima de 200 kg → `null`, sinalizando uso de `weight_rate_above_200`.
  - Cálculo da base de custo (L390–L405):
    - Se `weightCol != null` (até 200 kg):
      - `ratePerKg = Number(priceRow[weightCol]) || 0` (L393–L394).
      - \(\text{baseCost} = \text{billableWeightKg} \times ratePerKg\) (L394–L395).
    - Se `weightCol == null` (acima de 200 kg):
      - `ratePerKg = Number(priceRow.weight_rate_above_200) || 0` (L401–L402).
      - \(\text{baseCost} = \text{billableWeightKg} \times ratePerKg\) (L401–L402).
- **Espelho em TS** — `freightCalculator.ts` (L710–L722):
  - Mesma lógica: `getLtlWeightColumn`, `ratePerKg` e `weight_rate_above_200` para cálculo de `baseCost`.

#### 3.5 Base de custo Fracionado (NTC LTL)

- **Cálculo base**:
  - Como acima, sempre \(\text{baseCost} = \text{billableWeightKg} \times ratePerKg\) com `ratePerKg` vindo da coluna de faixa correspondente ou de `weight_rate_above_200`.
  - Não há markup aplicado sobre frete peso no branch LTL na versão TS: `baseFreight = isLtl ? baseCost : round2(markupBase * (1 + params.markupPercent/100))` (L779–L781). No backend, `base_freight` é sempre `frete_peso` (L857–L860), e o gross-up é feito depois via custos diretos.
- **Correção INCTF (`correction_factor`)**:
  - Em `ltl_parameters` há `correction_factor` (L34 em `migration_fracionado.sql`), mas em `calculate-freight/index.ts` o fator de correção usado é `correctionFactor = paramsMap.get('correction_factor_inctf') ?? 1.0` (L205–L218), vindo de `pricing_parameters`.
  - Não há referência direta a `ltl_parameters.correction_factor` na Edge Function atual — gap registrado na seção 6.
- **Mínimos de frete (`min_freight` e `min_freight_cargo_limit`)**:
  - Embora estejam presentes em `ltl_parameters` e sejam carregados em L310–L323, **não existe lógica explícita** no código para aplicar um frete mínimo por CTe baseado nesses campos (nem no backend nem em `freightCalculator.ts`). Isso também é registrado como gap.

#### 3.6 Adicionais Fracionado

- **Despacho (dispatch_fee)** — apenas Fracionado:
  - `dispatchFee` é definido quando `modality === 'fracionado'` via `ltlParams?.dispatch_fee ?? 102.9` (L420–L421).
  - Na TS: `dispatchFee = input.ltlParams?.dispatchFee ?? 102.9` (L722–L723).
  - Entra em `components.dispatch_fee` (L867, `freight-types.ts` L108).
- **GRIS e TSO no Fracionado**:
  - Precedência específica LTL indicada por comentário (L408–L419):
    - `ruleGris`, `ruleTso`, `ruleCostVal` de `pricing_rules_config`.
    - Campos da linha `priceRow.gris_percent`, `.tso_percent`, `.cost_value_percent`.
    - `ltlParams?.gris_percent` como fallback apenas para GRIS.
  - Implementação (L409–L419):
    - `grisPercent = ruleGris ?? ptGris ?? ltlGris ?? 0.3;` (L417).
    - `tsoPercent = ruleTso ?? ptTso ?? 0.15;` (L418).
    - `costValuePercent = ruleCostVal ?? ptCostVal ?? 0.3;` (L419).
  - Mínimos NTC LTL (L465–L477):
    - Se `cargo_value <= gris_min_cargo_limit` e `gris < gris_min`, aplica-se `gris = gris_min` e registra em `fallbacks_aplicados` (L467–L471).
    - Se `tso < min_tso`, aplica-se `tso = min_tso` e registra em `fallbacks_aplicados` (L472–L476).
- **Outras taxas (TDE/TEAR)**:
  - Na Edge Function, `tde` e `tear` são fixados em 0 (L491–L492) e comentados como TODO, ou seja, não participam mais do cálculo. Em `freightCalculator.ts`, são igualmente `0` (L787–L788) e mantidos somente para compatibilidade de tipos (comentário L783–L786).
  - O uso pretendido de TDE/TEAR foi migrado para `conditional_fees` (comentário em `freightCalculator.ts` L783–L786), mas não há regra automática vinculando códigos de taxa específicos a esses conceitos — isso depende da configuração manual em `conditional_fees`.

#### 3.7 Impostos, markup e ANTT no Fracionado

- **Impostos e markup**:
  - A lógica de `dasPercent`, `markupPercent`, `overheadPercent`, `profitMarginPercent`, `icmsPercent`, `tacPercent` e `paymentAdjustmentPercent` é compartilhada entre Lotação e Fracionado; não há branch específico por modalidade nessa etapa (L177–L205, L641–L721, L740–L760, L768–L831).
  - O gross-up usa os mesmos parâmetros de custos diretos (`custosDiretos`) e impostos para ambas as modalidades (L768–L785, L799–L821).
- **ANTT**:
  - O cálculo do piso ANTT carreteiro (`antt_floor_rates`) não distingue explicitamente a modalidade; depende apenas de `axesCount` e `km_distance` (L622–L637).
  - Entretanto, pelo contexto de negócio (`pisoAnttCarreteiro` usado como referência de custo carreteiro), é mais relevante para operações de Lotação; no Fracionado ele continua disponível, mas seu uso para decisão comercial não está diferenciado no código.

#### 3.8 Status e persistência Fracionado

- **Status, meta e flags específicas**:
  - Para Fracionado, `status`, `km_status`, `error` seguem a mesma lógica de Lotação (L249–L256, L443–L447, L911–L922).
  - Flags adicionais no meta:
    - `ltl_min_weight_applied` e `original_weight_kg` (L852–L854) sinalizam a aplicação da trava de 1t.
    - `ntc_base` registra a base NTC \(\text{frete_peso} + \text{frete_valor} + \text{gris} + \text{tso} + \text{dispatchFee}\) (L851).
  - Na versão TS (`StoredPricingBreakdown.meta`, `freightCalculator.ts` L270–L335), há espaço para `antt` e `kmByUf`, mas a lógica LTL específica se concentra em `ltlMinWeightApplied` e `originalWeightKg` (L295–L298, L967–L968).
- **Persistência**:
  - Igual à Lotação: `QuoteForm.tsx` escreve os mesmos campos em `quotes`, independentemente da modalidade (L1168–L1205).
  - `QuoteFormWizard.tsx` bloqueia o CTA de envio quando `calculationResult.status !== 'OK'`, usando `calculationResult.status` e `calculationResult.error` (L155–L181), sem diferenciar LTL/FTL.

### 4. Tabela comparativa Lotação vs Fracionado

| Aspecto                         | Lotação (FTL)                                                                                                                                              | Fracionado (LTL)                                                                                                                                                                      |
|---------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Base de custo**               | `baseCost = (billableWeightKg / 1000) * cost_per_ton` (ou `billableWeightKg * cost_per_kg` na versão TS) a partir de `price_table_rows.cost_per_ton/kg`.   | `baseCost = billableWeightKg * ratePerKg`, onde `ratePerKg` vem de `weight_rate_10..200` ou `weight_rate_above_200` em `price_table_rows` (NTC LTL Dez/25).                          |
| **Peso / cubagem**             | `billableWeightKg = max(weight_kg, volume_m3 * cubageFactor)`, sem trava mínima; persistido em `quotes.cubage_weight` e `quotes.billable_weight`.          | Mesma fórmula, mas com trava de 1.000 kg: se `modality = 'fracionado'` e `billableWeightKg < 1000`, força `billableWeightKg = 1000` e marca `ltl_min_weight_applied`/`original_weight`. |
| **Faixa de km**                | `kmBand = ceil(km_distance)`, seleção de `price_table_rows` por `km_from <= kmBand <= km_to`; `km_band_label` e `km_status` em `meta`.                    | Idêntico: mesmo `kmBand` e mesma seleção de faixa, apenas com uso posterior das colunas `weight_rate_*` para o cálculo do `baseCost`.                                                |
| **Mínimos / gatilhos NTC**     | Não há mínimos explícitos além do piso ANTT carreteiro (`antt_floor_rates`); `das_provision_min_value` pode impor mínimo de DAS.                          | Mínimos NTC LTL aplicados a `gris` (`gris_min`/`gris_min_cargo_limit`) e `tso` (`min_tso`); campos `min_freight`/`min_freight_cargo_limit` existem mas não são aplicados no código atual. |
| **Impostos e ajustes**         | `das_percent`, `markup_percent`, `overhead_percent`, `profit_margin_percent`, `icms_percent`, `tac_percent`, `payment_adjustment_percent` via Central + parâmetros; gross-up híbrido calcula `total_cliente`. | Mesma lógica de impostos e gross-up; não há diferenciação específica por modalidade nesse estágio.                                                                                   |
| **Conditional fees & waiting** | `conditional_fees` aplicadas sobre `cargo_value` ou `freight` (base `frete_peso * correctionFactor * (1 + markup/100)`); `waiting_time_cost` via `waiting_time_rules`. | Idêntico; no LTL, o impacto na base de custo vem de `baseCost` diferente (R$/kg) e de `dispatch_fee`, mas a lógica de taxas condicionais e estadia é a mesma.                         |
| **Despacho (dispatch_fee)**    | `dispatchFee = 0` (não aplicado por padrão).                                                                                                               | `dispatchFee = ltlParams.dispatch_fee` ou `102.9` R$/CTe (NTC Dez/25); incluído em `components.dispatch_fee` e em `ntc_base`.                                                        |
| **Piso ANTT carreteiro**       | Calculado sempre que há `axesCount` e `km_distance`, armazenado em `meta.antt_piso_carreteiro` e usado na análise de rentabilidade (piso carreteiro).     | Mesmo cálculo disponível; o código não diferencia o uso para Fracionado, embora conceitualmente o piso ANTT seja mais relevante para Lotação.                                       |
| **Persistência em `quotes`**   | `pricing_breakdown`, `value`, `toll_value`, `billable_weight`, `cubage_weight`, `km_distance`, `price_table_id`, `payment_term_id`, `vehicle_type_id`.     | Exatamente os mesmos campos; a distinção de modalidade é inferida via `price_tables.modality` e, no front, pelo campo de formulário `freight_modality`.                             |

### 5. Mapa de Código (entradas e fluxo)

- **`supabase/functions/calculate-freight/index.ts`**
  - **Responsabilidade**: receber o payload HTTP, validar (`calculateFreightInputSchema`), ler tabelas (`pricing_parameters`, `pricing_rules_config`, `vehicle_types`, `price_tables`, `price_table_rows`, `ltl_parameters`, `conditional_fees`, `waiting_time_rules`, `antt_floor_rates`, `icms_rates`, `tac_rates`, `payment_terms`), calcular frete Lotação/Fracionado e retornar `CalculateFreightResponse`.
  - **Inputs**: ver seção 2.1 (`CalculateFreightInput`).
  - **Outputs**: `CalculateFreightResponse` (meta, components, rates, totals, profitability, conditional_fees_breakdown, fallbacks_aplicados).

- **`supabase/functions/_shared/freight-schema.ts`**
  - **Responsabilidade**: validar o payload de entrada com Zod, garantindo campos obrigatórios e limites mínimos (>= 0).
  - **Inputs**: objeto JSON da requisição HTTP.
  - **Outputs**: objeto tipado `CalculateFreightInput` ou erro de validação (`status: 'MISSING_DATA'`).

- **`supabase/functions/_shared/freight-types.ts`**
  - **Responsabilidade**: definir tipos compartilhados (`CalculateFreightInput/Response`, `FreightMeta`, `FreightComponents`, `FreightRates`, `FreightTotals`, `FreightProfitability`) e helpers (`extractUf`, `formatRouteUf`, `normalizeIcmsRate`, `calculateCubageWeight`, `calculateBillableWeight`, `roundCurrency`, `getMarginStatus`).
  - **Inputs**: valores primitivos usados pelo motor.
  - **Outputs**: funções utilitárias e contratos de tipos usados tanto no backend quanto no frontend.

- **`supabase/functions/price-row/index.ts`**
  - **Responsabilidade**: expor uma Edge Function especializada para localizar `price_table_rows` por `price_table_id` + km, usando o RPC `find_price_row_by_km` com arredondamento configurável.
  - **Inputs**: `p_price_table_id`/`price_table_id`, `p_km_numeric`/`km`, `p_rounding`/`rounding`.
  - **Outputs**: `{ row }` (200), `{ row: null, error }` (404) ou `{ error }` (4xx/5xx).

- **`src/lib/freightCalculator.ts`**
  - **Responsabilidade**: implementar o mesmo modelo de cálculo em TS puro, com foco em frontend (simulador e formulário de cotação), usando `price_table_rows`, `pricing_parameters` e parâmetros resolvidos (`pricingParams`).
  - **Inputs**: `FreightCalculationInput` com `originCity`, `destinationCity`, `kmDistance`, `weightKg`, `volumeM3`, `cargoValue`, `tollValue`, `priceTableRow`, `priceTableId`, `modality`, `ltlParams`, `icmsRatePercent`, `kmByUf`, `icmsByUf`, `pricingParams`, `directCosts`, `extras`.
  - **Outputs**: `FreightCalculationOutput` e `StoredPricingBreakdown` via `buildStoredBreakdown`.

- **`src/hooks/useCalculateFreight.ts`**
  - **Responsabilidade**: encapsular a chamada à Edge Function `calculate-freight` via `invokeEdgeFunction`, mapeando erros e expondo um `useMutation` (`@tanstack/react-query`).
  - **Inputs**: `CalculateFreightInput` (mesma shape da Edge Function).
  - **Outputs**: `CalculateFreightResponse` ou exceção com mensagens consolidadas.

- **`src/hooks/usePriceTableRows.ts`**
  - **Responsabilidade**: buscar `price_table_rows` por tabela e por km, incluindo uma variante que usa a Edge Function `price-row` para depuração.
  - **Inputs**: `priceTableId`, `kmDistance`, `modality`, `isAuthenticated`.
  - **Outputs**: listas de linhas de faixa ou uma única linha (`PriceTableRow`) via React Query.

- **`src/hooks/usePricingRules.ts`**
  - **Responsabilidade**: fornecer acesso a `pricing_parameters`, `vehicle_types`, `waiting_time_rules`, `toll_routes`, `tac_rates`, `conditional_fees`, `payment_terms` para telas administrativas e UI de precificação.
  - **Inputs**: flags simples (`activeOnly`, `key`).
  - **Outputs**: listas e registros estruturados para configuração de regras e parâmetros.

- **`src/components/forms/QuoteForm.tsx`**
  - **Responsabilidade**: orquestrar inputs do usuário, carregar `price_table_rows`, parâmetros e ANTT, chamar `calculateFreight` (TS) para feedback em tempo real e salvar `pricing_breakdown` e campos derivados em `quotes`.
  - **Inputs**: dados do formulário `QuoteFormData` (cliente, rota, carga, modalidade, tabela, prazo, pedágio, taxas adicionais, estadia, etc.).
  - **Outputs**: criação ou atualização de registros em `quotes`, com `pricing_breakdown` completo e campos auxiliares (`weight`, `volume`, `cubage_weight`, `billable_weight`, `value`, datas de vencimento).

- **`src/components/forms/quote-form/QuoteFormWizard.tsx`**
  - **Responsabilidade**: controlar o fluxo em etapas do formulário de cotação, usando `calculationResult.status`/`error` e `priceTableRow` para bloquear o CTA quando o cálculo está `MISSING_DATA` ou `OUT_OF_RANGE`.
  - **Inputs**: `calculationResult: FreightCalculationOutput | null`, `priceTableRow`, `isCalculationStale`, `isLoadingPriceRow`.
  - **Outputs**: gating de envio (desabilita botão e exibe `blockedReason` em `wizard-blocked-reason`).

- **`src/components/modals/QuoteDetailModal.tsx`**
  - **Responsabilidade**: exibir a memória de cálculo detalhada a partir de `quotes.pricing_breakdown`, permitir recalcular via Edge Function, ajustar condições de pagamento, salvar ANTT e converter a cotação em documento financeiro (`ensure_financial_document`).
  - **Inputs**: `quote` (incluindo `pricing_breakdown`), `price_table_id`, `km_distance`, `payment_term_id`, `vehicle_type_id`.
  - **Outputs**: atualizações em `quotes` (novo `pricing_breakdown` e `value`), criação de `financial_documents` via RPC.

- **`src/components/pricing/FreightSimulator.tsx`**
  - **Responsabilidade**: fornecer uma UI independente para testar a Edge Function em cenários de Lotação e Fracionado, exibindo o breakdown da resposta em tempo real.
  - **Inputs**: campos manuais (origem/destino, peso, volume, valor, km, pedágio, tabela, tipo de veículo, prazo, taxas condicionais, estadia, flags TDE/TEAR).
  - **Outputs**: apenas visualização (gráfica) de `CalculateFreightResponse`, sem persistência.

### 6. Gaps, dúvidas e riscos

1. **Mínimos de frete LTL (`ltl_parameters.min_freight` e `min_freight_cargo_limit`) não aplicados**
   - **Descrição**: embora esses campos existam em `ltl_parameters` (`migration_fracionado.sql`, L25–L32) e sejam carregados em `calculate-freight/index.ts` (L310–L323), nenhuma lógica os utiliza para impor um frete mínimo (`ntc_base` ou `total_cliente`) em Fracionado.
   - **Possível impacto**: fretes abaixo do piso NTC para cargas de baixo valor em LTL, reduzindo margem e compliance regulatório.
   - **Como confirmar**: buscar por `min_freight` e `min_freight_cargo_limit` em todo o repo e, se ausente, definir regra explícita em `calculate-freight/index.ts` e `freightCalculator.ts`.

2. **Fator de correção INCTF (`ltl_parameters.correction_factor`) não usado pelo motor**
   - **Descrição**: `ltl_parameters` inclui `correction_factor` (L34 em `migration_fracionado.sql`), mas o motor usa `correction_factor_inctf` apenas via `pricing_parameters` (L205–L218), sem ler o campo de LTL.
   - **Possível impacto**: defasagem entre o referencial NTC LTL e o ajuste de correção realmente aplicado, dificultando auditoria com base em circulares NTC.
   - **Como confirmar**: revisar com o time se o campo `correction_factor_inctf` em `pricing_parameters` já incorpora o mesmo valor; se não, considerar alinhar os dois ou descontinuar um deles.

3. **Mínimo de frete valor (NTC LTL) não explicitado**
   - **Descrição**: a documentação NTC LTL prevê `min_freight` por CTe (valor mínimo de frete valor), mas o código aplica apenas mínimos a GRIS e TSO (`gris_min`, `min_tso`) (L465–L476) e não há fórmula de `max(baseCost, min_freight)`.
   - **Possível impacto**: fretes LTL com valor abaixo do mínimo de tabela, com risco de price floor abaixo da referência NTC.
   - **Como confirmar**: verificar se `min_freight` é usado no motor legado ou em relatórios externos; se for, implementar comparação explícita `ntc_base >= min_freight` para cargas até `min_freight_cargo_limit`.

4. **Uso limitado de `toll_routes` na composição do pedágio**
   - **Descrição**: a tabela `toll_routes` (criada em `20260207015416_...`) é consumida apenas por hooks de UI (`useTollRoutes` em `usePricingRules.ts`), enquanto o motor de frete usa exclusivamente `input.toll_value` (L485) para compor `components.toll`.
   - **Possível impacto**: inconsistência entre pedágios calculados pelo WebRouter/tabela e o valor manual enviado na simulação/cotação, dificultando rastreabilidade de rotas.
   - **Como confirmar**: revisar o fluxo de cálculo de KM/pedágio (Edge Function de rota ou integração externa) e avaliar se `calculate-freight` deve receber o breakdown de `toll_routes` ou apenas o somatório.

5. **TDE/TEAR desativados no motor, mas ainda presentes em `pricing_rules_config`**
   - **Descrição**: `pricing_rules_config` popula chaves `tde_percent` e `tear_percent` (20260401000000_pricing_engine_360_infra.sql, L75–L82), mas `calculate-freight/index.ts` fixa `tde = 0`, `tear = 0` (L491–L492) e os comentários indicam que TDE/TEAR foram migrados para `conditional_fees`.
   - **Possível impacto**: operadores podem supor que a parametrização de TDE/TEAR na Central afeta o cálculo, quando na verdade não afeta; risco de configuração "morta".
   - **Como confirmar**: revisar com produto/financeiro se TDE/TEAR devem ser configurados apenas via `conditional_fees`, e documentar isso nas telas de Central de Regras.

6. **Campos de trip (trips, trip_cost_items, trip_orders) não participam do motor de frete**
   - **Descrição**: as tabelas de viagens e rateio de custos aparecem em migrations e hooks (`useTrips`, `useReconciliation`), mas não são lidas em `calculate-freight` nem em `freightCalculator.ts`.
   - **Possível impacto**: usuários podem esperar que custos de viagem (combustível real, pedágio por ocorrência, etc.) retroalimentem o motor de precificação; hoje isso não ocorre automaticamente.
   - **Como confirmar**: revisar a Edge Function `reconcile-trip` e views de `trip_financial_summary` para entender como os custos são comparados aos preços calculados; documentar explicitamente que o motor trabalha apenas com parâmetros NTC/Central.

7. **Campos adicionais de `payment_terms` (dias, advance_percent) não entram no cálculo do frete**
   - **Descrição**: `payment_terms` possui `advance_percent` e `days` (L163–L172 em `QuoteDetailModal.tsx`), mas `calculate-freight` usa somente `adjustment_percent` para o ajuste de prazo (L729–L738), ignorando os demais campos.
   - **Possível impacto**: possível desalinhamento entre a percepção do usuário (ex.: "D30 com 50% de adiantamento") e o efeito financeiro real no cálculo (apenas ajuste percentual genérico).
   - **Como confirmar**: revisar com financeiro se a modelagem de prazos exige um modelo mais rico (ex.: cálculo de custo de capital por dias de prazo e split de adiantamento/saldo) e se o campo `adjustment_percent` já embute esses efeitos.

