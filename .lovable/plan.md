

# Plano: Interface Admin de Regras de Precificacao e Simulador de Frete

## Objetivo

Criar uma interface administrativa para gerenciar todas as regras de precificacao (cubagem, estadia, taxas condicionais, TAC, pedagio e prazos de pagamento) e um simulador que mostra o impacto em tempo real no calculo do frete.

---

## 1. Arquitetura da Solucao

A UI sera adicionada como uma nova aba "Regras" na pagina existente `/tabelas-preco`, seguindo o padrao atual de abas (Tabelas, Vigentes, ICMS).

```text
/tabelas-preco
├── Tabelas (existente)
├── Vigentes (existente)
├── ICMS (existente)
├── Regras (NOVO) ─────────────────────────────────────────┐
│   ├── Accordion: Parametros Gerais                       │
│   │   └── cubage_factor, min_freight, insurance_min      │
│   ├── Accordion: Tipos de Veiculo                        │
│   │   └── VUC, TOCO, TRUCK, etc.                         │
│   ├── Accordion: Estadia/Hora Parada                     │
│   │   └── Franquia + rate por tipo veiculo               │
│   ├── Accordion: Taxas Condicionais                      │
│   │   └── TDE, TEAR, OFF_HOURS, etc.                     │
│   ├── Accordion: TAC (Ajuste Diesel)                     │
│   │   └── Historico de variacoes                         │
│   ├── Accordion: Pedagio por Rota                        │
│   │   └── UF origem/destino + valor                      │
│   └── Accordion: Prazos de Pagamento                     │
│       └── AVISTA, D30, D60, etc.                         │
└── Simulador (NOVO) ──────────────────────────────────────┐
    ├── Formulario de entrada                              │
    │   └── Origem, Destino, Peso, Volume, Valor mercadoria│
    │   └── Tipo veiculo, Prazo pgto, Taxas condicionais   │
    └── Painel de resultado                                │
        └── Breakdown completo do calculo                  │
        └── Fallbacks aplicados (alertas)                  │
```

---

## 2. Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/hooks/usePricingRules.ts` | Modificar | Adicionar mutations CRUD para todas as tabelas |
| `src/pages/PriceTables.tsx` | Modificar | Adicionar aba "Regras" e aba "Simulador" |
| `src/components/pricing/PricingRulesTab.tsx` | Criar | Componente com accordions para cada categoria |
| `src/components/pricing/FreightSimulator.tsx` | Criar | Formulario + painel de resultado |
| `src/components/pricing/PricingParametersSection.tsx` | Criar | CRUD de parametros gerais |
| `src/components/pricing/VehicleTypesSection.tsx` | Criar | CRUD de tipos de veiculo |
| `src/components/pricing/WaitingTimeRulesSection.tsx` | Criar | CRUD de regras de estadia |
| `src/components/pricing/ConditionalFeesSection.tsx` | Criar | CRUD de taxas condicionais |
| `src/components/pricing/TacRatesSection.tsx` | Criar | CRUD de TAC |
| `src/components/pricing/TollRoutesSection.tsx` | Criar | CRUD de pedagio por rota |
| `src/components/pricing/PaymentTermsSection.tsx` | Criar | CRUD de prazos de pagamento |

---

## 3. Detalhes por Componente

### 3.1 usePricingRules.ts - Mutations CRUD

Adicionar ao hook existente:

```typescript
// PRICING PARAMETERS
useCreatePricingParameter()
useUpdatePricingParameter()
useDeletePricingParameter()

// VEHICLE TYPES
useCreateVehicleType()
useUpdateVehicleType()
useDeleteVehicleType()

// WAITING TIME RULES
useCreateWaitingTimeRule()
useUpdateWaitingTimeRule()
useDeleteWaitingTimeRule()

// TAC RATES
useCreateTacRate()
useUpdateTacRate()
useDeleteTacRate()

// TOLL ROUTES
useCreateTollRoute()
useUpdateTollRoute()
useDeleteTollRoute()

// CONDITIONAL FEES
useCreateConditionalFee()
useUpdateConditionalFee()
useDeleteConditionalFee()

// PAYMENT TERMS
useCreatePaymentTerm()
useUpdatePaymentTerm()
useDeletePaymentTerm()
```

