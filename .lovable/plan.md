# Plano: Modelagem de Regras de Precificação do Referencial

## ✅ STATUS: IMPLEMENTADO

---

## Resumo da Implementação

### Tabelas Criadas (7 novas + 2 alteradas)

| Tabela | Descrição | Status |
|--------|-----------|--------|
| `pricing_parameters` | Parâmetros gerais (cubagem, frete mínimo, etc) | ✅ |
| `vehicle_types` | Tipos de veículo (VUC, Toco, Truck, etc) | ✅ |
| `waiting_time_rules` | Regras de estadia/hora parada | ✅ |
| `toll_routes` | Pedágio por rota | ✅ |
| `tac_rates` | TAC (ajuste diesel) | ✅ |
| `conditional_fees` | Taxas condicionais (TDE, TEAR, etc) | ✅ |
| `payment_terms` | Prazos de pagamento | ✅ |
| `quotes` (alterada) | Novas colunas de precificação | ✅ |
| `orders` (alterada) | Colunas de estadia | ✅ |

### Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/calculate-freight/index.ts` | Edge Function de cálculo completo |
| `src/types/pricing.ts` | Types TypeScript para regras de precificação |
| `src/hooks/usePricingRules.ts` | Hooks para buscar regras ativas |
| `src/hooks/useCalculateFreight.ts` | Hook para chamar a Edge Function |

### Dados Iniciais (Seeds)

- **pricing_parameters**: cubage_factor (300), min_freight (150), insurance_min (50)
- **vehicle_types**: VUC, TOCO, TRUCK, BI_TRUCK, CARRETA_3, CARRETA_4, RODOTREM
- **payment_terms**: AVISTA (-2%), D15 (0%), D30 (1.5%), D45 (2.5%), D60 (3.5%), D90 (5%)
- **conditional_fees**: TDE (10%), TEAR (R$150), SCHEDULING (R$80), OFF_HOURS (15%), RETURN (50%), REDELIVERY (30%)
- **waiting_time_rules**: Regra padrão (6h franquia + R$50/h excedente)

### Lógica de Fallback Implementada

| Regra | Fallback |
|-------|----------|
| Cubagem | 300 kg/m³ |
| Estadia | 6h franquia + R$50/h |
| Pedágio | 0 (não incluído) |
| TAC | 0% |
| ICMS | 12% |
| Taxas condicionais | Ignorar se não encontrada |
| Prazo pagamento | D30 (1.5%) |

---

## Próximos Passos Sugeridos

1. **Criar UI para gerenciamento** das regras de precificação
2. **Integrar calculate-freight** no formulário de cotações
3. **Importar dados reais** de pedágio e ICMS
4. **Configurar TAC** com dados da ANP
