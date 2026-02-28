---
name: Trips PRD Implementation
overview: "Implementar o PRD de Viagens (Trips): migration completa (trips, trip_orders, trip_cost_items, payment_proofs, views de conciliacao), Edge Functions (process-payment-proof, reconcile-trip), atualizacao do workflow-orchestrator, e UI minima (cards, toggle, modal de comprovantes)."
todos:
  - id: migration-sql
    content: "Fase 1: Migration SQL — trips, trip_orders, trip_cost_items, payment_proofs, orders.driver_id, orders.trip_id, documents.trip_id, views de conciliacao, RPC generate_trip_number, RLS, indices"
    status: pending
  - id: edge-process-payment
    content: "Fase 2: Edge Function process-payment-proof — validar doc type, mapear proof_type, upsert payment_proofs, placeholder de extracao"
    status: pending
  - id: orchestrator-handler
    content: "Fase 3: Atualizar workflow-orchestrator handleDocumentUploaded — filtrar adiantamento_carreteiro/saldo_carreteiro e chamar process-payment-proof"
    status: pending
  - id: edge-reconcile-trip
    content: "Fase 4: Edge Function reconcile-trip — consultar view, fechar trip financeiramente, gerar recibo"
    status: pending
  - id: types-hooks
    content: "Fase 5: Atualizar types.ts, financial.ts. Criar hooks useTrips, usePaymentProofs, useReconciliation. Persistir driver_id em OrderForm/useOrders"
    status: pending
  - id: ui-cards-toggle
    content: "Fase 6: UI — chip Trip no FinancialCard, toggle Por OS/Por Trip no Financial.tsx, secao comprovantes no OrderDetailModal, badge conciliacao no CarreteiroTab"
    status: pending
  - id: kanban-view-enrich
    content: "Fase 7: Enriquecer financial_payable_kanban view com trip_id/trip_number"
    status: pending
isProject: false
---

# Implementacao do PRD: Trips - Agrupamento de OS + Rateio + Conciliacao

## Decisoes Finais (validadas contra o codebase)

- **Tipos de documento**: usar `adiantamento_carreteiro` e `saldo_carreteiro` (ja existem no enum `document_type`)
- `**driver_id` em orders**: adicionar coluna FK para `drivers(id)` nesta migration
- **Evento de comprovante**: reutilizar o evento `document.uploaded` existente (trigger `emit_document_uploaded_event` ja dispara em todo INSERT em `documents`) — filtrar no handler do `workflow-orchestrator`
- **FK pattern**: usar `auth.users(id)` (padrao das migrations existentes)
- **Tolerancia**: R$ 1,00
- **Rateio**: `revenue` (orders.value)
- **1 OS na trip**: 100% dos custos TRIP ficam na unica OS (sem redistribuicao)

---

## Fase 1: Migration SQL

Arquivo: `supabase/migrations/20260301000000_trips_payment_proofs.sql`

