# Plano de Refatoração: Alinhamento freightCalculator ↔ Edge Function

## ✅ Status: CONCLUÍDO

**Última atualização:** 2026-02-09

---

## 📊 Resumo da Implementação

### Arquivos Criados/Modificados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/_shared/freight-types.ts` | ✅ Criado | Tipos e helpers compartilhados |
| `supabase/functions/calculate-freight/index.ts` | ✅ Refatorado | Alinhado à política FOB Lotação |
| `src/hooks/useCalculateFreight.ts` | ✅ Atualizado | Nova estrutura de tipos |
| `src/types/pricing.ts` | ✅ Atualizado | Tipos alinhados |
| `src/components/pricing/FreightSimulator.tsx` | ✅ Atualizado | UI para nova estrutura |

---

## ✅ Critérios de Aceite Validados

1. ✅ **ICMS "por fora"**: `icms = receitaBruta * (rate/100)` - sem gross-up
2. ✅ **DAS 14%**: Busca de `pricing_parameters` com fallback
3. ✅ **Markup 30%**: `baseFreight = baseCost * 1.30`
4. ✅ **RCTR-C**: Calculado com `cost_value_percent`
5. ✅ **TDE/TEAR**: 20% sobre baseFreight quando habilitados
6. ✅ **Rentabilidade**: margemBruta, overhead, resultadoLiquido, margemPercent
7. ✅ **TAC/Payment Term**: Mantidos como extensões opcionais no backend
8. ✅ **Tipos unificados**: Frontend e backend com mesma estrutura

---

## 🔄 Nova Estrutura de Response

```typescript
interface CalculateFreightResponse {
  success: boolean;
  status: 'OK' | 'OUT_OF_RANGE' | 'MISSING_DATA';
  error?: string;
  
  meta: {
    route_uf_label: string | null;
    km_band_label: string | null;
    km_status: 'OK' | 'OUT_OF_RANGE';
    margin_status: 'ABOVE_TARGET' | 'BELOW_TARGET' | 'AT_TARGET';
    margin_percent: number;
    cubage_factor: number;
    cubage_weight_kg: number;
    billable_weight_kg: number;
  };
  
  components: {
    base_cost: number;
    base_freight: number;
    toll: number;
    gris: number;
    tso: number;
    rctrc: number;
    ad_valorem: number;
    tde: number;
    tear: number;
    conditional_fees_total: number;
    waiting_time_cost: number;
  };
  
  rates: {
    das_percent: number;
    icms_percent: number;
    gris_percent: number;
    tso_percent: number;
    cost_value_percent: number;
    markup_percent: number;
    overhead_percent: number;
    tac_percent: number;
    payment_adjustment_percent: number;
  };
  
  totals: {
    receita_bruta: number;
    das: number;
    icms: number;
    tac_adjustment: number;
    payment_adjustment: number;
    total_impostos: number;
    total_cliente: number;
  };
  
  profitability: {
    custos_carreteiro: number;
    custos_descarga: number;
    custos_diretos: number;
    margem_bruta: number;
    overhead: number;
    resultado_liquido: number;
    margem_percent: number;
  };
  
  conditional_fees_breakdown: Record<string, number>;
  fallbacks_applied: string[];
  errors: string[];
}
```

---

## 🧪 Teste Realizado

**Input:**
```json
{
  "origin": "São Paulo - SP",
  "destination": "Curitiba - PR",
  "km_distance": 450,
  "weight_kg": 1500,
  "volume_m3": 8,
  "cargo_value": 50000,
  "toll_value": 150,
  "tde_enabled": true
}
```

**Output (resumo):**
- Route: SP→PR
- Billable Weight: 2400 kg (peso cubado prevalece)
- DAS: 14%, Markup: 30%, ICMS: 12%
- Margem: 62.9% (ABOVE_TARGET)
- Total Cliente: R$ 191,84

---

## 🚀 Próximos Passos Sugeridos

1. **Integrar no QuoteForm**: Usar Edge Function para cálculo oficial
2. **Criar tabela ICMS SP→PR**: Atualmente usando fallback 12%
3. **Importar tabela de preços**: Para ter base_cost correto
4. **Adicionar carreteiro_percent**: Para cálculo de custos diretos
