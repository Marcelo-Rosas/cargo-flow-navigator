# 🤖 IA WORKFLOWS DISCOVERY - CARGO FLOW NAVIGATOR

## Visão Geral

Sistema de automação inteligente para **cotações** que reduz intervenção manual e aumenta velocidade. 3 workflows principais + 1 auxiliar.

---

## WORKFLOW 1: Auto-Approval (Baixo Risco)

### Objetivo
Aprovar automaticamente cotações que atendem critérios de baixo risco (compliance, margem, histórico).

### Trigger
```
Event: quote.created OR quote.updated
Condition: status = 'pending_approval' AND risk_score < 30
```

### Fluxo de Lógica
```
1. Quote criada/atualizada
   ↓
2. [evaluate-risk-worker] → calcula risk_score
   - Valida ANTT compliance
   - Verifica margem > 15%
   - Valida cliente histórico (sem devedores)
   ↓
3. If risk_score < 30:
   ├─ status → 'approved'
   ├─ approved_by → 'system:ai'
   ├─ approved_at → NOW()
   └─ Emit: quote.auto_approved
4. Else:
   ├─ status → 'pending_approval' (mantém)
   ├─ flag_for_review → true
   └─ Emit: quote.needs_review
```

### Input (Database Trigger)
```sql
-- supabase/functions/auto-approval-worker/index.ts
CREATE TRIGGER on quotes
AFTER INSERT OR UPDATE
FOR EACH ROW
WHEN (NEW.status = 'pending_approval')
EXECUTE FUNCTION http_post_to_edge_function(
  'auto-approval-worker',
  json_build_object(
    'quote_id', NEW.id,
    'risk_score', NEW.risk_score,
    'margin_percentage', ((NEW.price - NEW.cost) / NEW.cost * 100),
    'client_id', NEW.client_id,
    'shipper_id', NEW.shipper_id
  )
);
```

### Output
```typescript
// Response
{
  "success": true,
  "quote_id": "uuid-123",
  "action": "auto_approved" | "flagged_for_review",
  "reason": "Low risk score + healthy margin",
  "risk_details": {
    "antt_compliant": true,
    "margin_percentage": 22.5,
    "client_health": "excellent",
    "route_risk": "low"
  },
  "timestamp": "2026-04-15T10:30:00Z"
}
```

### Implementação (Supabase Edge Function)
```typescript
// supabase/functions/auto-approval-worker/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
  const { quote_id, risk_score, margin_percentage, client_id } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Validações
  const shouldAutoApprove = 
    risk_score < 30 && 
    margin_percentage > 15 &&
    await isClientHealthy(supabase, client_id);

  if (shouldAutoApprove) {
    // Atualizar quote
    await supabase
      .from('quotes')
      .update({
        status: 'approved',
        approved_by: 'system:ai',
        approved_at: new Date().toISOString(),
      })
      .eq('id', quote_id);

    // Emitir evento para próximo worker
    await supabase.functions.invoke('order-creation-worker', {
      body: { quote_id, auto_created: true }
    });

    return new Response(
      JSON.stringify({ success: true, action: 'auto_approved' }),
      { status: 200 }
    );
  }

  return new Response(
    JSON.stringify({ success: true, action: 'flagged_for_review' }),
    { status: 200 }
  );
});
```

### Regras de Negócio

| Critério | Condição | Peso |
|----------|----------|------|
| Risk Score | < 30 | Obrigatório |
| Margem | > 15% | Obrigatório |
| Cliente | Sem histórico de atraso | Obrigatório |
| ANTT | Compliant | Obrigatório |
| Rota | Sem embargos/restrições | Obrigatório |

---

## WORKFLOW 2: Auto-Order Creation

### Objetivo
Criar ordem operacional automaticamente após aprovação (manual ou IA).

### Trigger
```
Event: quote.auto_approved OR quote.manually_approved
Condition: status = 'approved' AND 24h > created_at
```

### Fluxo de Lógica
```
1. Quote aprovada (auto ou manual)
   ↓
2. Wait 24h (permite rejeição manual)
   ↓
3. If status still = 'approved':
   ├─ Criar order_trips (registro)
   ├─ Sugerir motorista [driver-suggestion-worker]
   ├─ Se motorista disponível:
   │  ├─ Auto-assign
   │  └─ Send WhatsApp: "Novo frete: origem → destino, R$ XX"
   └─ Se motorista não disponível:
      ├─ Mark as 'pending_driver_assignment'
      └─ Notify dispatcher

4. Emit: order.created (webhook)
```

### Input
```json
{
  "quote_id": "uuid-123",
  "auto_created": true,
  "wait_time_hours": 24,
  "approved_at": "2026-04-15T10:30:00Z"
}
```

### Output
```json
{
  "success": true,
  "order_id": "uuid-456",
  "driver_assigned": true,
  "driver_id": "uuid-driver-789",
  "driver_name": "João Silva",
  "driver_phone": "85987654321",
  "notification_sent": true,
  "timestamp": "2026-04-16T10:30:00Z"
}
```

