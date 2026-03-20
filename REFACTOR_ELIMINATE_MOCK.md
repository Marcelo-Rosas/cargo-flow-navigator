# 🔧 Refatoração: Eliminar Mock — Usar Apenas Dados Reais

**Objetivo**: Garantir que sempre temos dados suficientes (WebRouter ou Stored KM) para avaliar rota, sem cair no fallback `mock_v1`

---

## 📋 Análise do Problema Atual

### **Hierarquia de Modelos (analyze-load-composition/index.ts)**

```typescript
// Linha 251-396
async function evaluateRouteFit(quotes: QuoteRow[], useWebRouter: boolean): Promise<RouteEvaluation> {
  // 1. Tenta WebRouter (real)
  if (useWebRouter && sharedOriginCep && mainQuote.destination_cep) {
    const result = await calculateRouteDistance(...);
    // SUCCESS → retorna webrouter_v1
  }

  // 2. Fallback Stored KM (estimativa)
  if (baseKmTotal > 0 && mainQuote.km_distance && mainQuote.km_distance > 0) {
    estimatedComposedKm = mainKm + (secondaryKm * 0.3); // heurística
    // SUCCESS → retorna stored_km_v1
  }

  // 3. Last Resort MOCK (❌ PROBLEMA)
  return {
    base_km_total: 0,
    composed_km_total: 0,
    delta_km_abs: 0,
    delta_km_percent: 0,
    is_corridor_fit: false,
    model: 'mock_v1', // ❌ Sem dados
    explanation: `Sem dados de distância...`,
  };
}
```

### **Cenários que Caem em Mock**

```
❌ Nenhum km_distance nos quotes
❌ CEPs inválidos (< 8 dígitos)
❌ WebRouter não configurado (no env var)
❌ Destino final vazio
❌ Nenhuma rota_stops
```

---

## 🎯 Estratégia de Refatoração

### **FASE 1: Validação Upfront (Evitar Consolidação Inviável)**

#### **1A. Validar dados ANTES de analisar combinação**

```typescript
// NOVO: Adicionar validation gate em discoverCandidates()

interface DataQualityCheck {
  hasKmData: boolean;
  hasCepData: boolean;
  hasLoadingDates: boolean;
  score: number; // 0-100, deve ser >= 70
}

function checkDataQuality(quotes: QuoteRow[]): DataQualityCheck {
  const withKm = quotes.filter(q => q.km_distance && q.km_distance > 0).length;
  const withCep = quotes.filter(q => q.origin_cep && q.destination_cep).length;
  const withDate = quotes.filter(q => q.estimated_loading_date).length;

  const score =
    (withKm / quotes.length) * 40 +           // 40% — km data
    (withCep / quotes.length) * 30 +          // 30% — CEP data
    (withDate / quotes.length) * 30;          // 30% — loading dates

  return {
    hasKmData: withKm >= Math.ceil(quotes.length * 0.7), // 70% minimum
    hasCepData: withCep >= quotes.length * 0.5,           // 50% ideal
    hasLoadingDates: withDate === quotes.length,          // 100% required
    score,
  };
}
```

#### **1B. Aplicar gate antes de analyzeCombo()**

```typescript
// Em analyze-load-composition/index.ts → main loop

async function processCompositionCandidates(candidates: QuoteRow[][]): Promise<SuggestionRow[]> {
  const results: SuggestionRow[] = [];

  for (const combo of candidates) {
    // NEW: Check data quality first
    const quality = checkDataQuality(combo);

    if (quality.score < 70) {
      console.log(`[quality-gate] Combo rejected: score=${quality.score}%`);
      continue; // Skip this combination
    }

    // Only analyze if data quality acceptable
    const suggestion = await analyzeCombo(combo, useWebRouter, supabase);

    // ALSO: Skip if result is mock_v1
    if (suggestion.route_evaluation_model === 'mock_v1') {
      console.warn(`[mock-filter] Rejecting mock_v1 result for ${combo.map(q => q.id).join(',')}`);
      continue; // Don't save mock results
    }

    results.push(suggestion);
  }

  return results;
}
```

---

### **FASE 2: Enriquecer Dados em Tempo Real**

#### **2A. Preencher KM automaticamente via CEP**

