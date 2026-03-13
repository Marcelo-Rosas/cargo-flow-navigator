# Documentacao Completa: QuoteDetailModal e OrderDetailModal

Vou criar um arquivo `.md` para download com a documentacao completa de ambos os modais, incluindo diagramas de fluxo em ASCII (flipchart).

---

## Arquivo a Criar

### `docs/modais-detalhamento-completo.md`

Conteudo completo com:

1. **QuoteDetailModal** - Todos os campos, secoes, regras de visibilidade por estagio, breakdown de calculo, rentabilidade e taxas adicionais
2. **OrderDetailModal** - Todos os campos, tabs, regras de visibilidade por estagio, documentos e ocorrencias
3. **Diagramas Flipchart** em ASCII art para ambos os fluxos

---

## Conteudo do Arquivo

O markdown tera as seguintes secoes:

### QuoteDetailModal

**Header:**
- Titulo "Cotacao"
- Badge de estagio (7 estagios com cores)
- Badge rota UF (ex: SC->SP)
- Badge faixa KM
- Botao "Converter para OS" (visivel apenas em `ganho`)
- Botao Editar (icone lapis)

**Alertas:**
- Margem abaixo de 15% (warning)
- Distancia fora da faixa KM (destructive)

**Secao Cliente:**
- Avatar com icone Building2
- client_name
- client_email (com icone Mail)

**Secao Embarcador (condicional):**
- shipper_name
- shipper_email
- freight_type (badge)
- freight_modality: lotacao | fracionado (badge)

**Secao Rota:**
- Origem (cidade + CEP formatado)
- Destino (cidade + CEP formatado)

**Secao Dados da Carga (condicional):**
- cargo_type (icone Package)
- weight: formatacao inteligente >= 1000kg mostra em toneladas
- volume em m3 (icone Box)

**Secao Detalhes de Precificacao (condicional):**
- Tabela de Precos (nome via lookup)
- Veiculo (nome + codigo via lookup)
- Prazo Pagamento (nome + % ajuste via lookup)
- Distancia em km

**Breakdown do Calculo (condicional - requer pricing_breakdown):**
- Componentes: baseFreight, toll, rctrc (%), gris (%), tso (%), tde, tear
- Receita Bruta
- DAS (%)
- ICMS (%)
- Total Cliente (destaque)

**Rentabilidade (condicional - requer profitability):**
- Margem Bruta
- Overhead
- Resultado Liquido (verde se >= 0, vermelho se < 0)
- Margem % (warning se abaixo de 15%)

**Taxas Adicionais (collapsible):**
- AdditionalFeesSection (taxas condicionais + tempo de espera)
- Botao "Salvar Taxas" (mutation para recalcular)

**Rodape:**
- Valor Total (fallback se sem breakdown)
- Validade da cotacao
- Tags (com cores especiais: urgente, contrato, refrigerado)
- Observacoes
- Timestamps (criado/atualizado)

### OrderDetailModal

**Header:**
- os_number (texto grande)
- Badge de estagio (6 estagios com cores)
- Botao Editar (icone lapis)

**Tabs:**
- Detalhes (sempre)
- Documentos (visivel a partir de `busca_motorista`)
- Ocorrencias (sempre, com contador badge)

**Tab Detalhes:**
- Cliente: client_name
- Rota: origem + destino (sempre visivel)
- Motorista (a partir de `busca_motorista`): driver_name, driver_phone, vehicle_plate
- Valor do Frete: formatCurrency
- ETA: data formatada
- Observacoes
- Timestamps

**Tab Documentos (condicional):**
- DocumentUpload (por estagio)
- DocumentList

**Tab Ocorrencias:**
- Botao "Nova Ocorrencia"
- Lista com severidade (baixa/media/alta/critica) com cores
- Badge "Resolvida"
- Botao "Marcar como Resolvida"

### Diagramas Flipchart (ASCII)

**QuoteDetailModal - Layout:**

