# Análise 360°: Paradas no Roteiro (múltiplos destinatários)

**Versão:** 1.0  
**Data:** 2025-03-07  
**Feature:** Origem → 1..N paradas → destino no mesmo frete, múltiplos CNPJs, embarcador CIF como pagador único.

---

## 1. Visão geral

A feature permite montar uma única cotação com roteiro `origem → parada 1 → parada 2 → … → destino`, vinculando cada parada a um destinatário (CNPJ), mantendo:

- **Pagador único:** embarcador CIF
- **1 FAT e 1 PAG** por viagem (MVP)
- **Carga agregada:** soma de NF, peso e cubagem em um único frete
- **Ordem da rota:** manual por padrão, com botão opcional “Otimizar rota”

---

## 2. Fluxo ponta a ponta

```
QuoteForm (IdentificationStep) → origem + paradas[] + destino
    ↓ handleCalculateKm (waypoints)
calculate-distance-webrouter → km_total, toll, km_by_uf, toll_plazas
    ↓
calculate-freight (Edge) → pricing_breakdown
    ↓ submit
quotes + quote_route_stops
    ↓ Converter em OS
orders (1 OS por viagem)
    ↓ ensure-financial-document
financial_documents (1 FAT, 1 PAG)
    ↓ Comprovantes
payment_proofs (PAG) / quote_payment_proofs (FAT)
    ↓ DRE
dre.orchestrator → presumed vs real
```

---

## 3. Impacto por camada

### 3.1 Cotação (QuoteForm / Wizard)

| Aspecto | Estado atual | Com paradas |
|---------|--------------|-------------|
| Schema | `origin`, `destination`, `origin_cep`, `destination_cep` | Mantém legado; adiciona `route_stops: Stop[]` |
| IdentificationStep | 2 campos (origem, destino) | Lista dinâmica: Origem → Paradas → Destino |
| Cliente/destinatário | 1 cliente principal | Embarcador único; destinatários nas paradas |
| Cálculo de KM | `handleCalculateKm(origin_cep, destination_cep)` | `handleCalculateKm(waypoints[])` |
| Validação STEP_FIELDS | `origin`, `destination` | Inclui `route_stops` |

**Arquivos impactados:**
- `src/components/forms/QuoteForm.tsx` (schema, handlers, submit)
- `src/components/forms/quote-form/steps/IdentificationStep.tsx` (UI paradas)
- `src/components/forms/quote-form/QuoteFormWizard.tsx` (STEP_FIELDS)

---

### 3.2 Cálculo de distância (WebRouter)

| Aspecto | Estado atual | Com paradas |
|---------|--------------|-------------|
| Input | `origin_cep`, `destination_cep` | `waypoints: { cep, city_uf, label }[]` ordenados |
| `rota.enderecos` | 2 endereços | N endereços (origem = 0, paradas = 1..n-1, destino = n) |
| Output | `km_distance`, `toll`, `km_by_uf`, `toll_plazas` | Mantém; valores são soma do trajeto completo |

**Arquivos impactados:**
- `supabase/functions/calculate-distance-webrouter/index.ts`

---

### 3.3 Cálculo de frete (calculate-freight)

| Aspecto | Estado atual | Com paradas |
|---------|--------------|-------------|
| Input | `origin`, `destination`, `km_distance` | Agregados já vêm do WebRouter; sem mudança de contrato |
| Output | `pricing_breakdown` (totals, components, meta) | Mantém; pode incluir `meta.route_stops` para auditoria |

**Impacto:** Opcional. O motor de frete continua usando `km_distance` e `toll` agregados. Paradas ficam em `meta` se desejado.

---

### 3.4 Persistência

| Tabela | Ação |
|--------|------|
| `quotes` | Mantém `origin` = primeira parada, `destination` = última (compatibilidade) |
| `quote_route_stops` (nova) | `quote_id`, `sequence`, `stop_type` (origin/stop/destination), `cnpj`, `name`, `cep`, `city_uf`, `planned_km_from_prev`, `metadata` |
| `orders` | Herda `pricing_breakdown`; `origin`/`destination` continuam como resumo |

**Migration sugerida:** `create table quote_route_stops (...)` com FK para `quotes`.

---

### 3.5 Conversão Cotação → OS

| Aspecto | Estado atual | Com paradas |
|---------|--------------|-------------|
| useConvertQuoteToOrder | Cria 1 OS com dados da cotação | Mantém 1 OS; replica `pricing_breakdown` (inclui meta de rota) |
| order.origin / order.destination | Copia de quote | Continua como resumo (primeira/última) |
| order_route_stops (futuro) | N/A | Opcional: copiar paradas da quote para order |

**Impacto:** Baixo. A conversão já copia `value`, `pricing_breakdown`, datas. Paradas via breakdown ou tabela filha.

---

### 3.6 Financeiro (FAT / PAG)

