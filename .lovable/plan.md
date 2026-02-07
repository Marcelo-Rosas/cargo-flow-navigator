

# Plano: Modelagem de Regras de Precificação do Referencial

## Resumo Executivo

Criar a infraestrutura de banco de dados e backend para suportar as regras completas de precificação do setor de transporte rodoviário de cargas, incluindo cubagem, estadia, pedágio por rota, TAC (diesel), taxas condicionais e prazo de pagamento.

---

## 1. Novas Tabelas e Estruturas

### 1.1 Parâmetros Gerais de Precificação

```text
pricing_parameters
├── id (uuid, PK)
├── key (text, UNIQUE) ─────────── ex: 'cubage_factor', 'min_freight'
├── value (numeric)
├── unit (text) ────────────────── ex: 'kg/m3', 'BRL', '%'
├── description (text)
├── valid_from (date)
├── valid_until (date)
├── created_by (uuid, FK)
├── created_at, updated_at
```

Valores iniciais:
- `cubage_factor`: 300 (kg/m³)
- `min_freight`: valor mínimo de frete
- `insurance_min`: seguro mínimo

---

### 1.2 Tipos de Veículo

```text
vehicle_types
├── id (uuid, PK)
├── code (text, UNIQUE) ────────── 'truck', 'carreta_3', 'bi_truck', etc.
├── name (text)
├── axes_count (integer) ───────── número de eixos
├── capacity_kg (numeric)
├── capacity_m3 (numeric)
├── active (boolean)
├── created_at, updated_at
```

---

### 1.3 Estadia / Hora Parada

```text
waiting_time_rules
├── id (uuid, PK)
├── vehicle_type_id (uuid, FK) ── NULL = regra padrão
├── context (text) ──────────────── 'loading', 'unloading', 'both'
├── free_hours (numeric) ────────── franquia em horas (ex: 6)
├── rate_per_hour (numeric) ─────── valor por hora excedente
├── rate_per_day (numeric) ──────── valor diária (alternativo)
├── min_charge (numeric) ────────── cobrança mínima
├── valid_from (date)
├── valid_until (date)
├── created_by (uuid, FK)
├── created_at, updated_at
```

---

### 1.4 Pedágio por Rota

```text
toll_routes
├── id (uuid, PK)
├── origin_state (char[2])
├── origin_city (text) ──────────── NULL = qualquer cidade do estado
├── destination_state (char[2])
├── destination_city (text)
├── vehicle_type_id (uuid, FK) ─── NULL = todos os veículos
├── toll_value (numeric)
├── distance_km (integer) ───────── distância referência
├── via_description (text) ──────── ex: "Via BR-116"
├── valid_from (date)
├── valid_until (date)
├── created_by (uuid, FK)
├── created_at, updated_at
```

---

### 1.5 TAC (Taxa de Ajuste do Combustível)

```text
tac_rates
├── id (uuid, PK)
├── reference_date (date, UNIQUE)
├── diesel_price_base (numeric) ─── preço base referência
├── diesel_price_current (numeric) ─ preço atual
├── variation_percent (numeric) ──── variação calculada
├── adjustment_percent (numeric) ─── ajuste a aplicar no frete
├── source_description (text) ────── ex: "ANP Semanal"
├── created_by (uuid, FK)
├── created_at, updated_at
```

---

### 1.6 Taxas Condicionais

```text
conditional_fees
├── id (uuid, PK)
├── code (text, UNIQUE) ────────── 'TDE', 'TEAR', 'SCHEDULING', etc.
├── name (text)
├── description (text)
├── fee_type (text) ────────────── 'percentage', 'fixed', 'per_kg'
├── fee_value (numeric)
├── min_value (numeric) ────────── valor mínimo quando aplicável
├── max_value (numeric) ────────── valor máximo (cap)
├── applies_to (text) ──────────── 'freight', 'cargo_value', 'total'
├── conditions (jsonb) ─────────── regras de quando aplicar
├── active (boolean)
├── valid_from (date)
├── valid_until (date)
├── created_by (uuid, FK)
├── created_at, updated_at
```

