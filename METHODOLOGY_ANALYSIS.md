# 📊 Análise da Metodologia de Cálculos — Feature de Consolidação

**Data**: 20/03/2026
**Foco**: Validar fórmulas e lógica de cálculo do sistema de consolidação de cargas

---

## 📐 **Componentes do Score de Consolidação**

### **Fórmula Principal (linhas 410-415 em analyze-load-composition)**
```typescript
score = (
  routeFit * 0.35 +           // 35% — fator dominante
  dateProximity * 0.25 +      // 25%
  kmSavingsPercent * 0.25 +   // 25%
  weightUtilization * 0.15    // 15%
)
```

**Interpretação**: Score ponderado 0-100, com **route fit como dominante** (35%).

---

## 🗺️ **1. Route Fit Score (35%)**

### **Fórmula**
```typescript
if (is_corridor_fit) {
  routeFitScore = 100 - (delta_km_percent * 3)
} else {
  routeFitScore = 50 - delta_km_percent
}
```

### **Análise**
- ✅ **Lógica correta**: Penaliza desvios de rota (delta_km_percent)
- ✅ **Threshold sensato**: MAX_CORRIDOR_DELTA_PERCENT = 20%
- ⚠️ **Potencial problema**:
  - Se delta_km_percent = 20% E is_corridor_fit = true → score = 100 - (20 * 3) = 40
  - Se delta_km_percent = 20% E is_corridor_fit = false → score = 50 - 20 = 30
  - **Diferença pequena (10 pts)** apesar de classificações diferentes

### **Recomendação**
Revisar lógica de `is_corridor_fit`:
```typescript
// Atual (linhas 514-516)
const routeFitScore = routeEval.is_corridor_fit
  ? Math.max(0, 100 - routeEval.delta_km_percent * 3)
  : Math.max(0, 50 - routeEval.delta_km_percent);

// Sugerido: penalidade maior para "not fit"
const routeFitScore = routeEval.is_corridor_fit
  ? Math.max(0, 100 - routeEval.delta_km_percent * 2)  // 2x em vez de 3x
  : Math.max(0, 30 - routeEval.delta_km_percent);      // começa em 30 em vez de 50
```

---

## 📅 **2. Date Proximity Score (25%)**

### **Fórmula (linhas 465-467)**
```typescript
const dateProximity = dateFeasible
  ? Math.max(0, Math.min(100, 100 - daySpread * 15))
  : 0;
```

### **Análise**
| daySpread | Score | Interpretação |
|-----------|-------|---------------|
| 0 dias | 100 | Datas idênticas ✅ |
| 1 dia | 85 | Bom |
| 2 dias | 70 | Aceitável |
| 3 dias | 55 | Limite (MAX_DATE_SPREAD_DAYS=3) |
| 4+ dias | 0 (hard rule) | Rejeitado |

- ✅ **Lógica clara**: Penalidade linear 15 pontos por dia
- ✅ **Hard rule**: > 3 dias = rejeita consolidação (dateFeasible = false)
- ⚠️ **Potencial frágil**:
  - Multiplicador 15 é **hardcoded** — sem configuração
  - Penalidade pode ser muito agressiva para rotas com flexibilidade operacional

### **Recomendação**
```typescript
// Tornar configurável
const DATE_PENALTY_PER_DAY = 15; // mover para constantes
const dateProximity = dateFeasible
  ? Math.max(0, Math.min(100, 100 - daySpread * DATE_PENALTY_PER_DAY))
  : 0;
```

---

## 📏 **3. KM Savings Score (25%)**

### **Fórmula (linhas 473-477)**
```typescript
const kmSavings = routeEval.base_km_total > 0
  ? ((routeEval.base_km_total - routeEval.composed_km_total) / routeEval.base_km_total) * 100
  : 0;
const kmSavingsPercent = Math.max(0, Math.min(100, kmSavings));
```

### **Análise**
```
base_km = 1000km, composed_km = 900km
→ savings = (1000 - 900) / 1000 = 10% ✅

base_km = 1000km, composed_km = 1150km (desvio)
→ savings = (1000 - 1150) / 1000 = -15% → capped at 0 ✅
```

- ✅ **Matematicamente correta**
- ✅ **Capped entre 0-100** para evitar scores negativos
- ⚠️ **Problema**: Pode ser 0 mesmo com consolidação viável
  - Se rota consolidada > rota base → savings = 0
  - Aí dependeria de route fit e date proximity
  - **Score final poderia ser baixo** apesar de consolidação viável