### 3.2 PricingRulesTab.tsx

```text
┌─────────────────────────────────────────────────────────────┐
│ [Accordion] Parametros Gerais                           [v] │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Cubagem: 300 kg/m³  [Editar]                            │ │
│ │ Frete Minimo: R$ 150,00  [Editar]                       │ │
│ │ Seguro Minimo: R$ 50,00  [Editar]                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Accordion] Tipos de Veiculo                            [>] │
│                                                             │
│ [Accordion] Estadia/Hora Parada                         [>] │
│                                                             │
│ [Accordion] Taxas Condicionais                          [>] │
│                                                             │
│ [Accordion] TAC (Ajuste Diesel)                         [>] │
│                                                             │
│ [Accordion] Pedagio por Rota                            [>] │
│                                                             │
│ [Accordion] Prazos de Pagamento                         [>] │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 FreightSimulator.tsx

Layout em 2 colunas (ou empilhado em mobile):

```text
┌────────────────────────────┬────────────────────────────────┐
│ ENTRADA                    │ RESULTADO                      │
│                            │                                │
│ Origem: [Sao Paulo - SP  ] │ ┌──────────────────────────────┐
│ Destino: [Curitiba - PR  ] │ │ PESO                         │
│                            │ │ Real: 1.500 kg               │
│ Peso (kg): [1500         ] │ │ Cubado: 2.400 kg             │
│ Volume (m³): [8          ] │ │ Taxavel: 2.400 kg            │
│ Valor Mercadoria: [50000 ] │ └──────────────────────────────┘
│                            │ ┌──────────────────────────────┐
│ Distancia (km): [450     ] │ │ COMPONENTES                  │
│ Tabela: [NTC Lotacao v   ] │ │ Frete Base: R$ 1.200,00      │
│                            │ │ GRIS: R$ 125,00              │
│ Tipo Veiculo: [TRUCK    v] │ │ Ad Valorem: R$ 250,00        │
│ Prazo Pgto: [D30        v] │ │ Pedagio: R$ 180,00           │
│                            │ │ TAC (2.5%): R$ 43,88         │
│ [x] TDE                    │ │ Estadia: R$ 0,00             │
│ [ ] TEAR                   │ │ TDE (10%): R$ 120,00         │
│ [x] OFF_HOURS              │ │ OFF_HOURS (15%): R$ 180,00   │
│ [ ] SCHEDULING             │ │ Pgto D30 (1.5%): R$ 29,85    │
│                            │ └──────────────────────────────┘
│ Horas Estadia: [0        ] │ ┌──────────────────────────────┐
│                            │ │ ICMS (12%): R$ 273,62        │
│ [    Calcular    ]         │ ├──────────────────────────────┤
│                            │ │ TOTAL: R$ 2.402,35           │
│                            │ └──────────────────────────────┘
│                            │                                │
│                            │ ⚠ Fallbacks aplicados:         │
│                            │ • toll_routes: rota SP→PR      │
│                            │   nao encontrada, usando 0     │
└────────────────────────────┴────────────────────────────────┘
```

---

## 4. UI dos Formularios de Edicao

### 4.1 Parametros Gerais (inline edit)

| Campo | Tipo | Validacao |
|-------|------|-----------|
| key | readonly | - |
| value | number | >= 0 |
| unit | readonly | - |
| description | text | max 200 chars |

### 4.2 Tipos de Veiculo

| Campo | Tipo | Validacao |
|-------|------|-----------|
| code | text | required, unique |
| name | text | required |
| axes_count | number | 2-12 |
| capacity_kg | number | > 0 |
| capacity_m3 | number | > 0 |
| active | switch | - |

### 4.3 Estadia/Hora Parada

| Campo | Tipo | Validacao |
|-------|------|-----------|
| vehicle_type_id | select (nullable) | - |
| context | select | loading/unloading/both |
| free_hours | number | >= 0, default 6 |
| rate_per_hour | currency | > 0 |
| rate_per_day | currency | > 0 |
| min_charge | currency | >= 0 |

### 4.4 Taxas Condicionais

| Campo | Tipo | Validacao |
|-------|------|-----------|
| code | text | required, unique |
| name | text | required |
| fee_type | select | percentage/fixed/per_kg |
| fee_value | number | > 0 |
| min_value | currency | nullable |
| max_value | currency | nullable |
| applies_to | select | freight/cargo_value/total |
| active | switch | - |

### 4.5 TAC (Ajuste Diesel)

| Campo | Tipo | Validacao |
|-------|------|-----------|
| reference_date | date | required, unique |
| diesel_price_base | currency | > 0 |
| diesel_price_current | currency | > 0 |
| variation_percent | number | auto-calculated |
| adjustment_percent | number | required |
| source_description | text | nullable |

### 4.6 Pedagio por Rota

| Campo | Tipo | Validacao |
|-------|------|-----------|
| origin_state | select UF | required |
| origin_city | text | nullable |
| destination_state | select UF | required |
| destination_city | text | nullable |
| vehicle_type_id | select | nullable |
| toll_value | currency | > 0 |
| distance_km | number | > 0 |
| via_description | text | nullable |

### 4.7 Prazos de Pagamento

| Campo | Tipo | Validacao |
|-------|------|-----------|
| code | text | required, unique |
| name | text | required |
| days | number | >= 0 |
| adjustment_percent | number | pode ser negativo |
| active | switch | - |

---

## 5. Modificacoes na PriceTables.tsx

Adicionar 2 novas abas ao TabsList existente:

```tsx
<TabsList>
  <TabsTrigger value="tabelas">Tabelas</TabsTrigger>
  <TabsTrigger value="vigentes">Vigentes</TabsTrigger>
  <TabsTrigger value="icms">ICMS</TabsTrigger>
  <TabsTrigger value="regras">Regras</TabsTrigger>      {/* NOVO */}
  <TabsTrigger value="simulador">Simulador</TabsTrigger> {/* NOVO */}
