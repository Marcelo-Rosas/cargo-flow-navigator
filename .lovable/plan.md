# Plano de Refatoração: Alinhamento freightCalculator ↔ Edge Function

## 📊 Diagnóstico Atual

### Frontend (`src/lib/freightCalculator.ts`)
- **Política**: FOB Lotação, impostos "por fora" (sem gross-up)
- **DAS**: 14% | **Markup**: 30% | **Overhead**: 15%
- **Componentes**: baseCost → baseFreight (com markup), GRIS, TSO, RCTR-C, TDE, TEAR
- **Saída**: `FreightCalculationOutput` com estrutura aninhada (meta, components, rates, totals, profitability)

### Backend (`supabase/functions/calculate-freight`)
- **Política**: ICMS com gross-up (inverso do frontend!)
- **TAC**: Ajuste por diesel (não existe no frontend)
- **Payment Term**: Ajuste por prazo de pagamento (não existe no frontend)
- **Saída**: `FreightBreakdown` com estrutura plana diferente

### ⚠️ Divergências Críticas

| Aspecto | Frontend | Backend | Ação |
|---------|----------|---------|------|
| ICMS | Por fora (soma simples) | Gross-up (÷ 1-rate) | **Alinhar ao frontend** |
| DAS | 14% fixo | Não implementado | **Adicionar ao backend** |
| Markup | 30% sobre baseCost | Não implementado | **Adicionar ao backend** |
| RCTR-C | cost_value_percent | Não implementado | **Adicionar ao backend** |
| TAC | Não implementado | Implementado | **Manter opcional** |
| Payment Term | Não implementado | Implementado | **Manter opcional** |
| TDE/TEAR | 20% sobre baseFreight | Não implementado | **Adicionar ao backend** |
| Overhead | 15% sobre margemBruta | Não implementado | **Adicionar ao backend** |

---

## 🎯 Decisão de Arquitetura

### Opção A: Frontend como "Source of Truth" ✅ (Recomendado)
- Edge Function alinha-se 100% ao `freightCalculator.ts`
- Frontend calcula localmente para preview rápido
- Backend valida/persiste com mesmas regras
- TAC e Payment Term são **extensões opcionais**

### Opção B: Backend como "Source of Truth"
- Frontend chama Edge Function para todo cálculo
- Mais latência, mas garante consistência

**Decisão**: Opção A - Frontend já implementa a política correta do "Referencial"

---

## 📋 Tarefas de Implementação

### Fase 1: Tipos Compartilhados (10 min)
- [ ] 1.1 Criar `supabase/functions/_shared/freight-types.ts`
- [ ] 1.2 Definir `FreightCalculationInput` e `FreightCalculationOutput` alinhados ao frontend
- [ ] 1.3 Exportar `normalizeIcmsRate()` para uso compartilhado

### Fase 2: Refatorar Edge Function (40 min)
- [ ] 2.1 **ICMS por fora**: Remover gross-up → `icms = receitaBruta * (rate/100)`
- [ ] 2.2 **DAS**: Buscar `pricing_parameters.das_percent` (fallback 14%)
- [ ] 2.3 **Markup**: Buscar `pricing_parameters.markup_percent` (fallback 30%)
- [ ] 2.4 **RCTR-C**: Adicionar `rctrc = cargoValue * (cost_value_percent/100)`
- [ ] 2.5 **TDE/TEAR**: Adicionar flags no input, calcular como 20% do baseFreight
- [ ] 2.6 **Overhead**: Buscar `pricing_parameters.overhead_percent` (fallback 15%)
- [ ] 2.7 **Rentabilidade**: Calcular margemBruta, overhead, resultadoLiquido, margemPercent
- [ ] 2.8 **Estrutura output**: Alinhar ao formato `FreightCalculationOutput`

### Fase 3: Decisão TAC/Payment Term (5 min)
- [ ] 3.1 **TAC**: Manter como campo opcional no input, aplicar se fornecido
- [ ] 3.2 **Payment Term**: Manter como campo opcional no input, aplicar se fornecido
- [ ] 3.3 Não adicionar ao frontend por enquanto (escopo futuro)

### Fase 4: Atualizar Hook `useCalculateFreight` (10 min)
- [ ] 4.1 Atualizar tipos para novo formato de input
- [ ] 4.2 Atualizar tipos para novo formato de output
- [ ] 4.3 Manter compatibilidade com chamadas existentes

### Fase 5: Testes e Validação (15 min)
- [ ] 5.1 Criar caso de teste com valores conhecidos
- [ ] 5.2 Comparar `totalCliente` frontend vs backend
- [ ] 5.3 Validar divergência máxima < R$ 0.01
- [ ] 5.4 Testar edge cases (km fora de faixa, tabela não encontrada)

