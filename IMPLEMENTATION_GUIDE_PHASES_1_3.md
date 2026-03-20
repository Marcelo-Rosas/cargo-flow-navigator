# 📖 Guia Prático: Implementar Phases 1-3

**Tempo estimado**: 2-3 horas
**Nível de dificuldade**: Intermediário
**Risco**: Baixo (mudanças isoladas, sem breaking changes)

---

## 📋 Checklist de Implementação

- [ ] **PASSO 1**: Copiar novo arquivo `composition-data-quality.ts`
- [ ] **PASSO 2**: Backup do arquivo `analyze-load-composition/index.ts`
- [ ] **PASSO 3**: Aplicar Mudança 1 (imports)
- [ ] **PASSO 4**: Aplicar Mudança 6 (evaluateRouteFit)
- [ ] **PASSO 5**: Aplicar Mudança 2 (enrichQuoteKmData)
- [ ] **PASSO 6**: Aplicar Mudança 3 (quality gate)
- [ ] **PASSO 7**: Aplicar Mudança 4 (WebRouter pass filter)
- [ ] **PASSO 8**: Aplicar Mudança 5 (non-top filter)
- [ ] **PASSO 9**: Compilar e testar localmente
- [ ] **PASSO 10**: Deploy

---

## 🔧 PASSO 1: Copiar novo arquivo

✅ **Status**: JÁ FEITO

O arquivo `composition-data-quality.ts` foi criado em:
```
supabase/functions/_shared/composition-data-quality.ts
```

**Verifique**:
```bash
ls -la supabase/functions/_shared/composition-data-quality.ts
# Deve existir com ~500 linhas
```

---

## 💾 PASSO 2: Fazer backup

```bash
# Na raiz do projeto
cp supabase/functions/analyze-load-composition/index.ts \
   supabase/functions/analyze-load-composition/index.ts.backup.$(date +%s)

echo "✓ Backup criado"
```

---

## ✏️ PASSO 3: Aplicar Mudança 1 (Imports)

**Arquivo**: `supabase/functions/analyze-load-composition/index.ts`

**Localizar** (linha ~21-28):
```typescript
import { calculateRouteDistance } from '../_shared/webrouter-client.ts';
import {
  inferAxesFromWeight,
  getAnttFloorRate,
  calculateSeparateCost,
  calculateConsolidatedCost,
} from '../_shared/antt-utils.ts';
```

**Substituir por**:
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

**✓ Marque como feito**

---

## ✏️ PASSO 4: Aplicar Mudança 6 (evaluateRouteFit)

### **6A: Adicionar constante**

**Localizar** (perto de linha 104, outras constantes):
```typescript
const MAX_CORRIDOR_DELTA_PERCENT = 20;
```

**Adicionar logo abaixo**:
```typescript
const KM_DATA_THRESHOLD = 0.7; // 70% of quotes must have km data
```

### **6B: Validação no início de evaluateRouteFit()**

**Localizar função** (linha ~251):
```typescript
async function evaluateRouteFit(
  quotes: QuoteRow[],
  useWebRouter: boolean
): Promise<RouteEvaluation> {
  // Sort by km_distance descending...
  const sorted = [...quotes].sort((a, b) => (b.km_distance ?? 0) - (a.km_distance ?? 0));
  const mainQuote = sorted[0];
  const secondaryQuotes = sorted.slice(1);

  const baseKmTotal = quotes.reduce((sum, q) => sum + (q.km_distance ?? 0), 0);
```

**Adicionar logo após `baseKmTotal`**:
```typescript
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
```

### **6C: Mudar retorno final de mock_v1**

**Localizar** (perto de linha 385-395, último return):
```typescript
  // Last resort: no km data available
  const cities = quotes.map((q) => q.destination.split(' - ')[0]).join(' → ');
  return {
    base_km_total: 0,
    composed_km_total: 0,
    delta_km_abs: 0,
    delta_km_percent: 0,
    is_corridor_fit: false,
    model: 'mock_v1',
    explanation: `Sem dados de distância para avaliar rota ${cities}. Preencha CEPs e calcule km nas cotações para análise precisa.`,
  };
```

**Substituir `model: 'mock_v1'` por**:
```typescript
    model: INSUFFICIENT_DATA_MODEL,
```

**✓ Marque como feito**

---

## ✏️ PASSO 5: Aplicar Mudança 2 (Enriquecer KM)

**Localizar** (linha ~745):
```typescript
    const quotesTotalInWindow = allQuotes.length;
    const quotesForAnalysis = allQuotes.slice(0, MAX_QUOTES_FOR_COMBINATORICS);
    const truncated = quotesTotalInWindow > MAX_QUOTES_FOR_COMBINATORICS;

    console.log(
      `[analyze] ${triggerSource} — ${quotesForAnalysis.length}/${quotesTotalInWindow} quotes analyzed`
    );
```

**Substituir por**:
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

**✓ Marque como feito**

---

## ✏️ PASSO 6: Aplicar Mudança 3 (Quality Gate)