Valores iniciais:
| code | name | fee_type | Descrição |
|------|------|----------|-----------|
| TDE | Taxa Dificuldade Entrega | percentage | Difícil acesso |
| TEAR | Taxa Entrega Agend. Restrita | fixed | Janela < 2h |
| SCHEDULING | Taxa Agendamento | fixed | Agendamento prévio |
| OFF_HOURS | Fora de Horário | percentage | Fora horário comercial |
| RETURN | Devolução | percentage | Mercadoria devolvida |
| REDELIVERY | Reentrega | percentage | Segunda tentativa |

---

### 1.7 Prazo de Pagamento

```text
payment_terms
├── id (uuid, PK)
├── code (text, UNIQUE) ───────── 'AVISTA', 'D30', 'D60', etc.
├── name (text)
├── days (integer) ────────────── dias para pagamento
├── adjustment_percent (numeric) ─ % de ajuste sobre frete
├── active (boolean)
├── created_by (uuid, FK)
├── created_at, updated_at
```

Valores iniciais:
| code | days | adjustment_percent |
|------|------|--------------------|
| AVISTA | 0 | -2.0 |
| D15 | 15 | 0.0 |
| D30 | 30 | 1.5 |
| D45 | 45 | 2.5 |
| D60 | 60 | 3.5 |

---

## 2. Alterações em Tabelas Existentes

### 2.1 quotes (adicionar colunas)

```sql
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS
  vehicle_type_id uuid NULL REFERENCES vehicle_types(id),
  payment_term_id uuid NULL REFERENCES payment_terms(id),
  cubage_weight numeric NULL,           -- peso cubado calculado
  billable_weight numeric NULL,         -- peso taxável (maior entre real e cubado)
  toll_value numeric NULL,              -- pedágio calculado
  tac_percent numeric NULL,             -- TAC aplicado
  waiting_time_cost numeric NULL,       -- estadia calculada
  conditional_fees_breakdown jsonb NULL; -- { TDE: 150, SCHEDULING: 50 }
```

### 2.2 orders (adicionar colunas)

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS
  waiting_time_hours numeric NULL,       -- horas de estadia registradas
  waiting_time_cost numeric NULL;        -- custo de estadia cobrado
```

---

## 3. Função de Cálculo com Fallback

### 3.1 Estrutura da Edge Function

Criar `supabase/functions/calculate-freight/index.ts`:

```text
Input:
├── origin (text: "Cidade - UF")
├── destination (text: "Cidade - UF")
├── weight_kg (numeric)
├── volume_m3 (numeric)
├── cargo_value (numeric)
├── vehicle_type_code (text, optional)
├── payment_term_code (text, optional)
├── conditional_fees (string[], optional) ── ['TDE', 'OFF_HOURS']
├── waiting_hours (numeric, optional)

Output:
├── success (boolean)
├── breakdown (object)
│   ├── weight_real (numeric)
│   ├── weight_cubed (numeric)
│   ├── weight_billable (numeric)
│   ├── base_freight (numeric)
│   ├── gris (numeric)
│   ├── ad_valorem (numeric)
│   ├── toll (numeric)
│   ├── tac_adjustment (numeric)
│   ├── icms (numeric)
│   ├── waiting_time (numeric)
│   ├── conditional_fees (object)
│   ├── payment_adjustment (numeric)
│   ├── subtotal (numeric)
│   └── total (numeric)
├── parameters_used (object) ── snapshot para auditoria
├── fallbacks_applied (string[])
└── errors (string[])
```

### 3.2 Lógica de Fallback

| Regra | Se não configurada | Fallback |
|-------|-------------------|----------|
| Cubagem | `pricing_parameters.cubage_factor` não existe | Usar 300 kg/m³ |
| Estadia | `waiting_time_rules` vazia | Usar franquia 6h + R$ 50/h |
| Pedágio | Rota não encontrada | Usar 0 (pedágio não incluído) |
| TAC | `tac_rates` sem registro válido | Usar 0% (sem ajuste) |
| ICMS | `icms_rates` sem UF origem/destino | Usar 12% (alíquota interna média) |
| Taxas condicionais | Taxa solicitada não existe | Ignorar e logar warning |
| Prazo pagamento | Term não existe | Usar D30 (padrão) |

---

## 4. Diagrama de Relacionamentos

```text
                    ┌─────────────────────┐
                    │   pricing_parameters │
                    │   (cubage, min, etc) │
                    └─────────────────────┘
                              │
  ┌──────────────────────────┼──────────────────────────┐
  │                          │                          │
  ▼                          ▼                          ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  vehicle_types   │   │  payment_terms   │   │   tac_rates     │
