# Análise do Dashboard — Cargo Flow Navigator
**Data:** 2026-02-26
**Escopo:** Ordens Recentes · Alertas Críticos · Performance do Mês · Custo por Rota · Exportar Relatórios · Notificações · Atividade do Sistema · Uso da AI · Top Clientes · Distribuição por Estágio · Resumo de Documentação

---

## 1. Dados Mockados — REMOVER

### 🔴 CRÍTICO — AlertsWidget: 3 alertas 100% fake

**Arquivo:** `src/components/dashboard/AlertsWidget.tsx` linhas 24–49

```typescript
const mockAlerts: Alert[] = [
  { id: '1', type: 'critical', title: 'Documento Vencido',
    description: 'CT-e da OS-2024-0002 pendente há 48h', time: 'Agora' },
  { id: '2', type: 'warning', title: 'Atraso na Entrega',
    description: 'OS-2024-0003 com 2h de atraso previsto', time: '15min' },
  { id: '3', type: 'info', title: 'Comprovante Pendente',
    description: 'POD da OS-2024-0001 aguardando upload', time: '1h' },
];
```

**Uso:** O prop `alerts` nunca é passado por nenhum componente pai:
- `OperationsTab.tsx` linha 51: `<AlertsWidget />` (sem props)
- `OverviewTab.tsx` linha 72: `<AlertsWidget />` (sem props)

**Resultado:** Usuários sempre veem os mesmos 3 alertas estáticos. Números de OS inventados.

**Correção:** Criar hook `useActiveAlerts()` buscando ocorrências críticas (`occurrences` com `severity = 'critical'` e `status != 'resolved'`) e documentos vencidos/pendentes (`order_documents` com `status = 'pending'` e data > X dias).

---

### 🔴 ALTO — avgDeliveryTime hardcoded: sempre 3,5 dias

**Arquivo:** `src/hooks/useAdvancedDashboardStats.tsx` linha 243

```typescript
avgDeliveryTime: 3.5, // Placeholder - would need delivery date tracking
```

Exibido em `PerformanceCards.tsx` linha 142 sem qualquer indicação de que é fictício.

**Correção:** Calcular `AVG(delivered_at - created_at)` nas ordens com `stage = 'entregue'` nos últimos 30 dias.

---

### 🟡 MÉDIO — Fallbacks com meses hardcoded em português

**Arquivo:** `src/pages/Dashboard.tsx` linhas 50–56

```typescript
const emptyConversionData = [
  { name: 'Jan', value: 0 },
  { name: 'Fev', value: 0 },
  { name: 'Mar', value: 0 },
];
const emptyRevenueData = [{ name: 'Sem dados', value: 0 }];
```

Funciona como fallback vazio, mas os nomes de mês são estáticos. Aceitável, mas pouco profissional para uma tela em branco.

---

## 2. Erros de Lógica

### 🔴 CRÍTICO — `toLocaleDateString()` ignora `hour`/`minute`

**Arquivo:** `src/components/dashboard/AiInsightsWidget.tsx` linhas 305–314

```typescript
new Date(createdAt).toLocaleDateString('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',   // ← IGNORADO por toLocaleDateString
  minute: '2-digit', // ← IGNORADO por toLocaleDateString
})
```

`toLocaleDateString` ignora `hour` e `minute`. O timestamp de insights sempre mostra só a data, nunca a hora.

**Correção:** Trocar por `toLocaleString('pt-BR', { ... })`.

---

### 🟡 MÉDIO — conversionTrend usa diferença absoluta, não variação relativa

**Arquivo:** `src/hooks/useDashboardStats.tsx` linhas 104–115

```typescript
const conversionChange = currentConversionRate - lastConversionRate;
conversionTrend = {
  value: Math.abs(Math.round(conversionChange)),
  isPositive: conversionChange >= 0,
};
```

Se a conversão caiu de 50% → 25%, exibe `value: 25` quando deveria exibir `-50%` (queda de 50%). O número parece menor do que é.

**Correção:**
```typescript
const conversionChange = lastConversionRate > 0
  ? ((currentConversionRate - lastConversionRate) / lastConversionRate) * 100
  : 0;
```

---

### 🟡 MÉDIO — Mapeamento de Edge Functions incompleto

**Arquivo:** `src/hooks/useAiInsights.ts` linha 119

```typescript
const fnName =
  analysisType === 'operational_insights'
    ? 'ai-operational-agent'
    : 'ai-financial-agent';
```

