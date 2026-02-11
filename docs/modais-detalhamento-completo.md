# Documentação Completa: QuoteDetailModal & OrderDetailModal

> CRM Vectra Cargo — Referência técnica dos modais de detalhamento  
> Gerado em: 11/02/2026

---

## Sumário

1. [QuoteDetailModal](#1-quotedetailmodal)
2. [OrderDetailModal](#2-orderdetailmodal)
3. [Flipchart — QuoteDetailModal](#3-flipchart--quotedetailmodal)
4. [Flipchart — OrderDetailModal](#4-flipchart--orderdetailmodal)
5. [Fluxo de Estágios — Cotações](#5-fluxo-de-estágios--cotações)
6. [Fluxo de Estágios — Ordens de Serviço](#6-fluxo-de-estágios--ordens-de-serviço)
7. [Mapeamento de Banco — quotes](#7-mapeamento-de-banco--quotes)
8. [Mapeamento de Banco — orders](#8-mapeamento-de-banco--orders)
9. [Estrutura JSONB — pricing_breakdown](#9-estrutura-jsonb--pricing_breakdown)

---

## 1. QuoteDetailModal

### Header

| Elemento | Descrição |
|----------|-----------|
| Título | "Cotação" |
| Badge Estágio | 7 estágios com cores distintas (`novo_pedido` → `perdido`) |
| Badge Rota UF | Ex: `SC→SP` (extraído de `pricing_breakdown.meta.routeUfLabel`) |
| Badge Faixa KM | Ex: `0-50 km` (extraído de `pricing_breakdown.meta.kmBandLabel`) |
| Botão "Converter para OS" | Visível **apenas** no estágio `ganho` |
| Botão Editar | Ícone lápis (Pencil) — abre QuoteForm em modo edição |

### Alertas

| Alerta | Condição | Variante |
|--------|----------|----------|
| Margem abaixo de 15% | `pricing_breakdown.meta.marginPercent < 15` | `warning` |
| Distância fora da faixa | `pricing_breakdown.meta.kmStatus !== 'exact'` | `destructive` |

### Seção Cliente (sempre visível)

| Campo | Ícone | Fonte |
|-------|-------|-------|
| client_name | Building2 | `quote.client_name` |
| client_email | Mail | `quote.client_email` |

### Seção Embarcador (condicional — requer `shipper_name`)

| Campo | Fonte |
|-------|-------|
| shipper_name | `quote.shipper_name` |
| shipper_email | `quote.shipper_email` |
| freight_type | Badge: FOB / CIF |
| freight_modality | Badge: lotação / fracionado |

### Seção Rota (sempre visível)

| Campo | Formato |
|-------|---------|
| Origem | `{cidade}` + CEP formatado (`00000-000`) |
| Destino | `{cidade}` + CEP formatado (`00000-000`) |

### Seção Dados da Carga (condicional — requer `cargo_type` ou `weight` ou `volume`)

| Campo | Ícone | Formato |
|-------|-------|---------|
| cargo_type | Package | Texto |
| weight | Scale | `≥ 1000 kg` → exibe em toneladas (ex: `10 t`) |
| volume | Box | `{valor} m³` |

### Seção Detalhes de Precificação (condicional — requer `price_table_id`)

| Campo | Fonte | Formato |
|-------|-------|---------|
| Tabela de Preços | Lookup `price_tables.name` via `price_table_id` | Nome |
| Veículo | Lookup `vehicle_types` via `vehicle_type_id` | `{name} ({code})` |
| Prazo Pagamento | Lookup `payment_terms` via `payment_term_id` | `{name}` + `{adjustment_percent}%` |
| Distância | `quote.km_distance` | `{valor} km` |

### Breakdown do Cálculo (condicional — requer `pricing_breakdown`)

| Componente | Campo JSONB | Formato |
|------------|-------------|---------|
| Frete Base | `components.baseFreight` | R$ |
| Pedágio | `components.toll` | R$ |
| RCTR-C | `components.rctrc` | R$ + (%) |
| GRIS | `components.gris` | R$ + (%) |
| TSO | `components.tso` | R$ + (%) |
| TDE (NTC) | `components.tde` | R$ |
| TEAR (NTC) | `components.tear` | R$ |
| **Receita Bruta** | `totals.receitaBruta` | **R$** |
| DAS | `totals.das` | R$ + (%) |
| ICMS | `totals.icms` | R$ + (%) |
| **TOTAL CLIENTE** | `totals.totalCliente` | **R$ (destaque)** |

### Rentabilidade (condicional — requer `profitability`)

| Métrica | Campo JSONB | Cor |
|---------|-------------|-----|
| Margem Bruta | `profitability.margemBruta` | — |
| Overhead | `profitability.overhead` | — |
| Resultado Líquido | `profitability.resultadoLiquido` | Verde ≥ 0 / Vermelho < 0 |
| Margem % | `profitability.margemPercent` | Warning se < 15% |

### Taxas Adicionais (collapsible)

| Elemento | Descrição |
|----------|-----------|
| AdditionalFeesSection | Taxas condicionais (TDE, TEAR, etc.) + tempo de espera |
| Botão "Salvar Taxas" | Persiste seleção e recalcula via mutation |
| Tempo de Espera | Horas configuráveis com custo calculado via `waiting_time_rules` |

### Rodapé

| Campo | Formato |
|-------|---------|
| Valor Total | `formatCurrency` — fallback para `quote.value` se sem breakdown |
| Validade | `formatDate(quote.validity_date)` |
| Tags | Badges com cores especiais: `urgente` (vermelho), `contrato` (azul), `refrigerado` (ciano) |
| Observações | Texto livre `quote.notes` |
| Timestamps | `Criado em: {created_at}` · `Atualizado em: {updated_at}` |

---

## 2. OrderDetailModal

### Header

| Elemento | Descrição |
|----------|-----------|
| os_number | Texto grande (ex: `OS-2026-001`) |
| Badge Estágio | 6 estágios com cores distintas |
| Botão Editar | Ícone lápis — abre OrderForm em modo edição |

### Estágios e Cores

| Estágio | Label | Cor |
|---------|-------|-----|
| `ordem_criada` | Ordem Criada | `bg-muted` |
| `busca_motorista` | Busca Motorista | `bg-accent` |
| `documentacao` | Documentação | `bg-primary/10` |
| `coleta_realizada` | Coleta Realizada | `bg-warning/10` |
| `em_transito` | Em Trânsito | `bg-warning/10` |
| `entregue` | Entregue | `bg-success/10` |

### Tabs

| Tab | Visibilidade | Badge |
|-----|-------------|-------|
| Detalhes | Sempre | — |
| Documentos | A partir de `busca_motorista` | FileText icon |
| Ocorrências | Sempre | Contador (AlertTriangle icon) |

### Tab: Detalhes

| Seção | Campos | Visibilidade |
|-------|--------|-------------|
| Cliente | `client_name` | Sempre |
| Rota | `origin`, `destination` (com ícone MapPin) | Sempre |
| Motorista | `driver_name`, `driver_phone`, `vehicle_plate` | A partir de `busca_motorista` |
| Valor/ETA | `value` (formatCurrency), `eta` (formatDate) | Sempre |
| Observações | `notes` | Se preenchido |
| Timestamps | `created_at`, `updated_at` | Sempre |

### Tab: Documentos (condicional)

| Componente | Descrição |
|------------|-----------|
| DocumentUpload | Upload por estágio — tipos aceitos variam por `order.stage` |
| DocumentList | Lista de documentos já enviados para a OS |

#### Flags de Documentos por Estágio

| Estágio | Docs Motorista | Docs Fiscais | POD |
|---------|---------------|-------------|-----|
| `busca_motorista` | CNH, CRLV, Comp. Residência, ANTT | — | — |
| `documentacao` | CNH, CRLV, Comp. Residência, ANTT | NF-e, CT-e, MDF-e, GR | — |
| `coleta_realizada` | ✓ | ✓ | — |
| `em_transito` | ✓ | ✓ | — |
| `entregue` | ✓ | ✓ | **POD** |

### Tab: Ocorrências

| Elemento | Descrição |
|----------|-----------|
| Botão "Nova Ocorrência" | Abre OccurrenceForm |
| Lista | Cards com severidade colorida |
| Badge "Resolvida" | Verde, visível quando `resolved_at` preenchido |
| Botão "Marcar como Resolvida" | Chama `useResolveOccurrence` mutation |

#### Cores de Severidade

| Severidade | Classe |
|------------|--------|
| `baixa` | `bg-muted` |
| `media` | `bg-warning/20 text-warning-foreground` |
| `alta` | `bg-destructive/20 text-destructive` |
| `critica` | `bg-destructive text-destructive-foreground` |

---

## 3. Flipchart — QuoteDetailModal

```text
+============================================+
|  Cotação  [Estágio] [SC→SP] [0-50 km]     |
|                          [Converter] [Edit] |
+============================================+
| ⚠ Margem 12.5% abaixo de 15%              |
| ⚠ Distância fora da faixa                  |
+--------------------------------------------+
| [Building2]                                 |
| Nome do Cliente                             |
| ✉ email@cliente.com                        |
+--------------------------------------------+
| Embarcador                                  |
| Nome Embarcador    [FOB] [Lotação]          |
| ✉ email@embarcador.com                     |
+--------------------------------------------+
| [Origem]          | [Destino]               |
| Itajaí, SC        | São Paulo, SP           |
| CEP: 88301-000    | CEP: 01001-000          |
+--------------------------------------------+
| Dados da Carga                              |
| [Tipo]     | [Peso]      | [Volume]         |
| Geral      | 10 t        | 30 m³            |
+--------------------------------------------+
| Detalhes de Precificação                    |
| [Tabela]   | [Veículo]                      |
| Tab. SC-SP | Truck (TK)                     |
| [Pagto]    | [Distância]                    |
| 30 dias    | 450 km                         |
+--------------------------------------------+
| Breakdown do Cálculo                        |
| Frete Base ................. R$ 1.179,40    |
| Pedágio .................... R$   250,00    |
| RCTR-C (0.30%) ............. R$    45,00    |
| GRIS (0.02%) ............... R$     3,00    |
| TSO (0.50%) ................ R$    75,00    |
| TDE (NTC) .................. R$   235,88    |
| TEAR (NTC) ................. R$   235,88    |
| -----------------------------------         |
| Receita Bruta .............. R$ 2.024,16    |
| DAS (14.00%) ............... R$   283,38    |
| ICMS (12.00%) .............. R$   242,90    |
| ===================================         |
| TOTAL CLIENTE .............. R$ 2.550,44    |
+--------------------------------------------+
| Rentabilidade                               |
| Margem Bruta ............... R$   890,00    |
| Overhead ................... R$   303,62    |
| Resultado Líquido .......... R$   586,38    |
| Margem % ................... 29.0%          |
+--------------------------------------------+
| [▸] Taxas Adicionais (2)     [Salvar]      |
|   [ ] Horário noturno                       |
|   [✓] Carga perigosa                        |
|   Tempo espera: 4h = R$ 120,00             |
+--------------------------------------------+
| Valor Total: R$ 2.550,44                   |
| Validade: 15 de março de 2026              |
| Tags: [urgente] [refrigerado]              |
| Obs: Carga frágil, cuidado no manuseio     |
| Criado: 10/02/2026  Atualizado: 11/02/2026 |
+============================================+
```

---

## 4. Flipchart — OrderDetailModal

```text
+=============================================+
|  OS-2026-001  [Em Trânsito]          [Edit] |
+=============================================+
| [Detalhes] | [Documentos] | [Ocorrências 2]|
+---------------------------------------------+
|                                              |
| TAB: DETALHES                                |
| +------------------------------------------+ |
| | Cliente                                  | |
| | Transportadora ABC                       | |
| +------------------------------------------+ |
|                                              |
| +-------------------+---------------------+ |
| | 📍 Origem         | 📍 Destino          | |
| | Itajaí, SC        | São Paulo, SP       | |
| +-------------------+---------------------+ |
|                                              |
| +------------------------------------------+ |
| | 🚛 Motorista                             | |
| | João Silva                               | |
| | 📞 (47) 99999-0000     ABC-1234         | |
| +------------------------------------------+ |
|                                              |
| +-------------------+---------------------+ |
| | 💰 Valor Frete    | 📅 ETA              | |
| | R$ 2.550,44       | 15 de março, 14:00  | |
| +-------------------+---------------------+ |
|                                              |
| Obs: Entregar no dock 5                     |
| Criado: 10/02  |  Atualizado: 11/02         |
+---------------------------------------------+
|                                              |
| TAB: DOCUMENTOS                              |
| +------------------------------------------+ |
| | Docs Motorista                           | |
| | [✓] CNH  [✓] CRLV  [ ] Comp.Res  [ ] ANTT |
| | ---------------------------------------- | |
| | Docs Fiscais                             | |
| | [✓] NF-e  [ ] CT-e  [ ] MDF-e  [ ] GR   | |
| | ---------------------------------------- | |
| | POD                                      | |
| | [ ] Comprovante de Entrega               | |
| | ---------------------------------------- | |
| | [Upload Area - arrastar ou clicar]       | |
| | ---------------------------------------- | |
| | Lista de documentos enviados             | |
| +------------------------------------------+ |
+---------------------------------------------+
|                                              |
| TAB: OCORRÊNCIAS                             |
| +------------------------------------------+ |
| | Histórico           [+ Nova Ocorrência]  | |
| | +--------------------------------------+ | |
| | | [CRÍTICA] Avaria na carga            | | |
| | | Descrição do problema...             | | |
| | | 10/02/2026      [Marcar Resolvida]   | | |
| | +--------------------------------------+ | |
| | | [MÉDIA] [Resolvida] Atraso coleta    | | |
| | | Descrição...                         | | |
| | | 09/02/2026                           | | |
| | +--------------------------------------+ | |
| +------------------------------------------+ |
+=============================================+
```

---

## 5. Fluxo de Estágios — Cotações

```text
QUOTE STAGES (visibilidade progressiva)
═══════════════════════════════════════════

novo_pedido ──► qualificação ──► precificação ──► enviado ──► negociação ──► ganho ──► perdido
    │                │                │              │            │           │          │
    ▼                ▼                ▼              ▼            ▼           ▼          ▼
 [Cliente]       [Cliente]        [Cliente]      [Cliente]    [Cliente]   [Cliente]   [Cliente]
 [Rota]          [Rota]           [Rota]         [Rota]       [Rota]      [Rota]      [Rota]
 [Carga]         [Carga]          [Carga]        [Carga]      [Carga]     [Carga]     [Carga]
                 [Embarcador]     [Embarcador]   [Embarcador] [Embarcador][Embarcador]
                                  [Precificação] [Precif.]    [Precif.]   [Precif.]
                                  [Breakdown]    [Breakdown]  [Breakdown] [Breakdown]
                                  [Rentabilidade][Rentab.]    [Rentab.]   [Rentab.]
                                  [Taxas Adic.]  [Taxas]      [Taxas]     [Taxas]
                                                                          [Converter OS]
```

---

## 6. Fluxo de Estágios — Ordens de Serviço

```text
ORDER STAGES (visibilidade progressiva)
═══════════════════════════════════════════

ordem_criada ──► busca_motorista ──► documentação ──► coleta_realizada ──► em_trânsito ──► entregue
     │                │                   │                 │                  │               │
     ▼                ▼                   ▼                 ▼                  ▼               ▼
  [Cliente]        [Cliente]           [Cliente]         [Cliente]          [Cliente]       [Cliente]
  [Rota]           [Rota]              [Rota]            [Rota]             [Rota]          [Rota]
  [Valor/ETA]      [Valor/ETA]         [Valor/ETA]       [Valor/ETA]        [Valor/ETA]     [Valor/ETA]
  [Ocorrências]    [Ocorrências]       [Ocorrências]     [Ocorrências]      [Ocorrências]   [Ocorrências]
                   [Motorista]         [Motorista]       [Motorista]        [Motorista]     [Motorista]
                   [Tab Docs]          [Tab Docs]        [Tab Docs]         [Tab Docs]      [Tab Docs]
                   Docs Motorista:     Docs Motorista:   Docs Motorista:    Docs Motorista:  Docs Motorista:
                     CNH                 CNH               CNH               CNH              CNH
                     CRLV                CRLV              CRLV              CRLV             CRLV
                     Comp.Res            Comp.Res          Comp.Res          Comp.Res         Comp.Res
                     ANTT                ANTT              ANTT              ANTT             ANTT
                                       Docs Fiscais:     Docs Fiscais:      Docs Fiscais:    Docs Fiscais:
                                         NF-e              NF-e               NF-e             NF-e
                                         CT-e              CT-e               CT-e             CT-e
                                         MDF-e             MDF-e              MDF-e            MDF-e
                                         GR                GR                 GR               GR
                                                                                              POD
```

---

## 7. Mapeamento de Banco — quotes

| Campo | Tipo | Nullable | Default | Descrição |
|-------|------|----------|---------|-----------|
| `id` | uuid | Não | `gen_random_uuid()` | PK |
| `client_name` | text | Não | — | Nome do cliente |
| `client_email` | text | Sim | — | Email do cliente |
| `client_id` | uuid | Sim | — | FK → clients |
| `shipper_name` | text | Sim | — | Nome do embarcador |
| `shipper_email` | text | Sim | — | Email do embarcador |
| `shipper_id` | uuid | Sim | — | FK → shippers |
| `origin` | text | Não | — | Cidade origem |
| `destination` | text | Não | — | Cidade destino |
| `origin_cep` | text | Sim | — | CEP origem |
| `destination_cep` | text | Sim | — | CEP destino |
| `weight` | numeric | Sim | — | Peso em kg |
| `volume` | numeric | Sim | — | Volume em m³ |
| `cargo_type` | text | Sim | — | Tipo da carga |
| `cargo_value` | numeric | Sim | — | Valor da mercadoria |
| `toll_value` | numeric | Sim | — | Valor pedágio |
| `km_distance` | integer | Sim | — | Distância em km |
| `freight_type` | text | Não | `'CIF'` | FOB / CIF |
| `freight_modality` | text | Sim | — | lotação / fracionado |
| `price_table_id` | uuid | Sim | — | FK → price_tables |
| `vehicle_type_id` | uuid | Sim | — | FK → vehicle_types |
| `payment_term_id` | uuid | Sim | — | FK → payment_terms |
| `value` | numeric | Não | `0` | Valor total calculado |
| `stage` | quote_stage | Não | `'novo_pedido'` | Estágio atual |
| `pricing_breakdown` | jsonb | Sim | — | Snapshot completo do cálculo |
| `conditional_fees_breakdown` | jsonb | Sim | — | Taxas condicionais selecionadas |
| `validity_date` | date | Sim | — | Validade da cotação |
| `tags` | text[] | Sim | `'{}'` | Array de tags |
| `notes` | text | Sim | — | Observações |
| `billable_weight` | numeric | Sim | — | Peso tarifável |
| `cubage_weight` | numeric | Sim | — | Peso cubado |
| `tac_percent` | numeric | Sim | — | % TAC aplicado |
| `waiting_time_cost` | numeric | Sim | — | Custo tempo espera |
| `assigned_to` | uuid | Sim | — | Responsável |
| `created_by` | uuid | Não | — | Criador |
| `created_at` | timestamptz | Não | `now()` | Data criação |
| `updated_at` | timestamptz | Não | `now()` | Data atualização |

---

## 8. Mapeamento de Banco — orders

| Campo | Tipo | Nullable | Default | Descrição |
|-------|------|----------|---------|-----------|
| `id` | uuid | Não | `gen_random_uuid()` | PK |
| `os_number` | text | Não | — | Número da OS (gerado) |
| `quote_id` | uuid | Sim | — | FK → quotes |
| `client_name` | text | Não | — | Nome do cliente (snapshot) |
| `client_id` | uuid | Sim | — | FK → clients |
| `origin` | text | Não | — | Cidade origem |
| `destination` | text | Não | — | Cidade destino |
| `value` | numeric | Não | `0` | Valor do frete |
| `stage` | order_stage | Não | `'ordem_criada'` | Estágio atual |
| `driver_name` | text | Sim | — | Nome motorista (snapshot) |
| `driver_phone` | text | Sim | — | Telefone motorista |
| `vehicle_plate` | text | Sim | — | Placa veículo |
| `driver_id` | uuid | Sim | — | FK → drivers |
| `eta` | timestamptz | Sim | — | Previsão entrega |
| `notes` | text | Sim | — | Observações |
| `has_nfe` | boolean | Não | `false` | Flag NF-e |
| `has_cte` | boolean | Não | `false` | Flag CT-e |
| `has_mdfe` | boolean | Sim | `false` | Flag MDF-e |
| `has_gr` | boolean | Sim | `false` | Flag GR |
| `has_pod` | boolean | Não | `false` | Flag POD |
| `has_cnh` | boolean | Sim | `false` | Flag CNH motorista |
| `has_crlv` | boolean | Sim | `false` | Flag CRLV |
| `has_comp_residencia` | boolean | Sim | `false` | Flag Comp. Residência |
| `has_antt_motorista` | boolean | Sim | `false` | Flag ANTT motorista |
| `has_antt` | boolean | Sim | `false` | Flag ANTT (legacy) |
| `has_mdf` | boolean | Sim | `false` | Flag MDF (legacy) |
| `waiting_time_hours` | numeric | Sim | — | Horas de espera |
| `waiting_time_cost` | numeric | Sim | — | Custo tempo espera |
| `ui_last_tab` | text | Sim | — | Última tab aberta (UI state) |
| `assigned_to` | uuid | Sim | — | Responsável |
| `created_by` | uuid | Não | — | Criador |
| `created_at` | timestamptz | Não | `now()` | Data criação |
| `updated_at` | timestamptz | Não | `now()` | Data atualização |

---

## 9. Estrutura JSONB — pricing_breakdown

```json
{
  "meta": {
    "routeUfLabel": "SC→SP",
    "kmBandLabel": "401-500 km",
    "kmStatus": "exact | interpolated | extrapolated",
    "marginStatus": "ok | warning | critical",
    "marginPercent": 29.0,
    "inputWeightUnit": "kg | ton",
    "selectedConditionalFeeIds": ["uuid-1", "uuid-2"],
    "waitingTimeEnabled": true,
    "waitingTimeHours": 4
  },
  "weights": {
    "cubageWeight": 9000,
    "billableWeight": 10000,
    "tonBillable": 10
  },
  "components": {
    "baseCost": 1179.40,
    "baseFreight": 1179.40,
    "toll": 250.00,
    "gris": 3.00,
    "tso": 75.00,
    "rctrc": 45.00,
    "adValorem": 0,
    "tde": 235.88,
    "tear": 235.88,
    "conditionalFeesTotal": 120.00,
    "waitingTimeCost": 120.00
  },
  "totals": {
    "receitaBruta": 2024.16,
    "das": 283.38,
    "icms": 242.90,
    "totalImpostos": 526.28,
    "totalCliente": 2550.44
  },
  "profitability": {
    "custosCarreteiro": 600.00,
    "custosDescarga": 100.00,
    "custosDiretos": 700.00,
    "margemBruta": 890.00,
    "overhead": 303.62,
    "resultadoLiquido": 586.38,
    "margemPercent": 29.0
  },
  "rates": {
    "dasPercent": 14.00,
    "icmsPercent": 12.00,
    "grisPercent": 0.02,
    "tsoPercent": 0.50,
    "costValuePercent": 0.30,
    "markupPercent": 0,
    "overheadPercent": 15.0
  }
}
```

---

> **Fim do documento** — Gerado automaticamente pelo CRM Vectra Cargo.
