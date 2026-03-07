# Banco de Queries SQL — Métricas do Cargo Flow Navigator

> Use estas queries como ponto de partida para construir dashboards no Supabase, Metabase ou outra ferramenta de BI.
> As queries são otimizadas para PostgreSQL.

---

## Métricas L1 (Indicadores de Saúde)

### 1. Novas Cotações Criadas (Semanal)

```sql
-- Retorna o número de cotações criadas nos últimos 7 dias.
SELECT COUNT(*)
FROM quotes
WHERE created_at >= NOW() - INTERVAL '7 days';
```

### 2. Taxa de Conversão (Cotação → OS)

```sql
-- Retorna a % de cotações ganhas em relação ao total de cotações decididas (ganhas + perdidas).
SELECT
  COUNT(*) FILTER (WHERE stage = 'ganho') * 100.0 /
  NULLIF(COUNT(*) FILTER (WHERE stage IN ('ganho', 'perdido')), 0)
FROM quotes;
```

### 3. Ordens de Serviço Ativas

```sql
-- Retorna o número de OS que não estão em um estado terminal (concluída ou cancelada).
SELECT COUNT(*)
FROM orders
WHERE stage NOT IN ('concluida', 'cancelada');
```

### 4. Taxa de Reconciliação de Viagens

```sql
-- Retorna a % de viagens que foram totalmente reconciliadas financeiramente.
SELECT
  COUNT(*) FILTER (WHERE trip_reconciled = true) * 100.0 /
  NULLIF(COUNT(*), 0)
FROM v_trip_payment_reconciliation;
```

### 5. Receita Bruta (GMV) - Faturado e Pago

```sql
-- Retorna a soma dos valores de documentos do tipo FAT (Fatura) que foram pagos.
SELECT SUM(amount)
FROM financial_documents
WHERE type = 'FAT' AND status = 'pago';
```

### 6. Tempo Médio para Reconciliação (em horas)

```sql
-- Retorna o tempo médio em horas entre a finalização operacional de uma viagem e sua reconciliação financeira completa.
SELECT
  AVG(EXTRACT(EPOCH FROM r.last_paid_at - t.closed_at)) / 3600
FROM v_trip_payment_reconciliation r
JOIN trips t ON r.trip_id = t.id
WHERE r.trip_reconciled = true;
```

### 7. Custo Estimado de IA (Semanal)

```sql
-- Retorna o custo total estimado de uso das APIs de IA nos últimos 7 dias.
SELECT SUM(estimated_cost_usd)
FROM ai_usage_tracking
WHERE created_at >= NOW() - INTERVAL '7 days';
```

---

## Métricas L2 (Diagnóstico)

### 1. Funil de Cotação

```sql
-- Retorna a contagem de cotações em cada estágio do funil.
SELECT
  stage,
  COUNT(*) as count
FROM quotes
GROUP BY stage
ORDER BY
  CASE stage
    WHEN 'rascunho' THEN 1
    WHEN 'enviado' THEN 2
    WHEN 'negociacao' THEN 3
    WHEN 'ganho' THEN 4
    WHEN 'perdido' THEN 5
    ELSE 6
  END;
```

### 2. Uso de IA por Tipo de Análise

```sql
-- Retorna a contagem de chamadas e o custo total por tipo de análise de IA.
SELECT
  analysis_type,
  COUNT(*) as call_count,
  SUM(estimated_cost_usd) as total_cost
FROM ai_usage_tracking
GROUP BY analysis_type
ORDER BY call_count DESC;
```

### 3. Análise de Divergência (Cotação vs OS)

```sql
-- Retorna a divergência média de valor e a margem de lucro prevista para cotações convertidas em OS.
SELECT
  AVG(delta_value) as avg_delta_value,
  AVG(margem_percent_prevista) as avg_profit_margin
FROM v_quote_order_divergence;
```

### 4. Saúde do Compliance de Motoristas

```sql
-- Retorna a taxa de aprovação nas qualificações de motoristas.
SELECT
  status,
  COUNT(*) as count
FROM driver_qualifications
GROUP BY status;
```

### 5. Performance de Eventos do Workflow

```sql
-- Retorna a contagem de eventos por tipo e status, para identificar gargalos ou falhas.
SELECT
  event_type,
  status,
  COUNT(*) as count
FROM workflow_events
GROUP BY event_type, status
ORDER BY event_type, status;
```