Qualquer `analysisType` que não seja `'operational_insights'` vai para `ai-financial-agent`. Isso inclui tipos que não pertencem ao agente financeiro. Com a arquitetura P3, existe agora `ai-operational-orchestrator` — o mapeamento deve ser atualizado.

**Erro observado na URL fornecida:**
```
POST https://epgedaiukjippepujuzc.supabase.co/functions/v1/ai-financial-agent
Body: { analysisType: "dashboard_insights", entityId: "", entityType: "" }
Response: { "code": 401, "message": "Invalid JWT" }
```

O 401 indica que o token não está sendo passado corretamente nesta chamada específica, ou o token expirou. O hook `useRequestAiAnalysis` busca a sessão na hora da chamada — verificar se o `access_token` está presente antes de invocar.

---

### 🟡 MÉDIO — useDashboardStats sem staleTime: flood de requests

**Arquivo:** `src/hooks/useDashboardStats.tsx` linhas 31–169

```typescript
return useQuery({
  queryKey: ['dashboard-stats'],
  queryFn: async () => { /* ~10 queries paralelas */ },
  // ← SEM staleTime
});
```

Com `staleTime: 0` (padrão), toda navegação que retorna ao Dashboard dispara 10+ queries simultâneas ao Supabase.

**Correção:** Adicionar `staleTime: 60_000` (1 minuto) e `refetchOnWindowFocus: false`.

---

### 🟡 MÉDIO — regex case-insensitive + toUpperCase redundante

**Arquivo:** `src/components/dashboard/AlertsWidget.tsx` linha 79

```typescript
const extractOs = (text: string) => {
  const m = text.match(/OS-\d{4}-\d{4}/i);
  return m ? m[0].toUpperCase() : null;
};
```

O `/i` é desnecessário se sempre fazemos `.toUpperCase()`. Não é bug, mas é confuso.

---

## 3. Problemas de Design/UX

### 🟡 MÉDIO — AutomationActivityFeed sem paginação

**Arquivo:** `src/hooks/useWorkflowEvents.ts` linha 36
**Arquivo:** `src/components/dashboard/AutomationActivityFeed.tsx` linhas 127–128

```typescript
export function useRecentWorkflowEvents(limit = 20) { ... }

<div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
```

Limite fixo de 20 eventos, scroll sem indicador visual, sem botão "ver mais".

---

### 🟡 MÉDIO — Intervalos de atualização dessincronizados

| Hook | refetchInterval |
|------|----------------|
| `useDashboardStats` | nunca (sem definição) |
| `useDashboardInsights` | 5 minutos |
| `useAiUsageStats` | 30 segundos |
| `useRecentWorkflowEvents` | 15 segundos |

O Dashboard mostra KPIs principais desatualizados enquanto o feed de atividade e uso de AI atualizam constantemente — prioridades invertidas.

---

### 🟡 MÉDIO — NtcInsightsTab sem empty state

**Arquivo:** `src/components/dashboard/tabs/NtcInsightsTab.tsx` linha 388

Quando `inctlSeries` está vazio, cards mostram "0" sem contexto. Sem mensagem de "nenhum dado disponível".

---

### 🟢 BAIXO — dois hooks de "performance" com implementações divergentes

`useDashboardStats.tsx` e `useAdvancedDashboardStats.tsx` existem em paralelo. `MonthlyTrendsChart` usa `useAdvancedDashboardStats`, `PerformanceCards` também — mas `useDashboardStats` tem sua própria lógica de conversão que não bate com a de `useAdvancedDashboardStats`.

---

## 4. Erros de Auth / JWT — Análise

### 🔴 O erro 401 relatado

```
URL: /functions/v1/ai-financial-agent
Body: { analysisType: "dashboard_insights", entityId: "", entityType: "" }
Resposta: { "code": 401, "message": "Invalid JWT" }
```

**Causa provável:** O botão/trigger de AI Insights no Dashboard está chamando a Edge Function de uma forma diferente do hook `useRequestAiAnalysis` — possivelmente via `fetch` direto sem o header `Authorization`, ou com token `null`/`undefined`.

O hook `useAiInsights.ts` (linhas 112–125) tem a implementação correta:
```typescript
const { data: sessionData } = await supabase.auth.getSession();
const token = sessionData?.session?.access_token;
if (!token) throw new Error('Sessão expirada.');
await supabase.functions.invoke(fnName, {
  body: { ... },
  headers: { Authorization: `Bearer ${token}` },
});
```

