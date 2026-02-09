
# Plano: Suporte a Entrada de Peso em Toneladas

## Problema Identificado

O sistema de cálculo de frete está funcionando corretamente com a fórmula:

```
baseCost = (billableWeightKg / 1000) × cost_per_ton
```

Porém, o campo de entrada de peso aceita apenas **kg**, enquanto operadores de lotação frequentemente informam cargas em **toneladas**. Se um usuário digita "10" pensando em 10 toneladas, o sistema interpreta como 10 kg, resultando em:

- **Esperado**: 10t = 10.000 kg → baseCost = 10 × R$ 117,94 = R$ 1.179,40
- **Calculado**: 10 kg → baseCost = 0,01 × R$ 117,94 = R$ 1,18

Isso explica porque o "Frete Base não está pegando o valor de R$/TON da tabela".

---

## Solução Proposta

Adicionar um **Toggle de Unidade** (kg/ton) ao lado do campo de peso, que:

1. Permite ao usuário escolher a unidade de entrada
2. Converte automaticamente para kg ao enviar para o cálculo
3. Exibe feedback visual claro sobre qual unidade está ativa
4. Persiste a preferência no breakdown para auditoria

---

## Tarefas de Implementação

### Tarefa 1: Atualizar QuoteForm.tsx

**Modificações:**
- Adicionar estado `weightUnit: 'kg' | 'ton'` com default `'kg'`
- Criar ToggleGroup ao lado do campo de peso
- Converter o valor para kg antes de passar para `calculateFreight()`:
  ```typescript
  const weightInKg = weightUnit === 'ton' 
    ? watchedWeight * 1000 
    : watchedWeight;
  ```
- Atualizar label do campo para mostrar unidade selecionada

**Regra no código:**
```typescript
// Antes de calcular
const effectiveWeightKg = weightUnit === 'ton' 
  ? (form.watch('weight') || 0) * 1000 
  : (form.watch('weight') || 0);
```

### Tarefa 2: Atualizar FreightSimulator.tsx

**Modificações:**
- Adicionar toggle de unidade similar ao QuoteForm
- Converter peso antes de enviar para Edge Function
- Atualizar labels e exibição de resultados

### Tarefa 3: Atualizar QuoteDetailModal.tsx

**Modificações:**
- Detectar se o peso salvo é > 1000 kg e sugerir exibição em toneladas
- Formatar exibição: `{weight >= 1000 ? (weight/1000).toFixed(2) + ' t' : weight + ' kg'}`
- Ou usar lógica inteligente baseada no valor

### Tarefa 4: Atualizar Tipos e Breakdown

**Modificações em `StoredPricingBreakdown.meta`:**
```typescript
meta: {
  // ... campos existentes
  inputWeightUnit?: 'kg' | 'ton';  // Para auditoria
}
```

---

## Regra de Conversão (Documentação no Código)

```typescript
/**
 * REGRA DE PESO - Entrada Flexível
 * 
 * O campo de peso suporta entrada em kg ou toneladas (ton).
 * A conversão para kg é feita no ponto de entrada:
 * 
 * - Se unidade = 'kg':  weightKg = valor digitado
 * - Se unidade = 'ton': weightKg = valor digitado × 1000
 * 
 * O cálculo interno SEMPRE usa kg:
 * - cubageWeight = volume × 300 (fator kg/m³)
 * - billableWeight = max(weightKg, cubageWeight)
 * - baseCost = (billableWeight / 1000) × cost_per_ton
 * 
 * Exemplo com cost_per_ton = R$ 117,94:
 * - Input: 5 ton → 5000 kg → 5 × R$ 117,94 = R$ 589,70
 * - Input: 5 kg  → 5 kg    → 0,005 × R$ 117,94 = R$ 0,59
 */
```

---

## UI Proposta

```
┌─────────────────────────────────────────┐
│ Peso                                    │
│ ┌──────────────────┐  ┌─────┬─────┐    │
│ │ 10               │  │ kg  │ ton │    │
│ └──────────────────┘  └─────┴─────┘    │
│                         ▲ Toggle ativo  │
└─────────────────────────────────────────┘
```

Usando `ToggleGroup` do Radix já disponível no projeto.

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/forms/QuoteForm.tsx` | Adicionar toggle kg/ton |
| `src/components/pricing/FreightSimulator.tsx` | Adicionar toggle kg/ton |
| `src/components/modals/QuoteDetailModal.tsx` | Formatação inteligente de peso |
| `src/lib/freightCalculator.ts` | Documentar regra no JSDoc |

---

## Validações Adicionais

1. **Valor máximo sensível**: Alertar se peso em ton > 30 (provavelmente erro)
2. **Consistência com volume**: Alertar se peso real < peso cubado em > 50%
3. **Heurística de auto-detecção** (opcional futuro):
   - Se valor < 100 e modalidade = lotação → sugerir "ton"
   - Se valor > 10.000 → assumir kg

---

## Critérios de Aceite

1. Usuário pode alternar entre kg e ton no QuoteForm
2. Digitando "10" com unidade "ton" resulta em peso faturável de 10.000 kg
3. O breakdown mostra o peso em kg independente da unidade de entrada
4. O QuoteDetailModal exibe o peso com formatação legível
5. A Edge Function continua recebendo `weight_kg` (sempre em kg)