| Aspecto | Estado atual | Com paradas |
|---------|--------------|-------------|
| ensure_financial_document | FAT: source_id = quote_id, total_amount = quote.value | Igual; 1 documento FAT por cotação |
| ensure_financial_document | PAG: source_id = order_id, total_amount = carreteiro_real | Igual; 1 documento PAG por OS |
| financial_installments | Parcelas por doc (advance + balance) | Mantém |
| Kanban financeiro | Cards FAT/PAG por quote/order | Sem mudança estrutural |

**Regra MVP:** 1 viagem = 1 FAT + 1 PAG. Sem rateio por parada.

---

### 3.7 Conciliação (PAG / FAT)

| Aspecto | Estado atual | Com paradas |
|---------|--------------|-------------|
| v_order_payment_reconciliation | expected_amount vs proofs | `expected_amount` já reflete carreteiro real (incluindo custo de rota com paradas) |
| v_quote_payment_reconciliation | quote.value vs quote_payment_proofs | Igual; valor total da cotação |
| payment_proofs.expected_amount | Baseado em order.carreteiro_real / parcelas | Mantém |

**Impacto:** Zero no MVP. Custo de paradas (se houver adicional) entra em `carreteiro_real` ou `trip_cost_items`.

---

### 3.8 DRE operacional

| Aspecto | Estado atual | Com paradas |
|---------|--------------|-------------|
| dre.presumed | Lê `pricing_breakdown.totals`, `components`, `profitability` | Mantém; breakdown já tem km/toll/componentes agregados |
| dre.real | orders + trip_cost_items + gris/risk | Custos extras de paradas: `trip_cost_items` com category adequada (ex. `parada` ou `outros`) |
| dre.comparator | Badges por linha | Sem mudança |
| dre.consolidator | Agrega por período | Sem mudança |

**Recomendação:** Custos de paradas reais em `trip_cost_items` (scope=order, category=`parada` ou `outros`) para o DRE real refletir corretamente.

---

### 3.9 Relatórios, Kanban, Modais

| Componente | Impacto |
|------------|---------|
| Reports.tsx / DRE | Nenhum; DRE usa agregados |
| Kanban Comercial | Cards mostram origem→destino; com paradas, usar "Origem → N paradas → Destino" como label |
| QuoteDetailModal | Exibir rota completa (origem + paradas + destino) ao abrir cotação |
| OrderDetailModal | Idem para OS |
| ConvertQuoteModal | Resumo de rota: "Origem → Parada 1 → … → Destino" em vez de "Origem → Destino" |

---

## 4. Matriz de impactos (resumo)

| Camada | Mudança necessária | Risco |
|--------|--------------------|-------|
| QuoteForm / schema | `route_stops[]`, handlers, validação | Médio |
| IdentificationStep | UI lista paradas, add/remove/reorder, otimizar | Médio |
| calculate-distance-webrouter | Input waypoints, montar endereços | Médio |
| calculate-freight | Nenhum (usa agregados) | Baixo |
| Migration quote_route_stops | Nova tabela | Baixo |
| useQuotes / useCreateQuote | Persistir paradas (insert em quote_route_stops) | Médio |
| ConvertQuoteModal / useOrders | Exibir rota completa; conversão sem alterar lógica | Baixo |
| ensure-financial-document | Nenhum | Nenhum |
| Conciliação | Nenhum | Nenhum |
| DRE | Incluir trip_cost_items com category `parada` em outros_custos | Baixo |
| Modais de detalhe | Exibir rota com paradas | Baixo |

---

## 5. Regras de negócio MVP

1. **Pagador único:** embarcador CIF; cliente faturado = cliente da cotação (ou embarcador se CIF).
2. **Destinatários:** CNPJs nas paradas; não geram documentos financeiros próprios no MVP.
3. **Carga:** peso, cubagem e valor NF somados; sem rateio por parada.
4. **Ordem da rota:** manual; botão "Otimizar rota" opcional (fase 2 se usar API de otimização).
5. **Compatibilidade:** cotação sem paradas = fluxo atual (2 pontos); `route_stops` vazio ou null.

---

## 6. Fases sugeridas

| Fase | Escopo | Entregável |
|------|--------|------------|
| 1 | Modelo + contratos | Migration `quote_route_stops`; tipos; input waypoints no WebRouter |
| 2 | UI wizard | IdentificationStep com paradas; botão [+] e Calcular KM |
| 3 | Persistência | Create/update de paradas; carregamento em edição |
| 4 | Revisão e exibição | ReviewStep, QuoteDetailModal, ConvertQuoteModal mostram rota completa |
| 5 | DRE / custos | trip_cost_items com category para custo de paradas (se houver) |

---

## 7. Critérios de aceite

- [ ] Usuário cria cotação com 2+ paradas e múltiplos destinatários (CNPJs)
- [ ] Cálculo de KM e pedágio considera trajeto completo
- [ ] Ordem manual pode ser alterada (drag/reorder)
- [ ] Cotação salva e reabre com mesmas paradas
- [ ] Conversão em OS mantém 1 OS com dados da rota
- [ ] 1 FAT e 1 PAG por viagem; conciliação sem regressão
- [ ] DRE presume/real reflete custos agregados (sem quebrar fórmulas)
- [ ] Fluxo legado (sem paradas) continua funcionando