```text
+============================================+
|  Cotacao  [Estagio] [SC->SP] [0-50 km]    |
|                          [Converter] [Edit] |
+============================================+
| ! Margem 12.5% abaixo de 15%              |
| ! Distancia fora da faixa                  |
+--------------------------------------------+
| [Building2]                                 |
| Nome do Cliente                             |
| email@cliente.com                           |
+--------------------------------------------+
| Embarcador                                  |
| Nome Embarcador    [FOB] [Lotacao]          |
| email@embarcador.com                        |
+--------------------------------------------+
| [Origem]          | [Destino]               |
| Itajai, SC        | Sao Paulo, SP           |
| CEP: 88301-000    | CEP: 01001-000          |
+--------------------------------------------+
| Dados da Carga                              |
| [Tipo]     | [Peso]      | [Volume]         |
| Geral      | 10 t        | 30 m3            |
+--------------------------------------------+
| Detalhes de Precificacao                    |
| [Tabela]   | [Veiculo]                      |
| Tab. SC-SP | Truck (TK)                     |
| [Pagto]    | [Distancia]                    |
| 30 dias    | 450 km                         |
+--------------------------------------------+
| Breakdown do Calculo                        |
| Frete Base ................. R$ 1.179,40    |
| Pedagio .................... R$   250,00    |
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
| Resultado Liquido .......... R$   586,38    |
| Margem % ................... 29.0%          |
+--------------------------------------------+
| [+] Taxas Adicionais (2)     [Salvar]      |
|   [ ] Horario noturno                       |
|   [x] Carga perigosa                        |
|   Tempo espera: 4h = R$ 120,00             |
+--------------------------------------------+
| Validade: 15 de marco de 2026              |
| Tags: [urgente] [refrigerado]              |
| Obs: Carga fragil, cuidado no manuseio     |
| Criado: 10/02/2026  Atualizado: 11/02/2026 |
+============================================+
```

**OrderDetailModal - Layout:**

```text
+=============================================+
|  OS-2026-001  [Em Transito]          [Edit] |
+=============================================+
| [Detalhes] | [Documentos] | [Ocorrencias 2]|
+---------------------------------------------+
|                                              |
| TAB: DETALHES                                |
| +------------------------------------------+ |
| | Cliente                                  | |
| | Transportadora ABC                       | |
| +------------------------------------------+ |
|                                              |
| +-------------------+---------------------+ |
| | [Pin] Origem      | [Pin] Destino       | |
| | Itajai, SC        | Sao Paulo, SP       | |
| +-------------------+---------------------+ |
|                                              |
| +------------------------------------------+ |
| | [Truck] Motorista                        | |
| | Joao Silva                               | |
| | [Phone] (47) 99999-0000  ABC-1234       | |
| +------------------------------------------+ |
|                                              |
| +-------------------+---------------------+ |
| | [$] Valor Frete   | [Cal] ETA           | |
| | R$ 2.550,44       | 15 de marco, 14:00  | |
| +-------------------+---------------------+ |
|                                              |
| Obs: Entregar no dock 5                     |
| Criado: 10/02  |  Atualizado: 11/02         |
+---------------------------------------------+
|                                              |
| TAB: DOCUMENTOS                              |
| +------------------------------------------+ |
| | [Upload Area - por estagio]              | |
| | ---------------------------------------- | |
| | Lista de documentos enviados             | |
| +------------------------------------------+ |
+---------------------------------------------+
|                                              |
| TAB: OCORRENCIAS                             |
| +------------------------------------------+ |
| | Historico           [+ Nova Ocorrencia]  | |
| | +--------------------------------------+ | |
| | | [CRITICA] Avaria na carga            | | |
| | | Descricao do problema...             | | |
| | | 10/02/2026      [Marcar Resolvida]   | | |
| | +--------------------------------------+ | |
| | | [MEDIA] [Resolvida] Atraso coleta    | | |
| | | Descricao...                         | | |
| | | 09/02/2026                           | | |
| | +--------------------------------------+ | |
| +------------------------------------------+ |
+=============================================+
```

**Fluxo de Estagios - QuoteDetailModal:**

```text
QUOTE STAGES (visibilidade progressiva)
=========================================

novo_pedido -----> qualificacao -----> precificacao -----> enviado -----> negociacao -----> ganho -----> perdido
    |                  |                   |                 |               |              |            |
    |                  |                   |                 |               |              |            |
    v                  v                   v                 v               v              v            v
 [Cliente]          [Cliente]           [Cliente]         [Cliente]       [Cliente]      [Cliente]    [Cliente]
 [Rota]             [Rota]              [Rota]            [Rota]          [Rota]         [Rota]       [Rota]
 [Carga]            [Carga]             [Carga]           [Carga]         [Carga]        [Carga]      [Carga]
                    [Embarcador]        [Embarcador]      [Embarcador]    [Embarcador]   [Embarcador]
                                        [Precificacao]    [Precificacao]  [Precificacao] [Precificacao]
                                        [Breakdown]       [Breakdown]     [Breakdown]    [Breakdown]
                                        [Rentabilidade]   [Rentabilidade] [Rentabilidade][Rentabilidade]
                                        [Taxas Adicionais][Taxas]         [Taxas]        [Taxas]
                                                                                         [Converter OS]
```

**Fluxo de Estagios - OrderDetailModal:**

