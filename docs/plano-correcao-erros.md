# Plano de Correção de Erros

Documento centralizado de correções aplicadas e pendentes. **Atualizar sempre que uma correção for executada** — processo automático.

---

## O que já foi commitado

| Commit | Descrição | Arquivos |
|--------|-----------|----------|
| `4e6c08b` | Faixa km client-side + moeda pt-BR + análise 360 | QuoteForm, masked-input, calculate-freight, km-distance-360-analysis.md |
| `1fd1ae2` | Arredondar km_distance + tratamento de erros em cotações | QuoteForm |

---

## Código para consulta

```bash
# Ver últimos commits
git log --oneline -10

# Ver diff de um commit específico
git show 4e6c08b
git show 1fd1ae2

# Status atual (o que mudou e não foi commitado)
git status

# Commit + push + deploy (após correções)
git add -A && git commit -m "fix: descrição" && git push
supabase functions deploy price-row
supabase functions deploy calculate-freight
```

---

## Correções já executadas

### 1. km_distance 22P02 (invalid_text_representation)

| Commit | Arquivos | Problema | Solução |
|--------|----------|----------|---------|
| `1fd1ae2` | `QuoteForm.tsx` | `quotes.km_distance` integer; frontend enviava decimal | `Math.round(Number(data.km_distance))` no payload |
| `1fd1ae2` | `QuoteForm.tsx` catch | Erro genérico sem detalhe | `console.error` + toast com `error.message` |
| `4e6c08b` | `QuoteForm.tsx` | Filtro `price_table_rows` por km com decimal | `usePriceTableRows` + `.find()` no cliente |
| `4e6c08b` | `calculate-freight/index.ts` | Query com km decimal | Buscar todas as faixas e filtrar no código |

### 2. Formatação moeda pt-BR

| Commit | Arquivos | Problema | Solução |
|--------|----------|----------|---------|
| `4e6c08b` | `masked-input.tsx` | Sem máscara para moeda | Novo tipo `currency` (1.234,56) |
| `4e6c08b` | `QuoteForm.tsx` | Valor Mercadoria e Pedágio sem formatação | `MaskedInput` com `mask="currency"` + R$ |

### 3. Documentação

| Commit | Arquivos | Descrição |
|--------|----------|-----------|
| `4e6c08b` | `docs/km-distance-360-analysis.md` | Análise 360° de km_distance e fluxos |

---

## Correções executadas (aguardando commit)

### 4. 22003 numeric overflow (atualização da cotação)

| Arquivo | Solução aplicada |
|---------|------------------|
| `QuoteForm.tsx` | Schema: `weight` e `volume` com `.max(99_999_999)` |
| `QuoteForm.tsx` | `effectiveWeightKg = Math.min(rawKg, 99_999_999.99)` |
| `QuoteForm.tsx` | `quoteData`: clamp de `weight` e `volume`; `cubage_weight`/`billable_weight` com checagem explícita (preserva 0) |
| `QuoteForm.tsx` | Input peso: `min`, `max`, `step` |

**Causa:** `quotes.weight` e `quotes.volume` são `DECIMAL(10,2)` — máx. 99.999.999,99.

### 5. MISSING_DATA / tabela lotação + price_table_rows (cálculo zerado)

| Arquivo | Problema | Solução |
|---------|----------|---------|
| `QuoteForm.tsx` | Dropdown mostra todas as tabelas; tabela lotação sem rows retorna cálculo zerado | Filtrar tabelas por `freight_modality` (só lotação ou fracionado) |
| `QuoteForm.tsx` | `priceTableId` não passado → mensagem errada "Tabela não selecionada" | Passar `priceTableId` para `calculateFreight` |
| `QuoteForm.tsx` | Permitir save com MISSING_DATA | Bloquear submit quando `status === 'MISSING_DATA'` ou `isLoadingPriceRow` |
| `QuoteForm.tsx` | Modalidade muda mas `price_table_id` pode ficar incoerente | Limpar `price_table_id` ao mudar modalidade se tabela não pertencer à nova |

**Causa:** Tabela sem linhas em `price_table_rows` (rows=0) ou tabela de modalidade diferente; mensagem enganosa por falta de `priceTableId`.

### 6. OUT_OF_RANGE / faixa por km via RPC e Edge Function

| Item | Descrição |
|------|-----------|
| RPC `find_price_row_by_km` | Criada no Supabase (borda exclusiva no fim, rounding configurável) |
| Edge Function `price-row` | CORS, full row fetch, default rounding `round` |
| `usePriceTableRowByKmFromEdgeFn` | Hook que chama Edge Function price-row |
| `QuoteForm.tsx` | Usa Edge Function em vez de `.find()` em todas as linhas — alerta some e botão habilita quando faixa existe |

**Causa:** Distância (ex.: 1718.9 km) não encontrava faixa com lógica client-side inclusiva; RPC usa borda exclusiva no fim, permitindo match correto.

---

## Correções pendentes

*Nenhuma no momento.*

---

## Checklist ao aplicar correção

1. [ ] Executar a alteração no código
2. [ ] Mover item de "Correções pendentes" para "Correções já executadas"
3. [ ] Registrar commit em "O que já foi commitado"
4. [ ] Atualizar `docs/km-distance-360-analysis.md` se houver impacto em km

---

## Erros por código PostgreSQL

| Código | Significado | Ocorrências neste projeto |
|--------|-------------|---------------------------|
| 22P02 | invalid_text_representation | km com decimal em coluna integer |
| 22003 | numeric field overflow | weight/volume acima de DECIMAL(10,2) |