---

## 🔄 Contratos de API (Proposta Final)

### Input Unificado
```typescript
interface FreightCalculationInput {
  // Localização (obrigatório)
  originCity: string;          // "Itajaí - SC"
  destinationCity: string;     // "São Paulo - SP"
  kmDistance: number;
  
  // Carga (obrigatório)
  weightKg: number;
  volumeM3: number;
  cargoValue: number;
  
  // Pedágio (obrigatório - manual)
  tollValue: number;
  
  // Referência (obrigatório)
  priceTableId: string;
  
  // ICMS (opcional - se não informado, buscar por UF)
  icmsRatePercent?: number;
  
  // Taxas NTC (opcional)
  tdeEnabled?: boolean;
  tearEnabled?: boolean;
  
  // Overrides globais (opcional - se não informado, buscar de pricing_parameters)
  dasPercent?: number;         // fallback: 14
  markupPercent?: number;      // fallback: 30
  overheadPercent?: number;    // fallback: 15
  
  // Extensões opcionais (backend only)
  tacEnabled?: boolean;        // aplicar TAC se true
  paymentTermCode?: string;    // aplicar ajuste prazo se informado
}
```

### Output Unificado
```typescript
interface FreightCalculationOutput {
  status: 'OK' | 'OUT_OF_RANGE' | 'MISSING_DATA';
  error?: string;
  
  meta: {
    routeUfLabel: string | null;        // "SC→SP"
    kmBandLabel: string | null;         // "1-50"
    kmStatus: 'OK' | 'OUT_OF_RANGE';
    marginStatus: 'ABOVE_TARGET' | 'BELOW_TARGET' | 'AT_TARGET';
    marginPercent: number;
    cubageFactor: number;
    cubageWeightKg: number;
    billableWeightKg: number;
  };
  
  components: {
    baseCost: number;          // ANTES do markup
    baseFreight: number;       // APÓS markup (baseCost * 1.30)
    toll: number;
    gris: number;
    tso: number;
    rctrc: number;
    adValorem: number;         // sempre 0
    tde: number;
    tear: number;
    // Extensões opcionais
    tacAdjustment?: number;
    paymentAdjustment?: number;
  };
  
  rates: {
    dasPercent: number;
    icmsPercent: number;
    grisPercent: number;
    tsoPercent: number;
    costValuePercent: number;
    markupPercent: number;
    overheadPercent: number;
  };
  
  totals: {
    receitaBruta: number;      // soma components
    das: number;               // receitaBruta * das%
    icms: number;              // receitaBruta * icms% (POR FORA!)
    totalImpostos: number;     // das + icms
    totalCliente: number;      // receitaBruta + totalImpostos
  };
  
  profitability: {
    custosCarreteiro: number;
    custosDescarga: number;
    custosDiretos: number;
    margemBruta: number;
    overhead: number;
    resultadoLiquido: number;
    margemPercent: number;
  };
  
  // Debug info (backend only)
  fallbacksApplied?: string[];
}
```

---

## ⏱️ Estimativa Total

| Fase | Complexidade | Tempo |
|------|--------------|-------|
| Fase 1 - Tipos | Baixa | 10 min |
| Fase 2 - Edge Function | Alta | 40 min |
| Fase 3 - TAC/Payment | Baixa | 5 min |
| Fase 4 - Hook | Média | 10 min |
| Fase 5 - Testes | Média | 15 min |
| **Total** | | **~80 min** |

---

## ✅ Critérios de Aceite

1. ✅ Edge Function retorna exatamente o mesmo `totalCliente` que o frontend para inputs idênticos
2. ✅ ICMS calculado "por fora" (soma simples) em ambos
3. ✅ DAS de 14% aplicado sobre receita bruta em ambos
4. ✅ Markup de 30% sobre baseCost em ambos
5. ✅ RCTR-C calculado com `cost_value_percent` em ambos
6. ✅ TDE/TEAR de 20% sobre baseFreight quando habilitados
7. ✅ Margem de rentabilidade calculada corretamente
8. ✅ Tipos TypeScript 100% compatíveis entre frontend e backend
9. ✅ Fallbacks documentados e logados quando usados

---

## 🚀 Próximos Passos

1. **Aprovar plano** para iniciar implementação
2. **Fase 1**: Criar tipos compartilhados em `_shared/`
3. **Fase 2**: Refatorar edge function alinhando à política do frontend
4. **Fase 3-4**: Atualizar hook e decidir extensões
5. **Fase 5**: Validar com testes comparativos
