# Análise 360°: km_distance e colunas inteiras (km_from/km_to)

Este documento mapeia todos os pontos do sistema em que `km_distance`, `km_from` e `km_to` são produzidos, consumidos ou persistidos. Qualquer alteração em um ponto deve considerar os impactos nos demais.

---

## Schema do banco (fonte da verdade)

| Tabela            | Coluna     | Tipo      | Comportamento                                       |
|-------------------|------------|-----------|-----------------------------------------------------|
| `quotes`          | `km_distance` | integer | Não aceita decimal → 22P02 se enviar `1718.8`       |
| `price_table_rows`| `km_from`  | integer   | Não aceita decimal em filtros PostgREST             |
| `price_table_rows`| `km_to`    | integer   | Não aceita decimal em filtros PostgREST             |

---

## Fluxo de dados km_distance

### 1. Origem (produção de km_distance)

| Arquivo                       | Retorno                         | Nota                                                  |
|------------------------------|----------------------------------|-------------------------------------------------------|
| `calculate-distance`         | `Math.round(km*10)/10`          | 1 casa decimal (ex: 1718.8)                           |
| `calculate-distance-webrouter` | `Math.round(km*10)/10`        | 1 casa decimal                                        |
| `lookup-cep` + integração distância | Varia                    | Depende do provedor                                   |
| `FreightSimulator`           | `parseFloat(kmDistance)`        | Input manual do usuário (pode ser decimal)            |
| `QuoteForm` (CEP preenchido) | `Number(data.data.km_distance)`  | Valor vindo da API de distância (pode ser decimal)    |

### 2. Consumidores (onde km é usado)

| Arquivo                         | Uso                                    | Arredondamento? | Status          |
|---------------------------------|----------------------------------------|-----------------|-----------------|
| `QuoteForm` → INSERT `quotes`   | `km_distance` no payload                | ✅ `Math.round()`| Corrigido       |
| `QuoteForm` → `usePriceTableRowByKmRange` | Filtro `km_from`/`km_to`         | ✅ `kmRounded`   | Já correto      |
| `calculate-freight` (Edge Fn)   | Filtro `price_table_rows`               | ✅ `kmForBand`   | Corrigido       |
| `freightCalculator.ts` (local)  | Validação visual (row já resolvida)     | N/A (usa row)   | OK              |
| `FreightSimulator`              | Chama Edge Function                    | ❌ passa direto  | OK (Edge trata) |
| `QuoteDetailModal` / `OrderDetailModal` | Display + ANTT floor              | Display only     | OK              |
| `useOrders`                     | Copia `km_distance` de quote           | Herda do quote   | OK              |

### 3. price_table_rows: inserções

| Arquivo                    | Fonte km_from/km_to           | Garantia inteiro?      |
|----------------------------|-------------------------------|------------------------|
| `import-price-table` (EF)   | Parse do Excel/JSON           | `row.km_from`/`row.km_to` – parser deve retornar inteiro |
| `priceTableParser.ts`      | `parseKmStrict` ou range      | `parseKmStrict` usa parseInt/floor |
| `useCreatePriceTableRow`   | Dados do form                 | Validar no form       |
| `useImportPriceTable`      | Dados do parser               | Herda do parser       |

---

## Regra única recomendada

**Para qualquer interação com PostgREST em colunas `integer`:**

```ts
const kmForDb = data.km_distance != null && Number.isFinite(Number(data.km_distance))
  ? Math.round(Number(data.km_distance))
  : null;
```

- Filtros: `km_from <= kmForDb`, `km_to >= kmForDb`
- INSERT em `quotes`: `km_distance: kmForDb`

---

## Pontos de atenção em futuras alterações

1. **Novas APIs de distância** – Se retornarem decimal, o consumidor deve arredondar antes de persistir ou filtrar.
2. **Novas queries em `price_table_rows`** – Sempre usar inteiro no filtro (`km_from`/`km_to`).
3. **Migração para `numeric`** – Se `km_from`/`km_to` ou `quotes.km_distance` forem alterados para `numeric`, remover os `Math.round()` nos consumidores.
4. **Importação de tabelas** – Garantir que `parseKmStrict` (ou equivalente) retorne inteiro para faixas de km.
5. **Formulários de faixa** – Validar que o usuário não possa inserir decimais em `km_from`/`km_to` se o schema continuar integer.

---

## Histórico de correções

| Data  | Alteração                                                    | Motivo                    |
|-------|--------------------------------------------------------------|---------------------------|
| 2025  | `QuoteForm`: `Math.round(km_distance)` no INSERT             | 22P02 em INSERT quotes    |
| 2025  | `calculate-freight`: `kmForBand = Math.round(km_distance)` no filtro | 22P02 em filtro price_table_rows |