Se quote tem CEPs mas falta `km_distance`, **calcular dinamicamente**:

```typescript
// NOVO hook: src/hooks/useEnrichQuoteData.ts

export async function enrichQuoteKmData(
  supabase: SupabaseClient,
  quotes: QuoteRow[]
): Promise<QuoteRow[]> {
  return Promise.all(
    quotes.map(async (q) => {
      // Se já tem km_distance, skip
      if (q.km_distance && q.km_distance > 0) return q;

      // Se tem CEPs, tenta calcular
      if (q.origin_cep && q.destination_cep) {
        const originCep = q.origin_cep.replace(/\D/g, '');
        const destCep = q.destination_cep.replace(/\D/g, '');

        if (originCep.length === 8 && destCep.length === 8) {
          const result = await calculateRouteDistance(originCep, destCep, []);
          if (result.success) {
            return {
              ...q,
              km_distance: result.km_distance, // Atualizar em memória
            };
          }
        }
      }

      return q;
    })
  );
}
```

#### **2B. Usar no analyzeCombo()**

```typescript
// Em analyze-load-composition → main handler

async function main(req: Request) {
  // ... get quotes ...
  const quotes = (data ?? []) as QuoteRow[];

  // NEW: Enrich km data if missing
  const enrichedQuotes = await enrichQuoteKmData(supabase, quotes);

  // Process combinações com dados enriquecidos
  const candidates = generatePairTripleCombinations(enrichedQuotes);
  const results = await processCompositionCandidates(candidates);

  // ... save results ...
}
```

---

### **FASE 3: Fallback Smarter (Não Carregar Dados Faltando)**

#### **3A. Se WebRouter falha, exigir km_distance mínimo**

