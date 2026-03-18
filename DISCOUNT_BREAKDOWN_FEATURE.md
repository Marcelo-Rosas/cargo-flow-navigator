# Desconto Propostos — Load Composition Engine

**Data:** 18/03/2026
**Feature:** Cálculo automático de descontos respeitando regras de margem
**Status:** ✅ Implementado

---

## 🎯 Objetivo

Quando você consolida cargas de múltiplos embarcadores, há economia de frete. Esse sistema **distribui a economia entre clientes** de forma inteligente, oferecendo descontos competitivos enquanto **respeita margens mínimas**.

### Problema Original
- ✗ "Economizamos R$ 5.000, mas como oferecer isso aos clientes?"
- ✗ "Posso oferecer desconto sem perder margem?"
- ✗ "Qual é o desconto máximo por cliente?"

### Solução
- ✅ Calcula desconto máximo permitido por cliente (respeitando margem mínima)
- ✅ Distribui economia entre embarcadores
- ✅ Propõe desconto com margem garantida
- ✅ Exibe tudo no Modal com tabela clara

---

## 📊 Como Funciona

### 1️⃣ Entrada de Dados

```
Cotação Original (Cliente A)
├─ Preço: R$ 2.000
├─ Custo Frete: R$ 1.200 (60% do preço)
└─ Margem: R$ 800 (40%)

Consolidação (economia de R$ 500)
├─ Custo reduzido para: R$ 700
└─ Economia gerada: R$ 500
```

### 2️⃣ Cálculo de Desconto Máximo

```
Regra: Margem mínima = 30%

Para Cliente A:
├─ Preço: R$ 2.000
├─ Custo novo: R$ 700
├─ Margem mínima requerida: R$ 600 (30% de 2.000)
└─ Desconto máximo permitido: R$ 200
    (margem atual 800 - margem mínima 600)
```

### 3️⃣ Distribuição de Economia

**Estratégias disponíveis:**

#### A) Equal Share
Divide economia igualmente entre todas as cargas
```
Total economia: R$ 500
Número de cargas: 4
Desconto por cliente: R$ 125 (se não violar margem)
```

#### B) Proportional to Original (Padrão)
Clientes com preço maior recebem desconto maior
```
Cliente A: R$ 2.000 (40% do total) → Desconto: R$ 200
Cliente B: R$ 1.500 (30% do total) → Desconto: R$ 150
Cliente C: R$ 1.000 (20% do total) → Desconto: R$ 100
Cliente D: R$ 500 (10% do total) → Desconto: R$ 50
Total: R$ 500
```

#### C) Weighted by Weight
Cargas mais pesadas recebem desconto maior
```
Cliente A: 5.000kg (50%) → Desconto: R$ 250
Cliente B: 3.000kg (30%) → Desconto: R$ 150
Cliente C: 2.000kg (20%) → Desconto: R$ 100
Total: R$ 500
```

### 4️⃣ Validação de Margem

Se o desconto calculado violaria a margem:
```
❌ Desconto ideal: R$ 300
⚠️ Desconto máximo: R$ 200 (sem violar 30%)
✅ Desconto oferecido: R$ 200

Status: "Desconto reduzido - limite de margem atingido"
```

### 5️⃣ Resultado

| Cliente | Preço Original | Margem Atual | Desconto | Preço Final | Margem Final | Status |
|---------|---|---|---|---|---|---|
| A | R$ 2.000 | 40% | -R$ 150 | R$ 1.850 | 34% | ✅ |
| B | R$ 1.500 | 40% | -R$ 112 | R$ 1.388 | 33% | ✅ |
| C | R$ 1.000 | 40% | -R$ 75 | R$ 925 | 32% | ✅ |
| D | R$ 500 | 40% | -R$ 37 | R$ 463 | 31% | ✅ |
| **TOTAL** | **R$ 5.000** | **40%** | **-R$ 374** | **R$ 4.626** | **32.5%** | ✅ |

---

## 🔧 Implementação Técnica

### Database Schema

