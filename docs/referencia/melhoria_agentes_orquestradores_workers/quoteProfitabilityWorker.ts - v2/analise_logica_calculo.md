# quoteProfitabilityWorker.ts — Análise da Lógica de Cálculo

> Analisa a rentabilidade de uma cotação de frete, comparando-a com o histórico e o piso ANTT.
> Coleta dados da cotação, margens históricas e histórico do cliente.

---

## Fluxo Geral

```
entityId (quote_id)
       │
       ├─── fetchQuoteData()         → dados da cotação
       ├─── fetchHistoricalMargins() → benchmark interno (paralelo)
       └─── fetchClientHistory()     → histórico do cliente
                    │
              buildPrompt()
                    │
                callLLM()
                    │
            validateAndParse()
                    │
            → ai_insights (salvo, expira em 7 dias)
```

---

## 1. Coleta de Dados

### `fetchQuoteData`
Busca `quotes.*` pelo `entityId` (quote_id único).

### `fetchHistoricalMargins`
Últimas **30 cotações com `stage = 'ganho'`**, extrai a margem de `pricing_breakdown.profitability` e calcula:

| Métrica  | Fórmula                          |
|----------|----------------------------------|
| `avg`    | `Σ margens / n`                  |
| `stdDev` | `√( Σ(m - avg)² / n )`          |

> Suporta dois formatos de campo: `margemPercent` (camelCase) e `margem_percent` (snake_case) — cobertura de legado.

### `fetchClientHistory`
Últimas **10 cotações do mesmo `client_name`**, para calcular a margem média específica desse cliente.

---

## 2. Montagem do Prompt (`buildPrompt`)

Métricas calculadas localmente **antes** de ir ao LLM:

| Cálculo          | Código                                  |
|------------------|-----------------------------------------|
| `valorPorKm`     | `quote.value / quote.km_distance`       |
| `avgClientMargin`| média das margens do cliente filtradas de `pricing_breakdown` |

O prompt entrega ao LLM:
- Dados brutos da cotação (rota, valor, distância)
- `pricing_breakdown.profitability`: `custosCarreteiro`, `custosDiretos`, `margemBruta`, `margemPercent`, `resultadoLiquido`
- `meta.antt.total` → piso ANTT calculado para a rota
- Benchmark histórico: média + desvio padrão das 30 cotações ganhas
- Histórico do cliente: margem média + total de cotações ganhas

---

## 3. Regras de Decisão (aplicadas pelo LLM via system prompt)

```
margem < 8%          → risco ALTO
margem 8% – 15%      → risco MEDIO
margem > 15%         → risco BAIXO
valor < piso ANTT    → risco ALTO (sobrepõe qualquer margem)
```

---

## 4. Output Estruturado

```json
{
  "risk": "baixo|medio|alto",
  "confidence_score": 0–100,
  "metrics": {
    "margem_percent": number,
    "margem_vs_media": "acima|abaixo|na_media",
    "desvio_da_media_pct": number,
    "atende_piso_antt": boolean,
    "valor_por_km": number | null
  },
  "recommendation": "1-2 frases",
  "summary": "2-3 linhas",
  "details": "3-5 frases"
}
```

Salvo em `ai_insights` com TTL de **7 dias**.

---

## 5. Pontos de Atenção (Base para v2)

### 5.1 `desvio_da_media_pct` calculado pelo LLM
O worker entrega `avg` e `stdDev`, mas não pré-calcula `(margem_atual - avg) / stdDev`.
Isso pode gerar inconsistência se o modelo interpretar diferente a cada chamada.
**Melhoria:** pré-calcular no worker e enviar como campo numérico estruturado.

### 5.2 `avgClientMargin` enviado como texto
É calculado localmente mas **não é enviado como campo estruturado** — vai embutido no texto do prompt como string formatada, perdendo precisão numérica.
**Melhoria:** incluir no payload estruturado separado do texto narrativo.

### 5.3 Benchmark sem normalização de rota
As 30 cotações históricas misturam **todas as rotas**. Uma cotação SP→AM será comparada contra a média de SP→SP, distorcendo o `margem_vs_media`.
**Melhoria:** filtrar `fetchHistoricalMargins` pelo mesmo corredor ou faixa de distância (ex.: ± 20% do `km_distance` atual).

---

## Arquivos Relacionados

| Arquivo | Responsabilidade |
|---|---|
| `_shared/workers/quoteProfitabilityWorker.ts` | Orquestração, coleta de dados, montagem do prompt |
| `_shared/prompts/system_quote_profitability.ts` | System prompt + regras de decisão + schema JSON de resposta |
| `_shared/prompts/schemas.ts` | `validateAndParse<QuoteProfitabilityResult>` |
| `_shared/aiClient.ts` | `callLLM` — abstração do provider (Anthropic) |
| `supabase: ai_insights` | Tabela de persistência dos resultados (TTL 7d) |
| `supabase: quotes` | Fonte de dados (cotação atual + histórico) |