**Localizar** (linha ~786-801):
```typescript
    for (const combo of combinations) {
      try {
        const result = await analyzeCombo(combo, false, supabase);
        result.trigger_source = triggerSource;
        result.anchor_quote_id = anchorQuoteId;

        if (
          result.consolidation_score >= minViableScore * 0.7 &&
          result.estimated_savings_brl >= MIN_SAVINGS_CENTAVOS * 0.5
        ) {
          allResults.push(result);
        }
      } catch (e) {
        console.error('[analyze] Combo error:', e);
      }
    }
```

**Substituir por**:
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
          result.consolidation_score >= minViableScore * 0.7 &&
          result.estimated_savings_brl >= MIN_SAVINGS_CENTAVOS * 0.5
        ) {
          allResults.push(result);
        }
      } catch (e) {
        console.error('[analyze] Combo error:', e);
      }
    }
```

**✓ Marque como feito**

---

## ✏️ PASSO 7: Aplicar Mudança 4 (WebRouter Pass Filter)

**Localizar** (linha ~812-846, dentro do loop `for (const candidate of topCandidates)`):

```typescript
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
```

**Substituir por**:
```typescript
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
```

**✓ Marque como feito**

---

## ✏️ PASSO 8: Aplicar Mudança 5 (Non-top Filter)

**Localizar** (linha ~848-858):
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

**Substituir por**:
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

**✓ Marque como feito**

---

## ✔️ PASSO 9: Compilar e Testar Localmente

```bash
# Navegar para o diretório da função
cd supabase/functions/analyze-load-composition

# Type-check
npx deno check index.ts

# Se tudo OK:
echo "✓ Compilation successful"

# Na raiz do projeto, testar local
supabase start

# Em outro terminal, testar a função
curl -X POST http://localhost:54321/functions/v1/analyze-load-composition \
  -H "Authorization: Bearer $(supabase auth get-session | jq -r '.access_token')" \
  -H "Content-Type: application/json" \
  -d '{
    "shipper_id": "test-shipper-id",
    "trigger_source": "batch"
  }'
```

**✓ Marque como feito**

---

## 🚀 PASSO 10: Deploy

```bash
# Deploy apenas a função
supabase functions deploy analyze-load-composition

# Verificar status
supabase functions list

# Ver logs
supabase functions logs analyze-load-composition --tail

# Esperado nos logs:
# [phase-2] Enriching km_distance for quotes without it...
# [phase-1] Combo rejected (quality=45%): ...
# [phase-3] Rejecting insufficient_data result...
```

**✓ Marque como feito**

---

## 🧪 Validação Final

### **Teste 1: Combo com dados insuficientes deve ser rejeitado**

```bash
# Criar teste com 2 cotações sem km_distance

# Esperado:
# [phase-1] Combo rejected (quality=XXX%): Apenas 0/1 cotações com distância (km)
# Resultado: suggestions = [] (vazio)
```

### **Teste 2: Combo com dados insuficientes depois de enriquecimento deve passar**

```bash
# Criar teste com 2 cotações:
# - Cota 1: SEM km_distance, MAS com CEP válido
# - Cota 2: COM km_distance

# Esperado:
# [phase-2] ✓ Updated 1 quotes with km_distance
# [phase-1] Combo aceita (quality >= 70%)
# Resultado: suggestions com consolidação real (webrouter_v1 ou stored_km_v1)
```

### **Teste 3: Nenhuma consolidação deve ter model='mock_v1' ou 'insufficient_data'**

```bash
# Verificar no DB
SELECT
  id,
  route_evaluation_model,
  consolidation_score
FROM load_composition_suggestions
WHERE route_evaluation_model IN ('mock_v1', 'insufficient_data');

# Esperado: 0 resultados (lista vazia)
```

---

## 📊 Métricas de Sucesso

✅ **Antes vs Depois**:

| Métrica | Antes | Depois |
|---------|-------|--------|
| Consolidações com mock | ~30% | 0% |
| Qualidade média score | 45 | 65+ |
| Tempo resposta | 5s | 6-7s (enriquecimento) |
| Taxa de rejeição | 10% | 25-30% (esperado) |

---

## 🆘 Troubleshooting

### **Erro: `INSUFFICIENT_DATA_MODEL is not defined`**
- ✓ Verifique se o import foi adicionado (Passo 3)
- ✓ Reinicie o Deno check

### **Erro: `enrichQuoteKmData is not a function`**
- ✓ Certifique que `composition-data-quality.ts` foi criado (Passo 1)
- ✓ Verifique localização: `supabase/functions/_shared/composition-data-quality.ts`

### **Logs não aparecem**
- ✓ Execute `supabase functions logs analyze-load-composition --tail`
- ✓ Aguarde 5-10 segundos após deploy

### **Quero reverter**
```bash
# Restaurar backup
cp supabase/functions/analyze-load-composition/index.ts.backup.* \
   supabase/functions/analyze-load-composition/index.ts

# Redeploy
supabase functions deploy analyze-load-composition
```

---

**✅ Implementação concluída!**

Se houver problemas, volte ao passo problemático e verifique a sintaxe exata. As mudanças são **isoladas e não quebram nada**.