```text
ORDER STAGES (visibilidade progressiva)
=========================================

ordem_criada ---> busca_motorista ---> documentacao ---> coleta_realizada ---> em_transito ---> entregue
     |                  |                  |                   |                   |               |
     v                  v                  v                   v                   v               v
  [Cliente]          [Cliente]          [Cliente]           [Cliente]           [Cliente]        [Cliente]
  [Rota]             [Rota]             [Rota]              [Rota]              [Rota]           [Rota]
  [Valor/ETA]        [Valor/ETA]        [Valor/ETA]         [Valor/ETA]         [Valor/ETA]      [Valor/ETA]
  [Ocorrencias]      [Ocorrencias]      [Ocorrencias]       [Ocorrencias]       [Ocorrencias]    [Ocorrencias]
                     [Motorista]        [Motorista]         [Motorista]         [Motorista]      [Motorista]
                     [Tab Docs]         [Tab Docs]          [Tab Docs]          [Tab Docs]       [Tab Docs]
                     Docs Motorista:    Docs Motorista:     Docs Motorista:     Docs Motorista:  Docs Motorista:
                       CNH               CNH                 CNH                 CNH              CNH
                       CRLV              CRLV                CRLV                CRLV             CRLV
                       Comp.Res          Comp.Res            Comp.Res            Comp.Res         Comp.Res
                       ANTT              ANTT                ANTT                ANTT             ANTT
                                        Docs Fiscais:       Docs Fiscais:       Docs Fiscais:    Docs Fiscais:
                                          NF-e                NF-e                NF-e             NF-e
                                          CT-e                CT-e                CT-e             CT-e
                                          MDF-e               MDF-e               MDF-e            MDF-e
                                          GR                  GR                  GR               GR
                                                                                                  POD
```

---

## Detalhes Tecnicos

### Campos do Banco (quotes)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid | PK |
| client_name | text | Nome do cliente |
| client_email | text | Email do cliente |
| shipper_name | text | Nome do embarcador |
| shipper_email | text | Email do embarcador |
| origin | text | Cidade origem |
| destination | text | Cidade destino |
| origin_cep | text | CEP origem |
| destination_cep | text | CEP destino |
| weight | numeric | Peso em kg |
| volume | numeric | Volume em m3 |
| cargo_type | text | Tipo da carga |
| cargo_value | numeric | Valor da mercadoria |
| toll_value | numeric | Valor pedagio |
| km_distance | numeric | Distancia em km |
| freight_type | text | FOB/CIF |
| freight_modality | text | lotacao/fracionado |
| price_table_id | uuid | FK tabela de precos |
| vehicle_type_id | uuid | FK tipo veiculo |
| payment_term_id | uuid | FK prazo pagamento |
| value | numeric | Valor total calculado |
| stage | quote_stage | Estagio atual |
| pricing_breakdown | jsonb | Snapshot completo calculo |
| validity_date | date | Validade da cotacao |
| tags | text[] | Array de tags |
| notes | text | Observacoes |
| waiting_time_cost | numeric | Custo tempo espera |
| created_at | timestamptz | Data criacao |
| updated_at | timestamptz | Data atualizacao |

### Campos do Banco (orders)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid | PK |
| os_number | text | Numero da OS |
| quote_id | uuid | FK cotacao origem |
| client_name | text | Nome do cliente (snapshot) |
| origin | text | Cidade origem |
| destination | text | Cidade destino |
| value | numeric | Valor do frete |
| stage | order_stage | Estagio atual |
| driver_name | text | Nome motorista (snapshot) |
| driver_phone | text | Telefone motorista |
| vehicle_plate | text | Placa veiculo |
| driver_id | uuid | FK motorista |
| eta | timestamptz | Previsao entrega |
| notes | text | Observacoes |
| has_nfe | boolean | Flag NF-e |
| has_cte | boolean | Flag CT-e |
| has_mdfe | boolean | Flag MDF-e |
| has_gr | boolean | Flag GR |
| has_pod | boolean | Flag POD |
| has_cnh | boolean | Flag CNH motorista |
| has_crlv | boolean | Flag CRLV |
| has_comp_residencia | boolean | Flag Comp. Residencia |
| has_antt_motorista | boolean | Flag ANTT |
| created_at | timestamptz | Data criacao |
| updated_at | timestamptz | Data atualizacao |

### StoredPricingBreakdown (JSONB)

Estrutura salva no campo `pricing_breakdown`:

- **meta**: routeUfLabel, kmBandLabel, kmStatus, marginStatus, marginPercent, inputWeightUnit, selectedConditionalFeeIds, waitingTimeEnabled, waitingTimeHours
- **weights**: cubageWeight, billableWeight, tonBillable
- **components**: baseCost, baseFreight, toll, gris, tso, rctrc, adValorem, tde, tear, conditionalFeesTotal, waitingTimeCost
- **totals**: receitaBruta, das, icms, totalImpostos, totalCliente
- **profitability**: custosCarreteiro, custosDescarga, custosDiretos, margemBruta, overhead, resultadoLiquido, margemPercent
- **rates**: dasPercent, icmsPercent, grisPercent, tsoPercent, costValuePercent, markupPercent, overheadPercent