**Verificar:** Se há algum ponto no Dashboard que chama a URL diretamente (não via `supabase.functions.invoke`), o token não é adicionado automaticamente.

---

## 5. Anomalias Diversas

### RPC `get_ai_usage_stats` com fallback silencioso

**Arquivo:** `src/hooks/useAiUsageStats.ts` linha 51

```typescript
const { data, error } = await supabase.rpc('get_ai_usage_stats' as never);
if (error) {
  console.warn('Failed to fetch AI usage stats:', error.message);
  return { daily_spend: 0, monthly_spend: 0, ... }; // Sempre parece sem gasto
}
```

Se o RPC não existir ou falhar, o dashboard mostra gasto = R$ 0,00 sem alertar o usuário.

---

### Inconsistência de cálculo de taxa de conversão

Três implementações diferentes em três lugares:
- `useDashboardStats.tsx` linha 53: `Math.round((wonQuotes / totalQuotes) * 100)`
- `useAdvancedDashboardStats.tsx` linha 174: `Math.round((won / total) * 100)`
- `NtcInsightsTab.tsx`: usa `/100` na hora de exibir

---

## 6. Fluxo de Dados — Mapa Atual

```
Dashboard.tsx
  ├─ useDashboardStats()         → KPIs (Pipeline, Conversão, OS Ativas, Faturamento)
  ├─ useRecentOrders()           → Ordens Recentes
  ├─ useConversionChartData()    → Gráfico de Conversão
  ├─ useRevenueByClientData()    → Top Clientes por Faturamento
  ├─ useRsKmByRoute()            → Custo por Rota (R$/km)
  ├─ AiInsightsWidget
  │   ├─ useDashboardInsights()  → ai_insights (insight_type = 'dashboard_insights')
  │   ├─ useOperationalInsights()→ ai_insights (insight_type = 'operational_insights')
  │   └─ useRequestAiAnalysis()  → Edge Function (ai-financial-agent / ai-operational-agent)
  ├─ AutomationActivityFeed
  │   └─ useRecentWorkflowEvents()→ workflow_events (últimos 20)
  ├─ AiUsageDashboard
  │   └─ useAiUsageStats()       → RPC get_ai_usage_stats
  ├─ OverviewTab
  │   ├─ PerformanceCards        → usePerformanceMetrics() [avgDeliveryTime = 3.5 fake]
  │   ├─ MonthlyTrendsChart      → useMonthlyTrends()
  │   ├─ RecentOrdersList
  │   └─ AlertsWidget            → ⚠ mockAlerts (sem dados reais)
  ├─ OperationsTab
  │   ├─ MonthlyTrendsChart
  │   ├─ StageDistributionChart
  │   ├─ RecentOrdersList
  │   ├─ AlertsWidget            → ⚠ mockAlerts (sem dados reais)
  │   └─ Resumo Documentação     → stats.activeOrders vs stats.pendingDocuments
  └─ NtcInsightsTab
      └─ useNtcInsights()        → ntc_cost_indices, ntc_fuel_reference
```

---

## 7. Checklist de Prioridades

| Prioridade | Item | Arquivo |
|-----------|------|---------|
| 🔴 P1 | Substituir mockAlerts por dados reais | AlertsWidget.tsx |
| 🔴 P1 | Corrigir `toLocaleDateString` → `toLocaleString` | AiInsightsWidget.tsx |
| 🔴 P1 | Investigar e corrigir JWT 401 no trigger de AI | useAiInsights.ts |
| 🔴 P2 | Implementar `avgDeliveryTime` real | useAdvancedDashboardStats.tsx |
| 🟡 P2 | Adicionar `staleTime: 60_000` ao useDashboardStats | useDashboardStats.tsx |
| 🟡 P2 | Corrigir `conversionTrend` para variação relativa | useDashboardStats.tsx |
| 🟡 P2 | Atualizar mapeamento Edge Functions (P3 arch) | useAiInsights.ts |
| 🟡 P3 | Sincronizar refetchIntervals entre hooks | múltiplos |
| 🟡 P3 | Adicionar paginação ao AutomationActivityFeed | AutomationActivityFeed.tsx |
| 🟢 P4 | Empty states em NtcInsightsTab | NtcInsightsTab.tsx |
| 🟢 P4 | Unificar lógica de conversão rate | múltiplos hooks |

---

*Gerado em 2026-02-26 — Claude Code*
