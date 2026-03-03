---
name: ""
overview: ""
todos:
  - id: todo-1772303308052-xgyjstq73
    content: ""
    status: pending
isProject: false
---

# Plano: Rentabilidade, Aluguel, Descarga e Qualificação COT→OS

**Data:** 2026-02-27

---

## Concluído

### 1. Correção custosCarreteiro (calculate-freight)

- `custosCarreteiro = ntc_base` em vez de `pisoAnttCarreteiro`
- Margem passa a usar custo real da tabela NTC

### 2. Botão Recalcular (QuoteDetailModal)

- Botão visível quando há breakdown, price_table_id e km_distance
- Chama Edge Function e atualiza pricing_breakdown + value

### 3. Migrations

- `equipment_rental_rates`: Empilhadeira, Munck, Paleteira
- `unloading_cost_rates`: Chapa

---

## Pendente

### 4. Hooks useEquipmentRentalRates, useUnloadingCostRates

### 5. Aba Carga/Descarga no QuoteDetailModal

### 6. Aba Aluguel no QuoteDetailModal

### 7. Payload calculate-freight: aluguel_maquinas

### 8. Aba Aluguel no OrderDetailModal com override

### 9. qualification_checklist + checkboxes

