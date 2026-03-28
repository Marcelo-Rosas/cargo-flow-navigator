# Matriz de Roteamento Gemini — Flash vs Pro

## Implementação atual

Arquivo: `supabase/functions/_shared/gemini.ts` → `selectGeminiModel()`

| analysisType | Modelo | Justificativa |
|---|---|---|
| `approval_summary` | gemini-2.5-pro | Resumos de aprovação exigem raciocínio sobre múltiplos critérios |
| `dashboard_insights` | gemini-2.5-pro | Insights de dashboard cruzam métricas diversas |
| `quote_profitability` | gemini-2.0-flash | Cálculo direto com dados estruturados |
| `financial_anomaly` | gemini-2.0-flash | Detecção de padrões com regras claras |
| (default) | gemini-2.0-flash | Qualquer outro tipo de análise |

## nina-orchestrator (Navi)

O nina-orchestrator **não usa** `selectGeminiModel()` — ele sempre usa `gemini-2.0-flash` diretamente com function calling. Isso é intencional: conversação WhatsApp prioriza latência baixa.

## Custo comparativo

| Modelo | Input (1M tokens) | Output (1M tokens) | Latência típica |
|---|---|---|---|
| gemini-2.0-flash | ~$0.10 | ~$0.40 | 0.5–1.5s |
| gemini-2.5-pro | ~$1.25 | ~$5.00 | 2–8s |

**Flash é ~10x mais barato** — usar Pro apenas quando a qualidade da resposta justifica.

## Quando usar Pro (critérios)

Usar `gemini-2.5-pro` quando:
1. A análise cruza **múltiplas fontes de dados** (ex: cotações + OS + financeiro)
2. O output precisa de **raciocínio multi-step** (ex: resumo executivo com recomendações)
3. A decisão tem **impacto financeiro direto** (ex: aprovação de cotação de alto valor)

Usar `gemini-2.0-flash` para todo o resto:
- Conversação WhatsApp (Navi)
- Cotações padrão
- Status/consultas simples
- Classificação de texto
- Detecção de anomalias com regras claras

## Configuração no nina-orchestrator

```typescript
// Atualmente em index.ts (hardcoded)
const MODEL = 'gemini-2.0-flash';
const MAX_OUTPUT_TOKENS = 2048;
const TEMPERATURE = 0.3;
```

Para trocar modelo por complexidade da mensagem (Sprint 2):
```typescript
// Proposta futura — roteamento por complexidade
function selectNaviModel(message: string): GeminiModel {
  const complexIndicators = ['analisa', 'compare', 'relatório', 'resumo executivo'];
  const isComplex = complexIndicators.some(w => message.toLowerCase().includes(w));
  return isComplex ? 'gemini-2.5-pro' : 'gemini-2.0-flash';
}
```
