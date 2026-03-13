---
document: Audit Trail Spec
plan: plan-04-risk-workflow-memoria-calculo-risco-seguro
version: v0.1.0
created_at: 2026-03-07
---

# Audit Trail — Gate de Risco + Trilha Auditavel

## 1. Principio

Toda decisao de risco deve ser **rastreavel**: quem avaliou, quando, com base em que dados, qual resultado, e quem aprovou. A trilha serve para:
- Compliance com apolice (seguradora pode auditar)
- Responsabilizacao interna (quem liberou a coleta?)
- Defesa em sinistros (provar que GR foi feito)

---

## 2. Pontos de auditoria

### 2.1 Eventos rastreados

| Evento | Quem registra | Onde persiste | Dados gravados |
|--------|--------------|---------------|----------------|
| Avaliacao criada | Sistema (trigger stage) | `risk_evaluations` | entity_type, entity_id, criticality, requirements |
| Buonny consultado | Usuario (wizard step 1) | `risk_evidence` | consulta_id, status, validade, payload completo |
| Evidencia adicionada | Usuario (wizard step 3) | `risk_evidence` | evidence_type, document_id, payload |
| Monitoramento ativado | Usuario (wizard step 3) | `risk_evidence` | buonny_monitoramento_id, status |
| Avaliacao enviada | Usuario (wizard step 4) | `risk_evaluations` + `approval_requests` | status='evaluated', approval_request_id |
| Auto-aprovacao | Sistema | `approval_requests` | status='approved', decided_by='system', decision_notes |
| Aprovacao manual | Admin (menu Aprovacoes) | `approval_requests` | status='approved/rejected', decided_by, decision_notes, decided_at |
| Gate liberado | Sistema (validate_transition) | `orders` stage change log | new_stage='coleta_realizada' |
| VG avaliacao consolidada | Sistema | `risk_evaluations` (entity_type='trip') | criticality, total_cargo_value |

### 2.2 Campos de auditoria em cada tabela

#### `risk_evaluations`
```
id, entity_type, entity_id, policy_id,
criticality, status,
cargo_value_evaluated,
requirements (JSONB array),
requirements_met (JSONB object),
route_municipalities (TEXT array),
policy_rules_applied (UUID array),
evaluation_notes (TEXT),
evaluated_by (UUID → auth.users),
evaluated_at (TIMESTAMPTZ),
approval_request_id (UUID),
created_at, updated_at
```

#### `risk_evidence`
```
id, evaluation_id,
evidence_type,       -- 'buonny_check' | 'document' | 'route_analysis' | 'manual_note'
document_id,         -- link para documents table
payload (JSONB),     -- dados completos (resposta Buonny, analise de rota, etc)
status,              -- 'valid' | 'expired' | 'rejected'
expires_at,          -- para Buonny: now + 90 days
notes,
created_by (UUID),
created_at
```

#### `approval_requests` (existente — campos relevantes)
```
id, entity_type, entity_id,
approval_type = 'risk_gate',
status,
requested_by,
assigned_to, assigned_to_role,
title, description,
ai_analysis (JSONB — inclui criticality, requirements_met, cargo_value),
decision_notes,
decided_by, decided_at,
expires_at,
created_at, updated_at
```

---

## 3. Gate `documentacao -> coleta_realizada`

### 3.1 Fluxo completo

```
                    Wizard completo
                         │
                         ▼
               ┌─────────────────────┐
               │  evaluate-risk      │
               │  (Edge function)    │
               └──────────┬──────────┘
                          │
                    ┌─────┴─────┐
                    │           │
              LOW/MEDIUM    HIGH/CRITICAL
              + all met     │
                    │       │
                    ▼       ▼
              Auto-approve  Create approval_request
              (system)      (pending, assigned to admin)
                    │       │
                    │       ▼
                    │  Admin reviews in
                    │  Aprovacoes menu
                    │       │
                    │  ┌────┴────┐
                    │  │        │
                    │  Approve  Reject
                    │  │        │
                    ▼  ▼        ▼
              risk_evaluation   risk_evaluation
              status='approved' status='rejected'
                    │                │
                    ▼                ▼
              validate_transition   Wizard: estado 'rejected'
              ALLOWS               Usuario pode corrigir
              doc→coleta           e reenviar
```

### 3.2 validate_transition — logica atualizada

