# Documentação das Edge Functions

Base URL: `https://<project-ref>.supabase.co/functions/v1/<function-name>`

## 1. calculate-freight

Calcula frete rodoviário com base em origem, destino, peso, volume, valor da carga e tabela de preços (FOB Lotação, impostos "por fora", NTC).

**Método:** `POST`  
**Headers:** `Content-Type: application/json`  
**Auth:** Não requer JWT (usa Service Role internamente).

### Request

```json
{
  "origin": "Florianópolis - SC",
  "destination": "São Paulo - SP",
  "km_distance": 520,
  "weight_kg": 5000,
  "volume_m3": 18,
  "cargo_value": 100000,
  "price_table_id": "uuid-da-tabela",
  "toll_value": 0,
  "vehicle_type_code": "TRUCK",
  "payment_term_code": "D30",
  "tde_enabled": false,
  "tear_enabled": false,
  "conditional_fees": [],
  "waiting_hours": 0,
  "das_percent": 14,
  "markup_percent": 30,
  "overhead_percent": 15,
  "carreteiro_percent": 0,
  "descarga_value": 0
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| `origin` | string | Sim | "Cidade - UF" ou "Cidade, UF" |
| `destination` | string | Sim | "Cidade - UF" ou "Cidade, UF" |
| `km_distance` | number | Sim | Quilometragem da rota |
| `weight_kg` | number | Sim | Peso bruto (kg) |
| `volume_m3` | number | Sim | Volume (m³) |
| `cargo_value` | number | Sim | Valor da carga (R$) |
| `price_table_id` | string | Não | ID da tabela de preço para faixa por km |
| `toll_value` | number | Não | Pedágio manual (R$) |
| `vehicle_type_code` | string | Não | Código do tipo de veículo (para estadia) |
| `payment_term_code` | string | Não | Prazo de pagamento (ex: D30) |
| `tde_enabled` | boolean | Não | Taxa TDE (20% sobre frete base) |
| `tear_enabled` | boolean | Não | Taxa TEAR (20% sobre frete base) |
| `conditional_fees` | string[] | Não | Códigos de taxas condicionais |
| `waiting_hours` | number | Não | Horas de estadia |
| `das_percent` | number | Não | % DAS (default: 14) |
| `markup_percent` | number | Não | % Markup (default: 30) |
| `overhead_percent` | number | Não | % Overhead (default: 15) |
| `carreteiro_percent` | number | Não | % Carreteiro |
| `descarga_value` | number | Não | Custo fixo de descarga (R$) |

### Response (200 OK)

```json
{
  "success": true,
  "status": "OK",
  "meta": {
    "route_uf_label": "SC→SP",
    "km_band_label": "501-600",
    "km_status": "OK",
    "margin_status": "AT_TARGET",
    "margin_percent": 15.2,
    "cubage_factor": 300,
    "cubage_weight_kg": 5400,
    "billable_weight_kg": 5400
  },
  "components": {
    "base_cost": 5400,
    "base_freight": 7020,
    "toll": 0,
    "gris": 1200,
    "tso": 0,
    "rctrc": 100,
    "ad_valorem": 0,
    "tde": 0,
    "tear": 0,
    "conditional_fees_total": 0,
    "waiting_time_cost": 0
  },
  "rates": { "das_percent": 14, "icms_percent": 12, ... },
  "totals": {
    "receita_bruta": 10500,
    "das": 1470,
    "icms": 1260,
    "total_impostos": 2730,
    "total_cliente": 13230
  },
  "profitability": { "margem_percent": 15.2, ... },
  "conditional_fees_breakdown": {},
  "fallbacks_applied": [],
  "errors": []
}
```

### Erros (400)

```json
{
  "success": false,
  "status": "MISSING_DATA",
  "errors": ["Campo \"origin\" é obrigatório", "Campo \"weight_kg\" inválido"]
}
```

### Erros (500)

```json
{
  "success": false,
  "status": "MISSING_DATA",
  "errors": ["Erro interno: ..."],
  "meta": null,
  "components": null,
  "rates": null,
  "totals": null,
  "profitability": null,
  "conditional_fees_breakdown": {},
  "fallbacks_applied": []
}
```

---

## 2. lookup-cep

Consulta endereço por CEP (fallback: ViaCEP → BrasilAPI v2 → OpenCEP).

**Método:** `POST`  
**Headers:** `Content-Type: application/json`  
**Auth:** Não requer JWT.

### Request

```json
{
  "cep": "88015-100"
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `cep` | string | CEP com ou sem hífen (8 dígitos) |

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "cep": "88015-100",
    "logradouro": "Rua Felipe Schmidt",
    "complemento": "",
    "bairro": "Centro",
    "localidade": "Florianópolis",
    "uf": "SC",
    "ibge": "4205407",
    "formatted": "Rua Felipe Schmidt, Centro, Florianópolis - SC, 88015-100"
  }
}
```

### Erros (400)

```json
{
  "success": false,
  "error": "CEP inválido. Informe 8 dígitos."
}
```

### Erros (404)

```json
{
  "success": false,
  "error": "CEP não encontrado"
}
```

---

## 3. import-price-table

Importa tabela de preços e linhas (faixas de km) via JSON. Usa JWT do usuário (RLS).

**Método:** `POST`  
**Headers:** `Content-Type: application/json`, `Authorization: Bearer <jwt>`  
**Auth:** Requer JWT válido.

### Request

```json
{
  "priceTable": {
    "id": "new",
    "name": "Tabela FOB Lotação 2025",
    "modality": "lotacao",
    "valid_from": "2025-01-01",
    "valid_until": null,
    "active": true
  },
  "rows": [
    {
      "km_from": 0,
      "km_to": 50,
      "cost_per_ton": 120,
      "cost_value_percent": 0.6,
      "gris_percent": 0.3,
      "tso_percent": 0.2
    }
  ],
  "importMode": "replace"
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `priceTable.id` | string \| `"new"` | `"new"` para criar, UUID para atualizar |
| `priceTable.name` | string | Nome da tabela |
| `priceTable.modality` | `"lotacao"` \| `"fracionado"` | Modalidade |
| `priceTable.valid_from` | string \| null | Data início (YYYY-MM-DD) |
| `priceTable.valid_until` | string \| null | Data fim (YYYY-MM-DD) |
| `priceTable.active` | boolean | Se true, desativa outras da mesma modalidade |
| `rows` | array | Linhas com `km_from`, `km_to`, e custos |
| `importMode` | `"replace"` \| `"upsert"` | Substituir ou mesclar linhas |

Faixas devem ser únicas (sem sobreposição). Percentuais entre 0 e 100.

### Response (200 OK)

```json
{
  "success": true,
  "priceTableId": "uuid",
  "rowsTotal": 15,
  "rowsInserted": 15,
  "rowsUpdated": 0,
  "duplicatesRemoved": 0,
  "errors": []
}
```

### Erros (400)

```json
{
  "success": false,
  "rowsTotal": 15,
  "duplicatesRemoved": 2,
  "rowsInserted": 0,
  "rowsUpdated": 0,
  "errors": ["Faixas sobrepostas: 0-50 (linha 1) e 30-80 (linha 3)"]
}
```

### Erros (401)

```json
{
  "success": false,
  "rowsTotal": 0,
  "rowsInserted": 0,
  "rowsUpdated": 0,
  "errors": ["Não autorizado: token ausente"]
}
```