### Implementação
```typescript
// supabase/functions/order-creation-worker/index.ts
serve(async (req: Request) => {
  const { quote_id, auto_created } = await req.json();
  const supabase = createClient(...);

  // 1. Obter dados da cotação
  const { data: quote } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quote_id)
    .single();

  // 2. Criar ordem
  const { data: order } = await supabase
    .from('order_trips')
    .insert({
      quote_id,
      origin_city: quote.origin_city,
      destination_city: quote.destination_city,
      status: 'pending_driver_assignment',
      auto_created: auto_created,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  // 3. Sugerir motorista
  const driver = await suggestBestDriver(supabase, quote);

  if (driver) {
    // Auto-assign
    await supabase
      .from('order_trips')
      .update({ driver_id: driver.id, status: 'assigned' })
      .eq('id', order.id);

    // Enviar WhatsApp
    await supabase.functions.invoke('notification-hub', {
      body: {
        type: 'whatsapp',
        phone: driver.phone,
        message: `🚚 Novo frete!\nOrigem: ${quote.origin_city}\nDestino: ${quote.destination_city}\nValor: R$ ${(quote.price / 100).toFixed(2)}\n\nAcesse o app para detalhes.`,
      }
    });
  }

  return new Response(JSON.stringify({ success: true, order_id: order.id }));
});
```

---

## WORKFLOW 3: Driver Suggestion (ML)

### Objetivo
Sugerir motorista ideal baseado em: rota, histórico, disponibilidade, rating.

### Lógica de Scoring

```
score = (50 * route_match) + (20 * availability) + (15 * rating) + (10 * margin_profit) + (5 * loyalty)

Onde:
- route_match: % de rotas similares completadas (0-1)
- availability: Is driver available NOW? (0 or 1)
- rating: Average stars (0-5) / 5
- margin_profit: Historical margin on similar routes (0-1)
- loyalty: Years with company (0-1)

Ranking:
1. score > 80: Excellent match ✅
2. score > 60: Good match ⭐
3. score > 40: Acceptable match ⚠️
4. score < 40: Poor match ❌
```

### SQL Query
```sql
SELECT 
  d.id, 
  d.name,
  d.phone,
  d.rating,
  (
    -- Route match: % de rotas similares
    (
      SELECT COUNT(*) 
      FROM trips t 
      WHERE t.driver_id = d.id 
      AND t.origin_city = $origin 
      AND t.destination_city = $destination
      AND t.completed_at > NOW() - INTERVAL '90 days'
    ) * 100.0 / 50 -- Normalize to 50%
  ) AS route_match_score,
  -- Availability (1 if no active trips)
  CASE 
    WHEN COUNT(t.id) = 0 THEN 1 
    ELSE 0 
  END AS availability,
  d.rating / 5.0 AS rating_score
FROM drivers d
LEFT JOIN trips t ON t.driver_id = d.id AND t.status IN ('active', 'in_transit')
WHERE d.status = 'active'
GROUP BY d.id
ORDER BY 
  (route_match_score * 0.5 + availability * 0.2 + rating_score * 0.15) DESC
LIMIT 5;
```

### Output
```json
{
  "suggested_drivers": [
    {
      "rank": 1,
      "driver_id": "uuid-123",
      "name": "João Silva",
      "phone": "85987654321",
      "score": 85.5,
      "reason": "Expert on SP↔RJ route (45 trips), 4.8★, available now",
      "metrics": {
        "route_expertise": 90,
        "availability": 100,
        "rating": 96
      }
    },
    {
      "rank": 2,
      "driver_id": "uuid-456",
      "name": "Maria Santos",
      "score": 72.0,
      "reason": "Good availability, new to this route but 4.6★"
    }
  ]
}
```

---

## WORKFLOW 4: Risk Evaluation (Compliance)

### Objetivo
Calcular risk_score de cada cotação (base para auto-approval).

### Critérios de Risco

```typescript
interface RiskEvaluation {
  score: number; // 0-100
  factors: {
    antt_compliance: boolean;       // ANTT rules OK?
    client_payment_history: 'excellent' | 'good' | 'poor';
    margin_healthy: boolean;        // margin > 15%?
    route_restricted: boolean;      // Embargos ICMS/rotas?
    overweight_risk: boolean;       // Peso OK para equipamento?
  };
}
```