```sql
-- Dentro de validate_transition RPC
-- Contexto: p_order_id, p_current_stage, p_target_stage

IF p_target_stage = 'coleta_realizada' THEN

  -- 1. Checar se existe avaliacao de risco aprovada
  SELECT status INTO v_risk_status
  FROM risk_evaluations
  WHERE entity_type = 'order'
    AND entity_id = p_order_id
    AND status NOT IN ('expired', 'rejected')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_risk_status IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Avaliacao de risco nao iniciada',
      'action_required', 'risk_evaluation'
    );
  END IF;

  IF v_risk_status != 'approved' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Avaliacao de risco pendente de aprovacao',
      'action_required', 'risk_approval'
    );
  END IF;

  -- 2. Se OS esta em trip, checar risco da trip
  SELECT trip_id INTO v_trip_id FROM orders WHERE id = p_order_id;

  IF v_trip_id IS NOT NULL THEN
    SELECT status INTO v_trip_risk_status
    FROM risk_evaluations
    WHERE entity_type = 'trip'
      AND entity_id = v_trip_id
      AND status NOT IN ('expired', 'rejected')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_trip_risk_status IS NULL OR v_trip_risk_status != 'approved' THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Avaliacao de risco da viagem pendente',
        'action_required', 'trip_risk_approval',
        'trip_id', v_trip_id
      );
    END IF;
  END IF;

  -- 3. Checar validade da consulta Buonny
  IF NOT EXISTS (
    SELECT 1 FROM risk_evidence rev
    JOIN risk_evaluations re ON re.id = rev.evaluation_id
    WHERE re.entity_type = 'order'
      AND re.entity_id = p_order_id
      AND rev.evidence_type = 'buonny_check'
      AND rev.status = 'valid'
      AND rev.expires_at > now()
  ) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Consulta Buonny expirada ou inexistente',
      'action_required', 'buonny_recheck'
    );
  END IF;

END IF;

-- Se passou tudo, permitir transicao
RETURN jsonb_build_object('allowed', true);
```

### 3.3 Bloqueio visual na UI

Quando `validate_transition` retorna `allowed = false`:

```
+----------------------------------------------------------+
| ⛔ Transicao bloqueada                                    |
|                                                          |
| Motivo: Avaliacao de risco pendente de aprovacao          |
|                                                          |
| [Ir para Avaliacao de Risco →]                           |
+----------------------------------------------------------+
```

- Botao de transicao de stage fica desabilitado
- Tooltip mostra o `reason`
- Link direto para o wizard ou menu de aprovacoes

---

## 4. Gate VG — logica de trip

### 4.1 Regras

1. **Cada OS da trip** deve ter `risk_evaluation.status = 'approved'`
2. **A trip** deve ter `risk_evaluation.status = 'approved'` (avaliacao consolidada)
3. **Qualquer OS** pode ser bloqueada individualmente ate seu risco ser aprovado
4. **Transicao de qualquer OS** para `coleta_realizada` verifica:
   - Risco da OS aprovado
   - Risco da trip aprovado
   - Buonny valido para a OS

### 4.2 Acao ao adicionar OS a trip

```
WHEN order is linked to trip (useLinkOrderToTrip):
  1. Recalcular risk_evaluation da trip:
     - Somar cargo_value de todas as OS
     - Reavaliar criticidade consolidada
     - Atualizar requirements
  2. Se criticidade da trip AUMENTOU:
     - Invalidar aprovacao anterior da trip (se existia)
     - Notificar operacao
```

### 4.3 Acao ao remover OS da trip

```
WHEN order is unlinked from trip:
  1. Recalcular risk_evaluation da trip (sem a OS removida)
  2. Se criticidade da trip DIMINUIU:
     - Manter aprovacao existente (nao invalida)
     - Atualizar metadata
```

---

## 5. Payload do approval_request (risk_gate)

### 5.1 Estrutura do `ai_analysis` (JSONB)

```typescript
interface RiskGateApprovalAnalysis {
  // Criticidade
  risk: 'baixo' | 'medio' | 'alto' | 'critico';
  criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  // Dados da avaliacao
  cargo_value: number;
  km_distance: number;
  route_label: string;
  route_municipalities: string[];

  // Status Buonny
  buonny_status: 'aprovado' | 'reprovado' | 'em_analise' | 'nao_consultado';
  buonny_validade: string; // ISO date
  buonny_cadastro: boolean;
  buonny_monitoramento: boolean;

  // Exigencias
  requirements: string[];
  requirements_met: Record<string, boolean>;
  all_requirements_met: boolean;

  // Custos
  estimated_risk_cost: number;
  risk_cost_breakdown: Array<{
    service: string;
    cost: number;
  }>;

  // VG (se aplicavel)
  trip_id?: string;
  trip_number?: string;
  trip_total_cargo_value?: number;
  trip_order_count?: number;
  trip_criticality?: string;

  // Recomendacao
  recommendation: 'approve' | 'review' | 'reject';
  summary: string;

  // Metricas financeiras
  metrics: {
    repasse_risco: number;      // GRIS + TSO + RCTR-C (receita)
    custo_real_risco: number;   // Buonny + seguro
    margem_risco: number;       // repasse - custo real
  };
}
```