### **Recomendação**
Adicionar lógica para reconhecer "desvios aceitáveis":
```typescript
// Se delta_km_percent ≤ 20% E route_fit = true
// → contar como "savings" mesmo se km aumenta
const effectiveKmSavings = routeEval.is_corridor_fit
  && routeEval.delta_km_percent <= 10
  ? Math.max(kmSavings, 15) // garantir mínimo 15% credit
  : kmSavings;
```

---

## ⚖️ **4. Weight Utilization Score (15%)**

### **Fórmula (linha 518)**
```typescript
const weightUtil = Math.min(100, (totalWeight / MAX_TRUCK_CAPACITY_KG) * 100);
// MAX_TRUCK_CAPACITY_KG = 30000 kg
```

### **Análise**
```
totalWeight = 15000 kg → 50% utilização → score 50
totalWeight = 30000 kg → 100% utilização → score 100
totalWeight = 40000 kg → 133% → capped at 100, MAS warning adicionado
```

- ✅ **Lógica correta**: incentiva melhor aproveitamento
- ⚠️ **Peso baixo (15%)**: talvez deveria ser maior para incentivar melhor utilização
- ⚠️ **Hard rule não crisp**: Excesso de peso = warning mas score pode ser alto

### **Recomendação**
```typescript
// Considerar aumentar peso se objetivo é otimizar capacidade
// Atualmente: 15% — considerar 20-25%

// E adicionar penalidade para excesso
const weightUtil = totalWeight > MAX_TRUCK_CAPACITY_KG
  ? Math.min(50, (totalWeight / MAX_TRUCK_CAPACITY_KG) * 100) // cap at 50
  : Math.min(100, (totalWeight / MAX_TRUCK_CAPACITY_KG) * 100);
```

---

## 💰 **Cálculo de Economia (Estimated Savings)**

### **Metodologia Principal: ANTT-based (linhas 479-511)**

```typescript
// 1. Infer vehicle from consolidated weight
const vehicle = await inferAxesFromWeight(supabase, totalWeight);
// Returns: { axes_count, vehicle_code, capacity_kg }

// 2. Get ANTT floor rates for that vehicle
const rate = await getAnttFloorRate(supabase, vehicle.axes_count);
// Returns: { ccd: R$/km, cc: R$ fixed }

// 3. Calculate SEPARATED cost (N trips, N × CC)
const separateTrips = quotes.map(q => ({ km: Number(q.km_distance) || 0 }));
const separated = calculateSeparateCost(separateTrips, rate);
// Formula: sum(km_i × CCD + CC) para cada cotação

// 4. Calculate CONSOLIDATED cost (1 trip, 1 × CC)
const consolidated = calculateConsolidatedCost(routeEval.composed_km_total, rate);
// Formula: composed_km × CCD + CC

// 5. Savings
const estimatedSavings = Math.max(0, separated.total_centavos - consolidated);
```

### **Análise Detalhada**

#### **Exemplo Real**
```
Consolidação de 2 cargas:
- Cota 1: 500 km, VUC (2 eixos)
- Cota 2: 600 km, VUC (2 eixos)
- Peso consolidado: 4500 kg → veículo: TOCO (2 eixos, 6000 kg) ✅

ANTT Table A, Carga Geral, TOCO 2 eixos:
- CCD = R$ 2,00/km
- CC = R$ 100

CUSTO SEPARADO (2 viagens):
- Viagem 1: 500 × 2,00 + 100 = R$ 1.100
- Viagem 2: 600 × 2,00 + 100 = R$ 1.300
- TOTAL = R$ 2.400

CUSTO CONSOLIDADO (1 viagem):
- Rota otimizada: 900 km (em vez de 500 + 600 = 1100)
- Custo: 900 × 2,00 + 100 = R$ 1.900

ECONOMIA: R$ 2.400 - R$ 1.900 = R$ 500 ✅
```

### **Avaliação**
- ✅ **Metodologia CORRETA**: Usa tarifa real ANTT
- ✅ **Realista**: Considera CC duplo em separado, único em consolidado
- ✅ **Conservador**: Reduz custo apenas pela economia real de km + CC
- ⚠️ **Não inclui**:
  - Custos operacionais (motorista, combustível extra de ida)
  - Custos de espera por consolidação
  - Seguros / riscos de atraso
  - **Apenas "floor ANTT"** — não margem comercial

