# Buonny Check Worker

Edge Function para validação e cotação de seguro de carga via Buonny API.

## Contrato

### Request

```typescript
{
  origin_uf: string;        // Estado de origem (ex: "SP")
  destination_uf: string;   // Estado de destino (ex: "RJ")
  weight: number;           // Peso em kg (> 0)
  product_type: string;     // Tipo de produto (ex: "general")
}
```

### Response (Sucesso ou Fallback)

```typescript
{
  options: InsuranceOption[];
  cached?: boolean;
  timestamp?: string;
}
```

Onde `InsuranceOption`:
```typescript
{
  coverage_type: "BASIC" | "STANDARD" | "PLUS";
  estimated_premium: number;  // em centavos (ex: 50000 = R$ 500,00)
  features: string[];
  restrictions: string[];
  risk_level?: "low" | "medium" | "high";
}
```

### Status HTTP

- **200** - Sucesso (com dados reais ou fallback)
- **400** - Erro de validação (origem/destino/weight inválidos)
- **500** - Erro interno (será retornado fallback mesmo assim)

## Logging

Cada request insere 1 linha em `insurance_logs` com:

| Campo | Tipo | Descrição |
|---|---|---|
| `environment` | `text` | `'prod'` (ou `'dev'`/`'staging'` se configurado) |
| `source` | `text` | `'edge_function'` |
| `function_name` | `text` | `'buonny-check-worker'` |
| `request_id` | `uuid` | Identificador único da chamada |
| `status` | `text` | `'success'` \| `'error'` \| `'timeout'` \| `'rate_limit'` \| `'fallback'` |
| `error_code` | `text` | Opcional; ex: `'RATE_LIMIT_ERROR'`, `'TIMEOUT_ERROR'` |
| `duration_ms` | `integer` | Tempo total de processamento |
| `origin_uf` | `text` | UF da origem |
| `destination_uf` | `text` | UF do destino |
| `weight` | `numeric` | Peso em kg |
| `product_type` | `text` | Tipo de produto |
| `fallback_used` | `boolean` | Se usou `DEFAULT_COVERAGE_OPTIONS` |
| `premium_estimate` | `numeric` | Prêmio estimado (centavos) da opção principal (STANDARD) |
| `raw` | `jsonb` | Contexto adicional (options_count, erro, etc.) |

## Integração com Hook

O hook `useInsuranceOptionsRefactored` chama esta função via:

```typescript
const result = await invokeEdgeFunction('buonny-check-worker', {
  origin_uf: originUf,
  destination_uf: destinationUf,
  weight,
  product_type,
})
```

## Fallback

Se a API Buonny falhar (timeout, erro, rate limit), a função retorna `DEFAULT_COVERAGE_OPTIONS`:

- **BASIC**: R$ 500/viagem
- **STANDARD**: R$ 1.000/viagem (recomendado)
- **PLUS**: R$ 1.500/viagem

O campo `fallback_used: true` marca quando o fallback foi acionado.

## TODO: Integração Real com Buonny

Substitua o `// TODO` na linha ~164 com:

```typescript
const options = await callBuonnyAPI({
  origin_uf: body.origin_uf,
  destination_uf: body.destination_uf,
  weight: body.weight,
  product_type: body.product_type,
});
```

Detalhes de configuração:
- Variáveis de env: `VITE_BUONNY_API_KEY`, `VITE_BUONNY_API_URL` (no `.env`)
- Tipo de erro a tratar: 429 (rate limit), 5xx (server error), timeout (após N segundos)

## Métricas Derivadas

As views SQL (`insurance_metrics_*`) consumem os logs para gerar:

- Request volume + success rate
- Latência (P50/P95/P99)
- Error breakdown
- Fallback ratio

Ver `insurance_logs` schema em Supabase.