</TabsList>

<TabsContent value="regras">
  <PricingRulesTab />
</TabsContent>

<TabsContent value="simulador">
  <FreightSimulator />
</TabsContent>
```

---

## 6. Estimativa de Arquivos

| Componente | Linhas aprox. |
|------------|---------------|
| usePricingRules.ts (adicoes) | ~300 linhas |
| PricingRulesTab.tsx | ~150 linhas |
| FreightSimulator.tsx | ~350 linhas |
| PricingParametersSection.tsx | ~120 linhas |
| VehicleTypesSection.tsx | ~180 linhas |
| WaitingTimeRulesSection.tsx | ~200 linhas |
| ConditionalFeesSection.tsx | ~200 linhas |
| TacRatesSection.tsx | ~180 linhas |
| TollRoutesSection.tsx | ~220 linhas |
| PaymentTermsSection.tsx | ~150 linhas |
| **Total** | **~2.050 linhas** |

---

## 7. Criterios de Aceite

1. Todas as 7 categorias de regras editaveis via UI (CRUD completo)
2. Simulador chamando Edge Function `calculate-freight` em tempo real
3. Breakdown detalhado mostrando todos os componentes do calculo
4. Alertas visuais para fallbacks aplicados
5. Validacao de formularios com mensagens em portugues
6. Responsivo (accordions empilham em mobile, simulador muda para layout vertical)
7. Feedback visual com toast para todas as acoes

---

## 8. Ordem de Implementacao

1. **Fase 1**: Hook mutations (usePricingRules.ts)
2. **Fase 2**: Estrutura de abas (PriceTables.tsx)
3. **Fase 3**: Componentes de cada secao (7 componentes)
4. **Fase 4**: Simulador de Frete
5. **Fase 5**: Testes e ajustes finais