---

## 🔄 **Avaliação de Rota**

### **3 Modelos (em ordem de preferência)**

#### **1. WebRouter (webrouter_v1) — REAL**
```typescript
if (useWebRouter && sharedOriginCep && mainQuote.destination_cep) {
  const result = await calculateRouteDistance(
    sharedOriginCep,
    mainQuote.destination_cep,
    waypointCeps  // intermediate stops
  );
  // Returns: { km_distance, polyline_coords, ... }
}
```
- ✅ **Melhor**: usa rota real da API WebRouter
- ⚠️ **Dependência**: requer CEPs válidos

#### **2. Stored KM (stored_km_v1) — ESTIMATIVA**
```typescript
if (originsMatch) {
  // Shared origin: composed ≈ main route + 30% of secondary routes
  estimatedComposedKm = mainKm + (secondaryKm * 0.3);
} else {
  // Different origins: 40% (mais conservador)
  estimatedComposedKm = mainKm + (secondaryKm * 0.4);
}
```

**Análise**:
```
Exemplo 1 (Shared Origin):
- Main: 500 km (Rio → São Paulo)
- Secondary 1: 200 km (Campinas → São Paulo)
- Secondary 2: 150 km (Sorocaba → São Paulo)
- Estimated: 500 + (200 + 150) × 0.3 = 500 + 105 = 605 km

vs

Realidade: Rio → Sorocaba → Campinas → São Paulo ≈ 550-600 km
→ Heurística com 30% é **razoável** ✅
```

- ✅ **Conservador**: usar 30-40% é prudente
- ⚠️ **Pode ser impreciso**: se intermediárias estão muito fora da rota
- ⚠️ **Não usa geometria**: apenas somas de km

#### **3. Mock (mock_v1) — SEM DADOS**
```typescript
// Sem km data → cannot evaluate
model: 'mock_v1'
is_corridor_fit: false
```

### **Recomendação**
Adicionar **validação cruzada**:
```typescript
// Se available: compare WebRouter vs Stored estimativa
if (routeEval.model === 'webrouter_v1' &&
    estimatedFromStored > 0) {
  const diff = Math.abs(routeEval.composed_km_total - estimatedFromStored) / estimatedFromStored;
  if (diff > 0.20) { // 20% de diferença
    warnings.push(`Divergência entre WebRouter (${routeEval.composed_km_total}km) e estimativa (${estimatedFromStored}km). Verificar CEPs.`);
  }
}
```

---

## ⚠️ **Problemas Identificados na Metodologia**

### **P1: Score pode ser enganoso com economia NEGATIVA**
```
Cenário:
- Date proximity: 95
- Route fit: 60 (desvio 20%, mas viável)
- KM savings: 0 (rota aumenta)
- Weight util: 70

Score final: (60*0.35 + 95*0.25 + 0*0.25 + 70*0.15) = 21 + 23.75 + 0 + 10.5 = 55.25

Resultado: Score 55 é "viável" (> 60 min) — mas economicamente NEGATIVO
```

**Fix**:
```typescript
// Não renderizar como viável se economia < R$ 500 e delta_km > 10%
const isEconomicallyViable = estimatedSavings >= MIN_SAVINGS_CENTAVOS;
const isFeasible =
  totalWeight <= MAX_TRUCK_CAPACITY_KG &&
  routeEval.is_corridor_fit &&
  dateFeasible &&
  isEconomicallyViable; // ADD THIS
```

### **P2: KM savings = 0 penaliza consolidações com desvio tolerável**
```
Se delta_km = 15% (dentro de 20% tolerance):
- Route fit score: OK (≈ 55)
- KM savings score: 0 (porque usou mais km)
- Score total pode cair abaixo de 60

MAS é consolidação viável economicamente!
```

**Fix**: Ver sugestão anterior — reconhecer "desvios aceitáveis" como savings.

### **P3: Fallback heurístico (sem ANTT) é muito impreciso**
```typescript
// Linha 505-510
const ESTIMATED_COST_RATIO = 0.60; // 60% do valor NF
const estimatedTotalCostCentavos = Math.round(totalValueCentavos * ESTIMATED_COST_RATIO);
const savingsRatio = kmSavingsPercent / 100;
estimatedSavings = Math.round(estimatedTotalCostCentavos * savingsRatio);
```