```typescript
async function evaluateRouteFit(
  quotes: QuoteRow[],
  useWebRouter: boolean
): Promise<RouteEvaluation> {
  const sorted = [...quotes].sort((a, b) => (b.km_distance ?? 0) - (a.km_distance ?? 0));
  const mainQuote = sorted[0];
  const secondaryQuotes = sorted.slice(1);
  const baseKmTotal = quotes.reduce((sum, q) => sum + (q.km_distance ?? 0), 0);

  // NEW: Minimum data threshold
  const KM_DATA_THRESHOLD = 0.7; // 70% quotes must have km
  const quotesWithKm = quotes.filter(q => q.km_distance && q.km_distance > 0).length;
  const kmDataAvailable = (quotesWithKm / quotes.length) >= KM_DATA_THRESHOLD;

  if (!kmDataAvailable) {
    // NÃO usar stored_km estimativa — exigir WebRouter ou rejeitar
    return {
      base_km_total: 0,
      composed_km_total: 0,
      delta_km_abs: 0,
      delta_km_percent: 0,
      is_corridor_fit: false,
      model: 'insufficient_data',
      explanation: `${quotesWithKm}/${quotes.length} cotações com dados de km. Mínimo ${Math.ceil(quotes.length * KM_DATA_THRESHOLD)} obrigatório. Preencha km nas cotações.`,
    };
  }

  // Try WebRouter
  const originCeps = quotes
    .map((q) => q.origin_cep?.replace(/\D/g, '') ?? '')
    .filter((c) => c.length === 8);
  const sharedOriginCep =
    originCeps.length === quotes.length && new Set(originCeps).size === 1 ? originCeps[0] : null;

  if (useWebRouter && sharedOriginCep && mainQuote.destination_cep) {
    const waypointCeps = collectWaypointCeps(mainQuote, secondaryQuotes);

    if (waypointCeps.length > 0) {
      const result = await calculateRouteDistance(
        sharedOriginCep,
        mainQuote.destination_cep.replace(/\D/g, ''),
        waypointCeps
      );

      if (result.success) {
        // SUCCESS → use real route
        const composedKm = result.km_distance;
        const deltaAbs = composedKm - (mainQuote.km_distance ?? composedKm);
        const deltaPercent = (mainQuote.km_distance ?? 0) > 0
          ? (deltaAbs / (mainQuote.km_distance ?? 1)) * 100
          : 0;

        return {
          base_km_total: Math.round(baseKmTotal * 100) / 100,
          composed_km_total: Math.round(composedKm * 100) / 100,
          delta_km_abs: Math.round(deltaAbs * 100) / 100,
          delta_km_percent: Math.round(deltaPercent * 100) / 100,
          is_corridor_fit: deltaPercent <= MAX_CORRIDOR_DELTA_PERCENT,
          model: 'webrouter_v1',
          explanation: `Rota otimizada via WebRouter: ${composedKm.toFixed(0)}km, desvio ${deltaPercent.toFixed(1)}%.`,
        };
      }

      console.warn('[route-fit] WebRouter falhou, tentando stored_km');
    }
  }

  // Use stored km (agora com garantia de 70% dados)
  if (baseKmTotal > 0 && mainQuote.km_distance && mainQuote.km_distance > 0) {
    const originsMatch = sharedOriginCep !== null;
    let estimatedComposedKm: number;

    if (originsMatch) {
      const secondaryKmSum = secondaryQuotes.reduce((s, q) => s + (q.km_distance ?? 0), 0);
      estimatedComposedKm = (mainQuote.km_distance ?? 0) + secondaryKmSum * 0.3;
    } else {
      const secondaryKmSum = secondaryQuotes.reduce((s, q) => s + (q.km_distance ?? 0), 0);
      estimatedComposedKm = (mainQuote.km_distance ?? 0) + secondaryKmSum * 0.4;
    }

    const deltaAbs = estimatedComposedKm - (mainQuote.km_distance ?? 0);
    const deltaPercent = (mainQuote.km_distance ?? 0) > 0
      ? (deltaAbs / (mainQuote.km_distance ?? 1)) * 100
      : 0;
    const isFit = deltaPercent <= MAX_CORRIDOR_DELTA_PERCENT;

    return {
      base_km_total: Math.round(baseKmTotal * 100) / 100,
      composed_km_total: Math.round(estimatedComposedKm * 100) / 100,
      delta_km_abs: Math.round(deltaAbs * 100) / 100,
      delta_km_percent: Math.round(deltaPercent * 100) / 100,
      is_corridor_fit: isFit,
      model: 'stored_km_v1',
      explanation: `Estimativa via dados armazenados: ${estimatedComposedKm.toFixed(0)}km.`,
    };
  }

  // If still no data → REJECT (don't return mock)
  return {
    base_km_total: 0,
    composed_km_total: 0,
    delta_km_abs: 0,
    delta_km_percent: 0,
    is_corridor_fit: false,
    model: 'insufficient_data',
    explanation: `Dados insuficientes: ${baseKmTotal > 0 ? 'km_distance' : 'todas as cotações'} ausente. Preencha quilometragem nas cotações.`,
  };
}
```

---

### **FASE 4: UI — Validação & Guia do Usuário**

#### **4A. Indicador de Data Quality no Modal**

```typescript
// LoadCompositionModal.tsx — adicionar antes de tabs

{/* Data Quality Alert */}
{composition.route_evaluation_model === 'insufficient_data' && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
    <div className="flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div>
        <h4 className="font-medium text-red-900">Dados Insuficientes</h4>
        <p className="text-sm text-red-800 mt-1">
          Esta consolidação não pôde ser avaliada por falta de dados de distância (km).
          Preencha os campos "Distância (km)" em todas as cotações para permitir análise precisa.
        </p>
        <a
          href={`/comercial?quote-id=${composition.quote_ids[0]}`}
          className="text-sm font-medium text-red-600 hover:text-red-700 mt-2 inline-flex items-center gap-1"
        >
          ↳ Editar cotações
        </a>
      </div>
    </div>
  </div>
)}

{/* Data Quality Badge */}
{composition.route_evaluation_model === 'webrouter_v1' && (
  <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
    ✓ Rota real (WebRouter)
  </div>
)}

{composition.route_evaluation_model === 'stored_km_v1' && (
  <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
    ⚠ Rota estimada (km armazenado)
  </div>
)}
```

#### **4B. Checklist na Tela de Consolidação**

