# 🔧 Implementation Patch: Phases 1-3

## Arquivo: `supabase/functions/analyze-load-composition/index.ts`

Aqui estão as mudanças específicas necessárias (em ordem de aplicação):

---

## **MUDANÇA 1: Adicionar imports (linha ~20)**

### ❌ Atual (linhas 21-28)
```typescript
import { calculateRouteDistance } from '../_shared/webrouter-client.ts';
import {
  inferAxesFromWeight,
  getAnttFloorRate,
  calculateSeparateCost,
  calculateConsolidatedCost,
} from '../_shared/antt-utils.ts';
```

### ✅ Novo (substitua por)
```typescript
import { calculateRouteDistance } from '../_shared/webrouter-client.ts';
import {
  inferAxesFromWeight,
  getAnttFloorRate,
  calculateSeparateCost,
  calculateConsolidatedCost,
} from '../_shared/antt-utils.ts';
import {
  checkDataQuality,
  enrichQuoteKmData,
  shouldProceedWithAnalysis,
  getQualityGateReason,
  getInsufficientDataExplanation,
  INSUFFICIENT_DATA_MODEL,
  type DataQualityCheck,
} from '../_shared/composition-data-quality.ts';
```

---

## **MUDANÇA 2: Enriquecer KM após descobrir quotes (linha ~745)**

### ❌ Atual (linha 745)
```typescript
    const quotesTotalInWindow = allQuotes.length;
    const quotesForAnalysis = allQuotes.slice(0, MAX_QUOTES_FOR_COMBINATORICS);
    const truncated = quotesTotalInWindow > MAX_QUOTES_FOR_COMBINATORICS;

    console.log(
      `[analyze] ${triggerSource} — ${quotesForAnalysis.length}/${quotesTotalInWindow} quotes analyzed`
    );
```

### ✅ Novo (substitua por)
```typescript
    const quotesTotalInWindow = allQuotes.length;
    let quotesForAnalysis = allQuotes.slice(0, MAX_QUOTES_FOR_COMBINATORICS);
    const truncated = quotesTotalInWindow > MAX_QUOTES_FOR_COMBINATORICS;

    // NEW PHASE 2: Enrich km_distance from WebRouter if missing
    console.log(`[phase-2] Enriching km_distance for quotes without it...`);
    const enrichmentResult = await enrichQuoteKmData(supabase, quotesForAnalysis, false);
    quotesForAnalysis = enrichmentResult.enriched;

    if (enrichmentResult.updated > 0) {
      console.log(`[phase-2] ✓ Updated ${enrichmentResult.updated} quotes with km_distance`);
    }

    if (enrichmentResult.errors.length > 0) {
      console.warn(`[phase-2] Enrichment errors:`, enrichmentResult.errors);
    }

    console.log(
      `[analyze] ${triggerSource} — ${quotesForAnalysis.length}/${quotesTotalInWindow} quotes analyzed`
    );
```

---

## **MUDANÇA 3: Data Quality Gate no loop de análise (linhas ~786-801)**

### ❌ Atual (linhas 786-801)
```typescript
    for (const combo of combinations) {
      try {
        const result = await analyzeCombo(combo, false, supabase);
        result.trigger_source = triggerSource;
        result.anchor_quote_id = anchorQuoteId;

        if (
          result.consolidation_score >= minViableScore * 0.7 && // looser threshold for phase 1
          result.estimated_savings_brl >= MIN_SAVINGS_CENTAVOS * 0.5
        ) {
          allResults.push(result);
        }
      } catch (e) {
        console.error('[analyze] Combo error:', e);
      }
    }
```

### ✅ Novo (substitua por)
```typescript
    for (const combo of combinations) {
      try {
        // NEW PHASE 1: Data Quality Gate
        const qualityCheck = checkDataQuality(combo);

        if (!shouldProceedWithAnalysis(qualityCheck)) {
          const reason = getQualityGateReason(qualityCheck);
          console.log(`[phase-1] Combo rejected (quality=${qualityCheck.totalScore}%): ${reason}`);
          continue; // Skip this combination
        }

        const result = await analyzeCombo(combo, false, supabase);
        result.trigger_source = triggerSource;
        result.anchor_quote_id = anchorQuoteId;

        // NEW PHASE 3: Filter out insufficient_data / mock_v1 results
        if (result.route_evaluation_model === INSUFFICIENT_DATA_MODEL ||
            result.route_evaluation_model === 'mock_v1') {
          console.warn(
            `[phase-3] Rejecting ${result.route_evaluation_model} result for combo: ${combo.map(q => q.id).join(',')}`
          );
          continue; // Don't save
        }

        if (
          result.consolidation_score >= minViableScore * 0.7 && // looser threshold for phase 1
          result.estimated_savings_brl >= MIN_SAVINGS_CENTAVOS * 0.5
        ) {
          allResults.push(result);
        }
      } catch (e) {
        console.error('[analyze] Combo error:', e);
      }
    }
```