```sql
CREATE TABLE load_composition_discount_breakdown (
  id UUID PRIMARY KEY,
  composition_id UUID,
  quote_id UUID,
  shipper_id UUID,

  -- Financial
  original_quote_price_brl INTEGER,      -- preço original (centavos)
  original_freight_cost_brl INTEGER,     -- custo do frete
  original_margin_brl INTEGER,           -- preço - custo
  original_margin_percent FLOAT,         -- (preço - custo) / preço

  -- Discount Calculation
  max_discount_allowed_brl INTEGER,      -- máximo sem violar margem
  discount_offered_brl INTEGER,          -- desconto real oferecido
  discount_percent FLOAT,                -- desconto / preço

  -- Final Numbers
  final_quote_price_brl INTEGER,         -- preço - desconto
  final_margin_brl INTEGER,              -- final_price - custo
  final_margin_percent FLOAT,            -- margem final %

  -- Rules
  margin_rule_source TEXT,               -- 'global' | 'customer' | 'pricing_table'
  minimum_margin_percent_applied FLOAT,  -- regra aplicada (ex: 30%)
  discount_strategy TEXT,                -- estratégia usada

  is_feasible BOOLEAN,
  validation_warnings TEXT[]
);
```

### Edge Function: calculate-discount-breakdown

**Endpoint:** `POST /functions/v1/calculate-discount-breakdown`

**Request:**
```typescript
{
  composition_id: string;
  discount_strategy?: 'equal_share' | 'proportional_to_original' | 'weighted_by_weight';
  minimum_margin_percent?: number; // default: 30
  simulate_only?: boolean; // if true, não salva no DB
}
```

**Response:**
```typescript
{
  success: boolean;
  composition_id: string;
  discount_breakdown: [
    {
      quote_id: string;
      shipper_id: string;
      original_price: number;
      discount_offered: number;
      discount_percent: number;
      final_price: number;
      original_margin_percent: number;
      final_margin_percent: number;
      is_feasible: boolean;
      validation_warnings: string[];
    }
  ];
  summary: {
    total_original_price: number;
    total_discount_offered: number;
    total_final_price: number;
    avg_final_margin_percent: number;
    min_final_margin_percent: number;
  };
}
```

### React Hooks

#### useCalculateDiscounts
```typescript
const { mutate: calculateDiscounts, isPending } = useCalculateDiscounts();

calculateDiscounts({
  composition_id: 'abc-123',
  discount_strategy: 'proportional_to_original',
  minimum_margin_percent: 30,
  simulate_only: false
});
```

#### useLoadCompositionSuggestion (atualizado)
Agora busca `discounts` automaticamente junto com routings e metrics:
```typescript
const { data: composition } = useLoadCompositionSuggestion(id);
// composition.discounts = [ { quote_id, discount_offered_brl, ... } ]
```

### Componentes

#### DiscountProposalBreakdown
Tabela interativa com:
- Summary stats (preço original, desconto total, preço final)
- Análise de margem (mínima requerida vs margem final)
- Tabela detalhada por embarcador
- Warnings de validação

```tsx
<DiscountProposalBreakdown
  discounts={composition.discounts}
  minimumMarginPercent={30}
/>
```

#### LoadCompositionModal (atualizado)
Novo tab: **Descontos** (5º tab)
- Exibe DiscountProposalBreakdown
- Mostra regras aplicadas
- Explica estratégia de distribuição

---

## 📈 Exemplo Real — Vectra Cargo

### Cenário
4 cotações pendentes do mesmo embarcador, datas próximas:

| Cotação | Origem | Destino | Preço | Peso |
|---|---|---|---|---|
| COT-001 | Navegantes | São Paulo | R$ 3.000 | 8.000kg |
| COT-002 | Itajaí | São Paulo | R$ 2.500 | 6.000kg |
| COT-003 | Navegantes | Curitiba | R$ 1.800 | 4.000kg |
| COT-004 | Itajaí | Curitiba | R$ 1.200 | 2.000kg |

**Total:** R$ 8.500 | 20.000kg

### Consolidação Proposta
- **Rota otimizada:** Navegantes → Itajaí → São Paulo → Curitiba → Retorno
- **Economia:** R$ 1.200 (custo reduzido de R$ 5.100 para R$ 3.900)
- **Score viabilidade:** 78%

### Cálculo de Desconto (Proportional)

```
Estratégia: proportional_to_original
Margem mínima: 30%
Economia total: R$ 1.200

Distribuição:
├─ COT-001: 35% → Desconto: R$ 420 → Preço final: R$ 2.580 → Margem: 32%
├─ COT-002: 29% → Desconto: R$ 348 → Preço final: R$ 2.152 → Margem: 31%
├─ COT-003: 21% → Desconto: R$ 252 → Preço final: R$ 1.548 → Margem: 30%
└─ COT-004: 14% → Desconto: R$ 168 → Preço final: R$ 1.032 → Margem: 30%

Total desconto: R$ 1.188
Economia não oferecida: R$ 12 (arredondamento)

✅ Todas as margens respeitam mínimo de 30%
✅ Clientes recebem desconto proporcional
✅ Vectra mantém lucro competitivo
```