**Exemplo**:
```
NF total: R$ 10.000
Assumido: custo = 60% × 10.000 = R$ 6.000
KM savings: 10%
Economia = R$ 6.000 × 10% = R$ 600

MAS realidade pode ser muito diferente (margins variam 20-100%)
```

**Fix**:
```typescript
// Apenas usar fallback se ANTT indisponível, com aviso claro
if (rate) {
  // Use ANTT
} else {
  warnings.push('⚠️ CRÍTICO: Tabela ANTT não disponível. Economia é ESTIMADA e pode não ser precisa. Validar com financeiro.');
  // fallback
}
```

### **P4: Não há validação de "minimum order volume"**
```
Consolidação de 2 pequenas cotes:
- Valor NF total: R$ 2.000
- KM savings: 15%
- Economia ANTT: R$ 450

MAS custo operacional de espera + overhead = talvez R$ 500
→ Net zero ou negativo
```

**Fix**:
```typescript
const MIN_CONSOLIDATED_ORDER_VALUE = 500000; // R$ 5.000
if (totalValueCentavos < MIN_CONSOLIDATED_ORDER_VALUE) {
  warnings.push(`Valor consolidado (R$ ${(totalValueCentavos/100).toFixed(2)}) abaixo do mínimo recomendado (R$ ${MIN_CONSOLIDATED_ORDER_VALUE/100}). Considerar viabilidade operacional.`);
}
```

---

## ✅ **Recomendações de Melhoria**

### **1. CRÍTICO: Validação de Economia Mínima**
```typescript
// analyze-load-composition/index.ts — adicionar em analyzeCombo()
const isFeasible =
  totalWeight <= MAX_TRUCK_CAPACITY_KG &&
  routeEval.is_corridor_fit &&
  dateFeasible &&
  estimatedSavings >= MIN_SAVINGS_CENTAVOS; // ← ADD
```

### **2. Melhorar lógica de Route Fit Score**
Aumentar diferença entre "fit" e "not fit":
```typescript
const routeFitScore = routeEval.is_corridor_fit
  ? Math.max(0, 100 - routeEval.delta_km_percent * 2)
  : Math.max(0, 30 - routeEval.delta_km_percent);
```

### **3. Reconhecer desvios aceitáveis como "economicamente viáveis"**
```typescript
const kmSavingsAdjusted = routeEval.is_corridor_fit && routeEval.delta_km_percent <= 10
  ? Math.max(kmSavings, 10) // mínimo 10% credit
  : kmSavings;
```

### **4. Tornar constantes configuráveis**
```typescript
const CONFIG = {
  DATE_PENALTY_PER_DAY: 15,
  MAX_CORRIDOR_DELTA_PERCENT: 20,
  MIN_SAVINGS_CENTAVOS: 50000, // R$ 500
  MIN_ORDER_VALUE_CENTAVOS: 500000, // R$ 5000
  WEIGHT_UTIL_MULTIPLIER: 1.0, // 100% = capacity
};
```

### **5. Adicionar alertas quando usar fallback ANTT**
```typescript
if (!rate) {
  warnings.push(
    '🔴 ATENÇÃO: Tabela ANTT não encontrada. ' +
    'Economia estimada por heurística (até 60% margem). ' +
    'Validar com financeiro antes de consolidar.'
  );
}
```

### **6. Dashboard de rastreamento**
Adicionar métricas para validar modelo:
- % de consolidações com savings > R$ 500
- % com delta_km dentro de 20%
- Erro médio: WebRouter vs Stored estimativa
- Savings realizado vs estimado

---

## 📝 **Conclusão**

| Aspecto | Status | Severity |
|---------|--------|----------|
| Lógica de score | ✅ Válida | — |
| Cálculo ANTT | ✅ Correto | — |
| Route fit | ⚠️ Pode ser > agressivo | Média |
| KM savings = 0 | 🔴 Penaliza indebidamente | **Alta** |
| Min economy check | ❌ Ausente | **Crítica** |
| Fallback heurístico | ⚠️ Impreciso | Média |

**Recomendação Final**:
Implementar **P1 (validação de economia)** e **P2 (reconhecer desvios viáveis)** antes de colocar feature em produção de alta volume.