---

## **MUDANÇA 4: Filtro adicional no WebRouter pass (linhas ~812-846)**

### ❌ Atual (linhas 812-846)
```typescript
    for (const candidate of topCandidates) {
      // Re-evaluate with WebRouter
      const quoteIds = candidate.quote_ids;
      const quotes = quoteIds
        .map((id) => quotesForAnalysis.find((q) => q.id === id)!)
        .filter(Boolean);

      if (quotes.length < 2) continue;

      try {
        const refined = await analyzeCombo(quotes, true, supabase);
        refined.trigger_source = triggerSource;
        refined.anchor_quote_id = anchorQuoteId;

        if (
          refined.consolidation_score >= minViableScore &&
          refined.estimated_savings_brl >= MIN_SAVINGS_CENTAVOS
        ) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _preScore, ...row } = refined;
          refinedResults.push(row);
        }
      } catch (e) {
        console.error('[analyze] WebRouter refinement error:', e);
        // Keep the pre-scored version if it passes thresholds
        if (
          candidate.consolidation_score >= minViableScore &&
          candidate.estimated_savings_brl >= MIN_SAVINGS_CENTAVOS
        ) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _preScore, ...row } = candidate;
          refinedResults.push(row);
        }
      }
    }
```

### ✅ Novo (substitua por)
```typescript
    for (const candidate of topCandidates) {
      // Re-evaluate with WebRouter
      const quoteIds = candidate.quote_ids;
      const quotes = quoteIds
        .map((id) => quotesForAnalysis.find((q) => q.id === id)!)
        .filter(Boolean);

      if (quotes.length < 2) continue;

      try {
        const refined = await analyzeCombo(quotes, true, supabase);
        refined.trigger_source = triggerSource;
        refined.anchor_quote_id = anchorQuoteId;

        // NEW PHASE 3: Filter insufficient_data results
        if (refined.route_evaluation_model === INSUFFICIENT_DATA_MODEL ||
            refined.route_evaluation_model === 'mock_v1') {
          console.warn(
            `[phase-3] Skipping ${refined.route_evaluation_model} result in WebRouter pass`
          );
          continue;
        }

        if (
          refined.consolidation_score >= minViableScore &&
          refined.estimated_savings_brl >= MIN_SAVINGS_CENTAVOS
        ) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _preScore, ...row } = refined;
          refinedResults.push(row);
        }
      } catch (e) {
        console.error('[analyze] WebRouter refinement error:', e);
        // Keep the pre-scored version if it passes thresholds
        // BUT: Skip if it's insufficient_data/mock
        if (
          candidate.route_evaluation_model !== INSUFFICIENT_DATA_MODEL &&
          candidate.route_evaluation_model !== 'mock_v1' &&
          candidate.consolidation_score >= minViableScore &&
          candidate.estimated_savings_brl >= MIN_SAVINGS_CENTAVOS
        ) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _preScore, ...row } = candidate;
          refinedResults.push(row);
        }
      }
    }
```

---

## **MUDANÇA 5: Também filtrar non-top candidates (linhas ~848-858)**

### ❌ Atual
```typescript
    // Also keep non-top candidates that passed final thresholds (phase 1 only)
    for (const candidate of allResults.slice(MAX_WEBROUTER_EVALUATIONS)) {
      if (
        candidate.consolidation_score >= minViableScore &&
        candidate.estimated_savings_brl >= MIN_SAVINGS_CENTAVOS
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _preScore, ...row } = candidate;
        refinedResults.push(row);
      }
    }
```

### ✅ Novo
```typescript
    // Also keep non-top candidates that passed final thresholds (phase 1 only)
    for (const candidate of allResults.slice(MAX_WEBROUTER_EVALUATIONS)) {
      // NEW PHASE 3: Skip insufficient_data/mock results
      if (candidate.route_evaluation_model === INSUFFICIENT_DATA_MODEL ||
          candidate.route_evaluation_model === 'mock_v1') {
        continue;
      }

      if (
        candidate.consolidation_score >= minViableScore &&
        candidate.estimated_savings_brl >= MIN_SAVINGS_CENTAVOS
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _preScore, ...row } = candidate;
        refinedResults.push(row);
      }
    }
```

---

## **MUDANÇA 6: Modificar evaluateRouteFit para usar 'insufficient_data' (linha ~251-396)**

Este é o maior refactor. Você precisa:

### **6A. Adicionar constante KM_DATA_THRESHOLD (perto de outras constantes)**