```typescript
// LoadCompositionOverlay.tsx — adicionar summary

<div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
  <h4 className="text-sm font-medium text-blue-900 mb-2">Checklist de Dados</h4>
  <div className="space-y-1 text-sm text-blue-800">
    <div className={`flex items-center gap-2 ${allHaveLoadingDate ? 'text-green-700' : 'text-red-700'}`}>
      {allHaveLoadingDate ? '✓' : '✗'} Todas as cotações têm data de carregamento
    </div>
    <div className={`flex items-center gap-2 ${allHaveKmDistance ? 'text-green-700' : 'text-amber-700'}`}>
      {allHaveKmDistance ? '✓' : '⚠'} Todas com distância (km) preenchida
    </div>
    <div className={`flex items-center gap-2 ${allHaveCeps ? 'text-green-700' : 'text-amber-700'}`}>
      {allHaveCeps ? '✓' : '⚠'} Todas com CEP de origem e destino
    </div>
  </div>
</div>
```

---

### **FASE 5: Manutenção de Dados (Pipeline)**

#### **5A. Migração: Preencher km Histórico**

```sql
-- scripts/batch-fill-missing-km.sql

-- 1. Preencher km usando Google Distance Matrix (se disponível)
UPDATE quotes
SET km_distance = (
  SELECT estimated_km FROM geocoding_cache
  WHERE origin_cep = quotes.origin_cep
    AND destination_cep = quotes.destination_cep
)
WHERE km_distance IS NULL
  AND origin_cep IS NOT NULL
  AND destination_cep IS NOT NULL;

-- 2. Preencher CEPs faltando via geocoding
UPDATE quotes
SET origin_cep = (
  SELECT cep FROM locations
  WHERE city_uf = quotes.origin
  LIMIT 1
)
WHERE origin_cep IS NULL
  AND origin IS NOT NULL;
```

#### **5B. Validação em QuoteForm**

```typescript
// src/components/forms/QuoteForm.tsx → adicionar validator

const quoteFormSchema = z.object({
  // ... existing fields ...
  km_distance: z.number().min(0, 'Distância deve ser > 0'),
  origin_cep: z.string()
    .regex(/^\d{5}-?\d{3}$/, 'CEP inválido (formato: XXXXX-XXX)'),
  destination_cep: z.string()
    .regex(/^\d{5}-?\d{3}$/, 'CEP inválido (formato: XXXXX-XXX)'),
  estimated_loading_date: z.date('Data obrigatória para consolidação'),
});

// UI Hint
{!formValues.km_distance && (
  <span className="text-xs text-amber-600">
    ℹ️ Preenchimento obrigatório para analisar consolidação
  </span>
)}
```

---

## 📊 **Checklist de Implementação**

### **✅ Prioridade 1 — CRÍTICO**
- [ ] Adicionar `checkDataQuality()` gate antes de `analyzeCombo()`
- [ ] Rejeitar resultados `mock_v1` e `insufficient_data`
- [ ] Adicionar aviso claro no Modal quando dados insuficientes

### **✅ Prioridade 2 — IMPORTANTE**
- [ ] Implementar `enrichQuoteKmData()` para preencher km via WebRouter
- [ ] Adicionar validação em QuoteForm (obrigatório km + CEPs)
- [ ] Adicionar data quality badges no modal

### **✅ Prioridade 3 — MANUTENÇÃO**
- [ ] Script SQL para preencher km histórico
- [ ] Documentar onde e quando dados faltam (logs)
- [ ] Dashboard de qualidade de dados

---

## 🎯 **Benefícios**

| Benefício | Antes | Depois |
|-----------|-------|--------|
| **Consolidações rejeitadas** | Aceita mock com score 0 | Rejeita e avisa usuário |
| **Precisão de cálculos** | 30-50% estimado | 90%+ real (WebRouter/Stored KM) |
| **Tempo de response** | Rápido mas inútil | Mais lento mas útil |
| **UX** | Confuso (aparece consolidação inviável) | Claro (dados insuficientes = rejeitado) |

---

## 🚀 **Próximas Ações**

1. **Implementar Phase 1** (data quality gate) — 1-2 horas
2. **Implementar Phase 2** (enrich km data) — 2-3 horas
3. **Implementar Phase 4** (UI hints) — 1 hora
4. **Testar com dados reais** — 1-2 horas
5. **Run batch migration** (Phase 5) — 30 minutos

**Total**: ~6-9 horas de desenvolvimento