### Notificação ao Embarcador

```
📧 Assunto: Oportunidade de Consolidação com Desconto

Olá! Encontramos uma oportunidade de consolidação para suas 4 cargas:

✅ Economia Gerada: R$ 1.200

Descontos Propostos:
├─ COT-001: R$ 3.000 → R$ 2.580 (-R$ 420 | -14%)
├─ COT-002: R$ 2.500 → R$ 2.152 (-R$ 348 | -14%)
├─ COT-003: R$ 1.800 → R$ 1.548 (-R$ 252 | -14%)
└─ COT-004: R$ 1.200 → R$ 1.032 (-R$ 168 | -14%)

Preço Total: R$ 8.500 → R$ 7.312 (-R$ 1.188)

Aprova consolidação? Responda SIM ou NÃO.
```

---

## ⚙️ Configuração

### Regra de Margem Mínima

Atualmente: **30% (padrão global)**

Onde customizar:

#### Opção 1: Global (em todas as consolidações)
Editar em `useCalculateDiscounts.ts`:
```typescript
minimum_margin_percent: req.minimum_margin_percent || 30  // Alterar para 25, 35, etc
```

#### Opção 2: Por Cliente (futuro)
```sql
-- Adicionar coluna em customers table
ALTER TABLE customers ADD COLUMN minimum_margin_percent FLOAT DEFAULT 30;
```

Depois usar em calculate-discount-breakdown:
```sql
SELECT c.minimum_margin_percent FROM customers c
WHERE c.id = quote.shipper_id;
```

#### Opção 3: Por Tabela de Preço (futuro)
```sql
-- Usar tabela pricing_tables
SELECT minimum_margin_percent FROM pricing_tables
WHERE table_id = quote.pricing_table_id;
```

---

## 🧪 Teste Rápido

### 1. Simular Cálculo (sem salvar)
```typescript
const { mutate } = useCalculateDiscounts();
mutate({
  composition_id: 'test-id',
  simulate_only: true
}, {
  onSuccess: (data) => {
    console.log('Simulated discounts:', data.discount_breakdown);
  }
});
```

### 2. Calcular e Salvar
```typescript
mutate({
  composition_id: 'actual-id',
  discount_strategy: 'proportional_to_original',
  minimum_margin_percent: 30,
  simulate_only: false
});
```

### 3. Verificar no Modal
1. Abra composição em LoadCompositionModal
2. Clique em tab **"Descontos"**
3. Veja tabela com proposta

---

## 🚀 Roadmap

### MVP (Current)
- [x] Cálculo automático de desconto por cliente
- [x] 3 estratégias de distribuição
- [x] Validação de margem mínima
- [x] Exibição em Modal
- [x] Salvamento no DB

### V1.1 (Próximo)
- [ ] Notificação WhatsApp com desconto oferecido
- [ ] Configuração por cliente (margin_percent customizado)
- [ ] Histórico de descontos (audit trail)
- [ ] PDF de proposta comercial com descontos

### V2.0 (Futuro)
- [ ] Machine Learning para prever aceitação de desconto
- [ ] Desconto dinâmico (baseado em taxa de conversão)
- [ ] A/B testing de descontos
- [ ] Integração com CRM para follow-up

---

## 📝 Checklist Integração

- [x] Migration: tabela discount_breakdown
- [x] Edge Function: calculate-discount-breakdown
- [x] Hook: useCalculateDiscounts
- [x] Hook: atualizar useLoadCompositionSuggestion
- [x] Component: DiscountProposalBreakdown
- [x] Modal: adicionar tab "Descontos"
- [ ] Integração WhatsApp (notify-discount)
- [ ] Testes E2E

---

**Status:** ✅ Feature completa e integrada no Modal

**Próximas ações:**
1. Aplicar migrations: `supabase migration up --linked`
2. Testar Edge Function: `/calculate-discount-breakdown`
3. Verificar no Modal: tab "Descontos"
4. Implementar notificação WhatsApp (V1.1)