### Cálculo
```typescript
// Risk Score = 100 - (compliance_points + history_points + margin_points + route_points)
// Resultado: 0 (no risk) a 100 (very high risk)

riskScore = 100;

// ANTT Compliance (-30 pontos se compliant)
if (isAnttCompliant(quote)) riskScore -= 30;
else riskScore += 20; // Penalty if non-compliant

// Client History (-20 pontos se excellent)
if (clientHistory === 'excellent') riskScore -= 20;
else if (clientHistory === 'good') riskScore -= 10;
else riskScore += 15; // Penalty for poor

// Margin (-15 pontos se saudável)
if (marginPercentage > 25) riskScore -= 15;
else if (marginPercentage > 15) riskScore -= 10;
else riskScore += 10;

// Route Restrictions (-15 pontos se nenhuma)
const restrictions = checkRouteRestrictions(origin, destination);
if (!restrictions.length) riskScore -= 15;
else riskScore += restrictions.length * 5;

// Normalize
riskScore = Math.max(0, Math.min(100, riskScore));
```

---

## ORCHESTRATOR: Master Workflow

```
┌─────────────────────────────────────────────┐
│ User Creates Quote                          │
│ status = 'draft'                            │
└─────────────────────┬───────────────────────┘
                      │
                      ↓
         ┌────────────────────────┐
         │ User Submits for Review│
         │ status = 'pending'     │
         └──────────┬─────────────┘
                    │
                    ↓
    ┌───────────────────────────────┐
    │ [1] evaluate-risk-worker      │
    │     → calculates risk_score   │
    └──────────┬────────────────────┘
               │
        ┌──────┴──────┐
        │             │
    risk < 30?    risk >= 30?
        │             │
        ↓             ↓
   AUTO-APPROVE  FLAG FOR REVIEW
        │             │
        ├─────────────┤
        │             │
        ↓             ↓
   [2] order-creation-worker  (manual approval required)
        │
        ├─ Create order_trips
        │
        ├─ [3] driver-suggestion-worker
        │     ├─ Suggest best driver
        │     └─ If available: auto-assign
        │
        └─ [notification-hub]
           └─ Send WhatsApp to driver

    24h grace period for rejeição antes de criar ordem
```

---

## EDGE FUNCTIONS A CRIAR (Sprint 2)

| # | Função | Tipo | Trigger | Descrição |
|---|--------|------|---------|-----------|
| 1 | `auto-approval-worker` | Webhook | Quote criada | Avalia risco + aprova se low-risk |
| 2 | `order-creation-worker` | Webhook | Quote aprovada | Cria ordem operacional + assign driver |
| 3 | `driver-suggestion-worker` | Sub-function | Called by #2 | Rank drivers por score |
| 4 | `evaluate-risk-worker` | Sub-function | Called by #1 | Calcula risk_score final |

---

## TESTES (Sprint 2)

### Unit Tests
```typescript
// Evaluate Risk
- ANTT compliant → score -= 30
- Non-compliant → score += 20
- Margin 25% → score -= 15
- All good → score < 30 ✅

// Driver Suggestion
- Route expert available → rank #1
- No availability → rank lower
- Poor history → rank last

// Auto-Approval
- risk_score=20 + margin=25% → APPROVE ✅
- risk_score=40 → FLAG ❌
```

### E2E Tests (Playwright)
```typescript
describe('Quote Automation Flow', () => {
  it('Auto-approves low-risk quote', async () => {
    // 1. Create quote with low risk params
    // 2. Submit for approval
    // 3. Wait 5s for auto-approval
    // 4. Assert: status = 'approved'
    // 5. Assert: approved_by = 'system:ai'
  });

  it('Creates order for approved quote', async () => {
    // 1. Create & auto-approve quote
    // 2. Wait 25h
    // 3. Assert: order_trips created
    // 4. Assert: driver assigned (if available)
    // 5. Assert: WhatsApp sent
  });

  it('Suggests best driver', async () => {
    // 1. Create order
    // 2. Call driver-suggestion-worker
    // 3. Assert: driver with highest score suggested
  });
});
```

---

## MÉTRICAS A MONITORAR (Sprint 3)

```
- Auto-approval rate (% of quotes auto-approved)
- Order creation time (quote → order, minutos)
- Driver acceptance rate (% drivers accept auto-assigned orders)
- False positives (quotes auto-approved but later rejected)
- Error rate (failed automations)
- Cost savings (reduced manual review time)
```

---

## PRÓXIMAS ETAPAS

### Sprint 2 (Maio)
- [ ] Implementar `auto-approval-worker`
- [ ] Implementar `order-creation-worker`
- [ ] Implementar `driver-suggestion-worker`
- [ ] Tests E2E
- [ ] Monitoring setup

### Sprint 3 (Junho)
- [ ] Deploy em produção
- [ ] Monitor metrics
- [ ] Adjust thresholds baseado em data real
- [ ] A/B test: auto-approval vs manual

---

## DEPENDENCIES & RISKS

| Risk | Mitigation |
|------|-----------|
| IA rejeita cotações válidas | Threshold conservador (risk < 30), manual review |
| Motorista não aceita ordem | Fallback: flag para dispatcher manualmente |
| WhatsApp API rate limit | Queue com retry logic, exponential backoff |
| Latência Edge Function | Cache driver suggestions, pre-compute scores |

