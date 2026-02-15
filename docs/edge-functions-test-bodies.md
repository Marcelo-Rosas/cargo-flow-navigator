# Bodies para testar Edge Functions

Use o Supabase Dashboard (**Edge Functions** → escolha a função → **Logs** / **Invoke**) ou `curl` para testar.

Base URL: `https://epgedaiukjippepujuzc.supabase.co/functions/v1/`

---

## 1. calculate-distance

**POST** — Cálculo de distância em km entre dois CEPs.

```json
{
  "origin_cep": "88015-100",
  "destination_cep": "01310-100"
}
```

---

## 2. lookup-cep

**POST** — Consulta de CEP (ViaCEP, BrasilAPI, OpenCEP).

```json
{
  "cep": "01310100"
}
```

ou

```json
{
  "cep": "01310-100"
}
```

---

## 3. calculate-freight

**POST** — Requer `Authorization: Bearer <JWT>` (usuário autenticado).

```json
{
  "origin": "Florianópolis - SC",
  "destination": "São Paulo - SP",
  "km_distance": 520,
  "weight_kg": 5000,
  "volume_m3": 18,
  "cargo_value": 100000,
  "price_table_id": "uuid-da-tabela-opcional",
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

**Mínimo obrigatório:**
```json
{
  "origin": "Florianópolis - SC",
  "destination": "São Paulo - SP",
  "km_distance": 520,
  "weight_kg": 5000,
  "volume_m3": 18,
  "cargo_value": 100000
}
```

---

## 4. import-price-table

**POST** — Requer `Authorization: Bearer <JWT>` (usuário autenticado). Importa tabela de preço.

```json
{
  "priceTable": {
    "id": "new",
    "name": "Tabela Teste",
    "modality": "lotacao",
    "valid_from": "2025-01-01",
    "valid_until": "2025-12-31",
    "active": true
  },
  "rows": [
    {
      "km_from": 0,
      "km_to": 100,
      "cost_per_ton": 250,
      "gris_percent": 0.5,
      "tso_percent": null,
      "toll_percent": null
    },
    {
      "km_from": 101,
      "km_to": 200,
      "cost_per_ton": 230,
      "gris_percent": 0.5
    }
  ],
  "importMode": "replace"
}
```

---

## Exemplo curl

```bash
# lookup-cep
curl -X POST "https://epgedaiukjippepujuzc.supabase.co/functions/v1/lookup-cep" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ANON_KEY" \
  -d '{"cep":"01310100"}'

# calculate-distance
curl -X POST "https://epgedaiukjippepujuzc.supabase.co/functions/v1/calculate-distance" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ANON_KEY" \
  -d '{"origin_cep":"88015-100","destination_cep":"01310-100"}'

# calculate-freight (precisa de JWT de usuário autenticado)
curl -X POST "https://epgedaiukjippepujuzc.supabase.co/functions/v1/calculate-freight" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer JWT_DO_USUARIO" \
  -d '{"origin":"Florianópolis - SC","destination":"São Paulo - SP","km_distance":520,"weight_kg":5000,"volume_m3":18,"cargo_value":100000}'
```