│  (tipos veículo) │   │  (prazos pgto)   │   │  (ajuste diesel)│
└────────┬────────┘   └─────────────────┘   └─────────────────┘
         │
         ├────────────────────────────────────────┐
         │                                        │
         ▼                                        ▼
┌─────────────────┐                     ┌─────────────────┐
│waiting_time_rules│                     │   toll_routes   │
│  (estadia/hora)  │                     │ (pedágio/rota)  │
└─────────────────┘                     └─────────────────┘

┌─────────────────┐
│ conditional_fees │
│(TDE,TEAR,etc)   │
└─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                         quotes                           │
│  ├── vehicle_type_id, payment_term_id                   │
│  ├── cubage_weight, billable_weight                     │
│  ├── toll_value, tac_percent, waiting_time_cost         │
│  └── conditional_fees_breakdown (jsonb)                 │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/migrations/XXXXXX_pricing_rules.sql` | Criar | Migration com todas as tabelas novas |
| `supabase/functions/calculate-freight/index.ts` | Criar | Edge Function de cálculo |
| `src/types/pricing.ts` | Criar | Types TypeScript para as novas estruturas |
| `src/hooks/usePricingRules.ts` | Criar | Hook para buscar regras ativas |
| `src/hooks/useCalculateFreight.ts` | Criar | Hook para chamar a Edge Function |

---

## 6. Migration SQL (Resumida)

```sql
-- Verificação de dependências
DO $$ ... verificar app_role, has_role, has_any_role ... $$;

-- 1. pricing_parameters
CREATE TABLE IF NOT EXISTS public.pricing_parameters (...);

-- 2. vehicle_types
CREATE TABLE IF NOT EXISTS public.vehicle_types (...);

-- 3. waiting_time_rules
CREATE TABLE IF NOT EXISTS public.waiting_time_rules (...);

-- 4. toll_routes  
CREATE TABLE IF NOT EXISTS public.toll_routes (...);

-- 5. tac_rates
CREATE TABLE IF NOT EXISTS public.tac_rates (...);

-- 6. conditional_fees
CREATE TABLE IF NOT EXISTS public.conditional_fees (...);

-- 7. payment_terms
CREATE TABLE IF NOT EXISTS public.payment_terms (...);

-- 8. ALTER quotes (novas colunas)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS ...;

-- 9. ALTER orders (novas colunas)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ...;

-- 10. Dados iniciais (seeds)
INSERT INTO pricing_parameters (key, value, unit) VALUES ...;
INSERT INTO vehicle_types (code, name, axes_count) VALUES ...;
INSERT INTO payment_terms (code, name, days, adjustment_percent) VALUES ...;
INSERT INTO conditional_fees (code, name, fee_type) VALUES ...;

-- 11. RLS policies (admin/operacao para todas)
...
```

---

## 7. Critérios de Aceite

1. Todas as 7 novas tabelas criadas com RLS correto
2. Colunas adicionais em `quotes` e `orders` funcionando
3. Edge Function `calculate-freight` retornando breakdown completo
4. Fallbacks aplicados e logados quando regra não configurada
5. Types TypeScript atualizados automaticamente pelo Supabase
6. Dados iniciais (seeds) inseridos para testes imediatos

---

## 8. Estimativa

- **Migration SQL**: ~300 linhas
- **Edge Function**: ~400 linhas
- **Types/Hooks**: ~200 linhas
- **Tempo estimado**: 45-60 minutos de implementação