### 5.2 Exemplo real

```json
{
  "risk": "alto",
  "criticality": "HIGH",
  "cargo_value": 180000,
  "km_distance": 1200,
  "route_label": "SC→SP",
  "route_municipalities": ["Joinville", "Curitiba", "Registro", "Guarulhos"],
  "buonny_status": "aprovado",
  "buonny_validade": "2026-06-15T00:00:00Z",
  "buonny_cadastro": true,
  "buonny_monitoramento": true,
  "requirements": ["buonny_consulta", "buonny_cadastro", "monitoramento", "gr_doc", "rota_doc"],
  "requirements_met": {
    "buonny_consulta": true,
    "buonny_cadastro": true,
    "monitoramento": true,
    "gr_doc": true,
    "rota_doc": true
  },
  "all_requirements_met": true,
  "estimated_risk_cost": 308.64,
  "risk_cost_breakdown": [
    { "service": "Buonny Consulta", "cost": 13.76 },
    { "service": "Buonny Cadastro", "cost": 42.10 },
    { "service": "Buonny Monitoramento", "cost": 252.78 }
  ],
  "recommendation": "approve",
  "summary": "Carga de alto valor (R$ 180k) em rota interestadual SC-SP. Buonny aprovado com monitoramento ativo. Todas as exigencias atendidas.",
  "metrics": {
    "repasse_risco": 1350.00,
    "custo_real_risco": 308.64,
    "margem_risco": 1041.36
  }
}
```

---

## 6. Consulta de historico

### 6.1 Queries para auditoria

```sql
-- Todas as avaliacoes de uma OS com evidencias
SELECT re.*, json_agg(rev.*) as evidences
FROM risk_evaluations re
LEFT JOIN risk_evidence rev ON rev.evaluation_id = re.id
WHERE re.entity_type = 'order' AND re.entity_id = :order_id
GROUP BY re.id
ORDER BY re.created_at DESC;

-- Timeline completa de uma avaliacao
SELECT
  'evaluation_created' as event, re.created_at as timestamp, null as user_id
FROM risk_evaluations re WHERE re.id = :eval_id
UNION ALL
SELECT
  'evidence_' || rev.evidence_type, rev.created_at, rev.created_by
FROM risk_evidence rev WHERE rev.evaluation_id = :eval_id
UNION ALL
SELECT
  'approval_' || ar.status, COALESCE(ar.decided_at, ar.created_at), COALESCE(ar.decided_by, ar.requested_by)
FROM approval_requests ar WHERE ar.id = (
  SELECT approval_request_id FROM risk_evaluations WHERE id = :eval_id
)
ORDER BY timestamp;
```

### 6.2 Retencao

- `risk_evaluations`: **permanente** (compliance)
- `risk_evidence`: **permanente** (payload Buonny e documentos sao prova)
- `approval_requests`: **permanente** (ja definido no sistema)
- `risk_costs`: **permanente** (financeiro)

---

## 7. Cenarios de edge case

| Cenario | Comportamento | Justificativa |
|---------|-------------|---------------|
| OS sem motorista atribuido | Wizard step 1 desabilitado; pode avaliar criticidade (step 2) | Buonny precisa de CPF/placa |
| Motorista muda depois de aprovacao | Invalidar avaliacao; exigir nova consulta Buonny | Novo motorista = novo risco |
| Cargo value muda depois de aprovacao | Reavaliar criticidade; se subiu, invalidar aprovacao | Faixa pode mudar |
| OS removida de trip depois de aprovacao VG | Manter aprovacao da OS; reavaliar trip | Trip pode ter criticidade menor |
| Buonny fora do ar | Modo degradado: aprovacao manual com nota "Buonny indisponivel" | Operacao nao pode parar |
| Avaliacao expira (> 90 dias sem coleta) | Status vira 'expired'; exigir reavaliacao | Consulta Buonny expira |
| Admin rejeita avaliacao | Wizard volta para estado 'rejected'; usuario corrige e reenvia | Fluxo iterativo |
| Multiplas rejeicoes | Todas registradas na trilha; sem limite de tentativas | Auditoria completa |