### 1.1 Adicionar `driver_id` em `orders`

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id);
CREATE INDEX IF NOT EXISTS ix_orders_driver_id ON public.orders(driver_id);
```

O [OrderForm.tsx](src/components/forms/OrderForm.tsx) ja seleciona um driver do cadastro (linha 132-143) mas nao persiste o `id` (linha 167). Atualizar o form para salvar `driver_id` junto com os snapshots.

### 1.2 Criar `trips`

Separar `status_operational` e `financial_status` conforme PRD. Incluir `closed_at`/`closed_by` para audit trail.

```sql
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_number TEXT NOT NULL UNIQUE,
  vehicle_plate TEXT NOT NULL,
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  vehicle_type_id UUID REFERENCES public.vehicle_types(id),
  departure_at TIMESTAMPTZ,
  status_operational TEXT NOT NULL DEFAULT 'aberta'
    CHECK (status_operational IN ('aberta','em_transito','finalizada','cancelada')),
  financial_status TEXT NOT NULL DEFAULT 'open'
    CHECK (financial_status IN ('open','closing','closed')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id)
);
```

Indices: `(vehicle_plate, driver_id, status_operational)` e `(financial_status)`.

### 1.3 Adicionar `trip_id` em `orders` e `documents`

```sql
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES public.trips(id);
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES public.trips(id);
```

### 1.4 Criar `trip_orders`

Tabela de juncao com fatores de rateio. Constraint UNIQUE `(trip_id, order_id)`.

### 1.5 Criar `trip_cost_items`

Com campos `is_frozen`, `manually_edited_at`, `manually_edited_by`. Constraint `ck_scope_order_consistency`:

- `scope='TRIP'` => `order_id IS NULL`
- `scope='OS'` => `order_id IS NOT NULL`

Categorias incluem `vpo_pedagio` (separado de `pedagio` para nao contaminar conciliacao).
Source inclui `xml` para futuro import de NF-e.

Indice parcial: `(trip_id, scope)`.

### 1.6 Criar `payment_proofs`

```sql
CREATE TABLE IF NOT EXISTS public.payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  proof_type TEXT NOT NULL CHECK (proof_type IN ('adiantamento','saldo','outros')),
  method TEXT CHECK (method IN ('pix','boleto','outro')),
  amount NUMERIC,
  paid_at TIMESTAMPTZ,
  transaction_id TEXT,
  payee_name TEXT,
  payee_document TEXT,
  extracted_fields JSONB NOT NULL DEFAULT '{}'::JSONB,
  extraction_confidence NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','matched','mismatch')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id)
);
```

Mapeamento: `adiantamento_carreteiro` => `proof_type='adiantamento'`, `saldo_carreteiro` => `proof_type='saldo'`.

### 1.7 Criar views de conciliacao

`**v_order_payment_reconciliation**`: junta `orders` com `payment_proofs`, calcula `expected_amount` (carreteiro_real), `paid_amount`, `delta_amount`, `is_reconciled` (abs(delta) <= 1). Adiciona `has_expected_value` (carreteiro_real > 0) para filtrar OS sem valor esperado.

`**v_trip_payment_reconciliation**`: agrega por trip usando a view de OS. Campos: `trip_reconciled = all_orders_reconciled AND abs(delta_trip) <= 1`.

### 1.8 RPC `generate_trip_number`

```sql
CREATE OR REPLACE FUNCTION public.generate_trip_number()
RETURNS TEXT AS $$
  SELECT 'VG-' || to_char(now(), 'YYYY-MM-') ||
    lpad((coalesce(max(substring(trip_number from 'VG-\d{4}-\d{2}-(\d+)')::int), 0) + 1)::text, 4, '0')
  FROM public.trips
  WHERE trip_number LIKE 'VG-' || to_char(now(), 'YYYY-MM-') || '%';