```typescript
// Aproximadamente linha 105, perto de MAX_CORRIDOR_DELTA_PERCENT
const KM_DATA_THRESHOLD = 0.7; // 70% of quotes must have km data
```

### **6B. No início de evaluateRouteFit() (linha ~251), adicionar validação:**

```typescript
async function evaluateRouteFit(
  quotes: QuoteRow[],
  useWebRouter: boolean
): Promise<RouteEvaluation> {
  const sorted = [...quotes].sort((a, b) => (b.km_distance ?? 0) - (a.km_distance ?? 0));
  const mainQuote = sorted[0];
  const secondaryQuotes = sorted.slice(1);
  const baseKmTotal = quotes.reduce((sum, q) => sum + (q.km_distance ?? 0), 0);

  // NEW PHASE 3: Check minimum km data threshold
  const quotesWithKm = quotes.filter((q) => q.km_distance && q.km_distance > 0).length;
  const kmDataAvailable = (quotesWithKm / quotes.length) >= KM_DATA_THRESHOLD;

  if (!kmDataAvailable) {
    const needed = Math.ceil(quotes.length * KM_DATA_THRESHOLD);
    return {
      base_km_total: 0,
      composed_km_total: 0,
      delta_km_abs: 0,
      delta_km_percent: 0,
      is_corridor_fit: false,
      model: INSUFFICIENT_DATA_MODEL,
      explanation: `Dados insuficientes de distância. ${quotesWithKm}/${needed} cotações com km preenchido. Preencha o campo "Distância (km)" nas cotações.`,
    };
  }

  // Rest of function continues as before...
```

### **6C. No final de evaluateRouteFit(), antes do "last resort" (linha ~385), mudar MOCK para INSUFFICIENT_DATA:**

```typescript
  // Last resort: no km data available → REJECT (don't return mock)
  const cities = quotes.map((q) => q.destination.split(' - ')[0]).join(' → ');
  return {
    base_km_total: 0,
    composed_km_total: 0,
    delta_km_abs: 0,
    delta_km_percent: 0,
    is_corridor_fit: false,
    model: INSUFFICIENT_DATA_MODEL,  // Changed from 'mock_v1'
    explanation: `Sem dados de distância para avaliar rota ${cities}. Preencha CEPs e calcule km nas cotações.`,
  };
}
```

---

## **Resumo das Mudanças**

| Mudança | Arquivo | Linhas | Propósito |
|---------|---------|--------|-----------|
| 1 | analyze-load-composition/index.ts | ~20 | Adicionar imports |
| 2 | analyze-load-composition/index.ts | ~745 | Enriquecer KM (Phase 2) |
| 3 | analyze-load-composition/index.ts | ~786 | Data quality gate (Phase 1) |
| 4 | analyze-load-composition/index.ts | ~812 | Filtrar insufficient_data no WebRouter pass |
| 5 | analyze-load-composition/index.ts | ~848 | Filtrar insufficient_data em non-top candidates |
| 6 | analyze-load-composition/index.ts | ~251-396 | Usar insufficient_data em vez de mock_v1 (Phase 3) |
| — | composition-data-quality.ts | NEW | Novo arquivo com utilitários |

---

## **Ordem de Aplicação Recomendada**

1. ✅ Criar novo arquivo `composition-data-quality.ts` (já feito)
2. ✅ Aplicar MUDANÇA 1 (imports)
3. ✅ Aplicar MUDANÇA 6 (evaluateRouteFit)
4. ✅ Aplicar MUDANÇA 2 (enrichQuoteKmData)
5. ✅ Aplicar MUDANÇA 3 (quality gate no loop principal)
6. ✅ Aplicar MUDANÇA 4 (filtro WebRouter pass)
7. ✅ Aplicar MUDANÇA 5 (filtro non-top candidates)
8. ✅ Testes

---

## **Validação Pós-Implementação**

### **Verificações importantes**

```bash
# 1. Compilação
npx deno check supabase/functions/analyze-load-composition/index.ts

# 2. Deploy
supabase functions deploy analyze-load-composition --no-verify-jwt

# 3. Teste com dados insuficientes
curl -X POST http://localhost:54321/functions/v1/analyze-load-composition \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "shipper_id": "xxx",
    "trigger_source": "batch"
  }'
# Esperado: suggestions vazio, nenhum resultado com mock_v1
```

### **Logs esperados**

```
[phase-2] Enriching km_distance for quotes without it...
[phase-2] ✓ Updated N quotes with km_distance
[phase-1] Combo rejected (quality=45%): Apenas 1/2 cotações com distância (km)
[phase-3] Rejecting insufficient_data result for combo: ...
[analyze] 2 passed thresholds, 0 duplicates skipped, 2 new
```