$$ LANGUAGE sql;
```

### 1.9 RLS

Policies para `trips`, `trip_orders`, `trip_cost_items`, `payment_proofs` — mesma logica das tabelas existentes (authenticated users da Vectra).

---

## Fase 2: Edge Function `process-payment-proof`

Arquivo: `supabase/functions/process-payment-proof/index.ts`

**Fluxo:**

1. Recebe `{ documentId: string }`
2. Busca `documents` por id — valida `type IN ('adiantamento_carreteiro','saldo_carreteiro')` e `order_id IS NOT NULL`
3. Busca `orders` para pegar `trip_id`
4. Mapeia tipo: `adiantamento_carreteiro` => `adiantamento`, `saldo_carreteiro` => `saldo`
5. Placeholder de extracao (v1): grava `status='pending'`, `amount=null` — preenchimento manual depois
6. Upsert em `payment_proofs` por `document_id` (ON CONFLICT UPDATE)
7. Retorna `{ success, paymentProofId, extracted }`

**Autenticacao**: Bearer token via `getUser()` ou service role se disparado internamente.

---

## Fase 3: Atualizar `workflow-orchestrator`

Arquivo: [supabase/functions/workflow-orchestrator/index.ts](supabase/functions/workflow-orchestrator/index.ts)

Na funcao `handleDocumentUploaded` (linha 469), adicionar filtro:

```typescript
if (['adiantamento_carreteiro', 'saldo_carreteiro'].includes(payload.type)) {
  // Chamar process-payment-proof via fetch interno
  await fetch(`${supabaseUrl}/functions/v1/process-payment-proof`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId: event.entity_id }),
  });
  actions.push('payment_proof_processing_triggered');
}
```

Reutiliza o trigger existente `emit_document_uploaded_event` — sem criar novo evento.

---

## Fase 4: Edge Function / RPC `reconcile-trip`

Arquivo: `supabase/functions/reconcile-trip/index.ts` (ou RPC SQL)

**Fluxo:**

1. Input: `tripId`
2. Consulta `v_trip_payment_reconciliation`
3. Se `trip_reconciled=true` E `trips.status_operational='finalizada'`:
  - Set `financial_status='closed'`, `closed_at=now()`, `closed_by=user`
  - Gerar recibo HTML simples e anexar em `documents` com `trip_id`
4. Senao: set `financial_status='closing'`, retornar delta

---

## Fase 5: Frontend — Types e Hooks

### 5.1 Atualizar types

- [src/integrations/supabase/types.ts](src/integrations/supabase/types.ts) — adicionar tipos para `trips`, `trip_orders`, `trip_cost_items`, `payment_proofs`. Adicionar `driver_id` e `trip_id` em `orders`.
- [src/types/financial.ts](src/types/financial.ts) — adicionar `trip_id`, `trip_number` ao `FinancialKanbanRow`.

### 5.2 Novos hooks

- `src/hooks/useTrips.ts` — CRUD de trips, `useTripsForOrder`, `useTripSuggestion(vehiclePlate, driverId)`
- `src/hooks/usePaymentProofs.ts` — buscar proofs por order/trip, chamar `process-payment-proof`
- `src/hooks/useReconciliation.ts` — consultar views `v_order_payment_reconciliation` e `v_trip_payment_reconciliation`

### 5.3 Atualizar [OrderForm.tsx](src/components/forms/OrderForm.tsx)

Linha 167: remover comentario e persistir `driver_id` no insert/update. O `handleDriverSelect` (linha 132) ja faz `form.setValue('driver_id', driverId)` — basta incluir no payload de submissao (linha ~165).

---

## Fase 6: Frontend — UI Minima

### 6.1 Card Financeiro

[src/components/financial/FinancialCard.tsx](src/components/financial/FinancialCard.tsx) — adicionar chip "Trip VG-..." com icone Truck quando `row.trip_id` presente. Adicionar badge de status de conciliacao (OK/Pendente/Divergente) usando `v_order_payment_reconciliation`.

### 6.2 Board Financeiro — Toggle

[src/pages/Financial.tsx](src/pages/Financial.tsx) — adicionar toggle "Por OS / Por Trip" na aba PAG. No modo Trip, listar trips agrupadas com `expected_amount`, `paid_amount`, `delta_amount`, `trip_reconciled`.

### 6.3 Modal OS — Comprovantes

[src/components/modals/OrderDetailModal.tsx](src/components/modals/OrderDetailModal.tsx) — na tab existente "documents", apos upload de `adiantamento_carreteiro`/`saldo_carreteiro`, chamar `process-payment-proof` em background. Adicionar secao resumo: esperado vs pago vs delta.

### 6.4 CarreteiroTab — Integracao

[src/components/modals/CarreteiroTab.tsx](src/components/modals/CarreteiroTab.tsx) — adicionar badge de trip vinculada. Exibir status de conciliacao (proofs count, paid amount, delta).

### 6.5 DocumentUpload — Tipo carrier

[src/components/documents/DocumentUpload.tsx](src/components/documents/DocumentUpload.tsx) — `CARRIER_PAYMENT_DOCUMENT_TYPES` (linha 106) ja tem `adiantamento_carreteiro` e `saldo_carreteiro`. Sem mudanca necessaria.

---

## Fase 7: Views Kanban (enriquecer)

Atualizar a view `financial_payable_kanban` em [20260226130000_carrier_payment_columns.sql](supabase/migrations/20260226130000_carrier_payment_columns.sql) (ou nova migration) para incluir `o.trip_id` e join com `trips(trip_number)`.

---

## Arquivos a criar/alterar

**Criar:**

- `supabase/migrations/20260301000000_trips_payment_proofs.sql`
- `supabase/functions/process-payment-proof/index.ts`
- `supabase/functions/reconcile-trip/index.ts`
- `src/hooks/useTrips.ts`
- `src/hooks/usePaymentProofs.ts`
- `src/hooks/useReconciliation.ts`

**Alterar:**

- `src/integrations/supabase/types.ts` (novos tipos)
- `src/types/financial.ts` (trip_id, trip_number)
- `src/components/forms/OrderForm.tsx` (persistir driver_id)
- `src/hooks/useOrders.tsx` (driver_id no insert)
- `src/components/financial/FinancialCard.tsx` (chip trip + badge conciliacao)
- `src/pages/Financial.tsx` (toggle Por OS / Por Trip)
- `src/components/modals/OrderDetailModal.tsx` (secao comprovantes)
- `src/components/modals/CarreteiroTab.tsx` (badge trip + conciliacao)
- `supabase/functions/workflow-orchestrator/index.ts` (handler payment proof)

---

## Nao implementar (v1)

- Auto-grouping (apenas sugestao UI)
- PAG por Trip (permanece 1:1 por OS)
- Integracao Webrouter/Ailog (VPO)
- OCR real (placeholder com status='pending')

