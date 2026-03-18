# 📋 Deploy & Teste — Insurance Monitoring Dashboard

## ✅ Checklist Pré-Deploy

### 1. **Verificar Build Local**
```bash
# Na raiz do projeto
npm run build
```
- Aguarde a compilação completar sem erros
- Todos os TypeScript errors devem estar resolvidos

### 2. **Testar Lint**
```bash
npm run lint
```
- Verifique se não há warnings críticos em:
  - `src/pages/InsuranceMonitoringDashboard.tsx`
  - `src/components/forms/quote-form/steps/InsuranceStep.tsx`
  - `src/hooks/useInsuranceMonitoring.ts`

---

## 🚀 Deploy Steps

### **Localmente (dev mode)**
```bash
npm run dev
```
1. Abra `http://localhost:5173`
2. Faça login com credenciais de teste
3. Clique em **"Monit. Seguros"** na sidebar (deve aparecer após Relatórios)

### **Em Staging/Produção**
```bash
# Build otimizado
npm run build

# Deploy via seu workflow (ex: git push, Vercel, etc)
```

---

## 🧪 Teste 1: Navegação & Rota

**Objetivo:** Verificar se a rota é acessível

### Steps:
1. ✅ Sidebar mostra "Monit. Seguros" com ícone Activity
2. ✅ Clique leva a `/monitoramento-seguros`
3. ✅ Página carrega com header "Monitoramento de Seguros"
4. ✅ 4 cards de status (Disponibilidade, Latência, Taxa Erro, Fallback) aparecem
5. ✅ Seletor de período (1h, 24h, 7d) funciona

**Esperado:** Página renderiza, cards mostram "Carregando..." inicialmente

---

## 🧪 Teste 2: Hooks de Dados

**Objetivo:** Validar que os 5 hooks consomem as SQL views

### A. Testar `useInsuranceVolumeMetrics`
```typescript
// No console do navegador, rode:
const query = useInsuranceVolumeMetrics('24h');
console.log(query);
```
- Deve retornar: `{ data: [...], isLoading: boolean, isError: boolean, ... }`
- `data` deve ser array com `{ time_bucket, requests_total, success_count, ... }`

### B. Verificar em Supabase
```sql
-- Supabase Console → SQL Editor
SELECT * FROM insurance_metrics_volume
WHERE time_bucket >= NOW() - INTERVAL '24 hours'
LIMIT 5;
```
- Deve retornar dados com bucket de 1 hora

### C. Testar outros hooks
```typescript
useInsuranceLatencyMetrics('24h')    // p50, p95, p99
useInsuranceErrorBreakdown('24h')    // status breakdown
useInsuranceFallbackRatio('1h')      // fallback %
useInsuranceStatusSummary()          // 30-min summary
```

**Esperado:** Todos retornam dados ou fallback vazio (sem erro)

---

## 🧪 Teste 3: Edge Function

**Objetivo:** Verificar se `buonny-check-worker` está logando corretamente

### A. Invocar via CLI
```bash
# Terminal (na raiz do projeto)
supabase functions invoke buonny-check-worker \
  --header "Content-Type: application/json" \
  -d '{
    "origin_uf": "SP",
    "destination_uf": "RJ",
    "weight": 1000,
    "product_type": "general"
  }'
```

**Esperado:**
```json
{
  "options": [
    {
      "coverage_type": "basic",
      "estimated_premium": 50000,
      "features": [...],
      "restrictions": [...]
    },
    ...
  ],
  "cached": false,
  "timestamp": "2026-03-17T..."
}
```

### B. Verificar Logs em Supabase
```sql
-- Supabase Console → SQL Editor
SELECT
  id,
  request_id,
  status,
  duration_ms,
  fallback_used,
  created_at
FROM insurance_logs
ORDER BY created_at DESC
LIMIT 10;
```

**Esperado:** Linhas aparecem para cada invocação com `status = 'success'` ou `'fallback'`

---

## 🧪 Teste 4: Dashboard Completo

**Objetivo:** Testar visualização de dados em tempo real

### A. Gerar dados de teste
```bash
# Chamar Edge Function múltiplas vezes com diferentes parâmetros
for i in {1..5}; do
  supabase functions invoke buonny-check-worker \
    --header "Content-Type: application/json" \
    -d "{
      \"origin_uf\": \"SP\",
      \"destination_uf\": \"RJ\",
      \"weight\": $((1000 + RANDOM % 5000)),
      \"product_type\": \"general\"
    }"
  sleep 1
done
```

### B. Abrir Dashboard
1. Navegue para `/monitoramento-seguros`
2. Aguarde 5-10 segundos para TanStack Query buscar dados

### C. Validar Painéis

| Painel | Checklist |
|--------|-----------|
| **Volume & Taxa** | Gráfico de linha com 2 eixos Y; dados aparecem |
| **Latência P50/P95/P99** | Gráfico de área com 3 cores; valores crescentes P50→P95→P99 |
| **Erro Breakdown** | Gráfico de barras; categorias: Success, Error, Timeout, RateLimit, Fallback |
| **Fallback Ratio** | Card com % de fallback; cor verde/amarelo/vermelho conforme alert_level |
| **Status Summary** | 4 cards com Uptime %, Latência ms, Taxa Erro %, Fallback % |

### D. Testar Interatividade
- ✅ Clique em botão **Atualizar** → deve fazer refresh de todos os dados
- ✅ Clique em botão **Exportar** → deve baixar JSON com métricas
- ✅ Mude período (1h → 24h → 7d) → gráficos devem se atualizar
- ✅ Erro state: Desative a API Buonny e veja se alerta de erro aparece

---

## 🧪 Teste 5: Integração com InsuranceStep

**Objetivo:** Testar se o quote form ainda funciona após refatoração

### Steps:
1. Navegue para `/comercial` → Nova Cotação
2. Preencha origem/destino/peso
3. Na aba **Seguro de Carga**, verifique:
   - ✅ Loading spinner aparece enquanto busca opções
   - ✅ 3 opções aparecem (Basic, Standard, Plus) — ou fallback em caso de erro
   - ✅ Seleção de cobertura funciona
   - ✅ Summary mostra features/restrictions
   - ✅ Form field `insurance_coverage_type` preenche corretamente

---

## ⚠️ Troubleshooting

### Problema: "Property 'data' does not exist"
**Solução:** Limpe cache TypeScript
```bash
rm -rf dist/ .turbo/
npm run build
```

### Problema: Dashboard mostra "Sem dados para o período"
**Solução:** Verifique se as views SQL existem
```sql
SELECT * FROM insurance_metrics_volume LIMIT 1;
SELECT * FROM insurance_metrics_latency LIMIT 1;
```

### Problema: Edge Function retorna erro 500
**Solução:** Verifique logs da função
```bash
supabase functions logs buonny-check-worker
```

### Problema: Sidebar não mostra "Monit. Seguros"
**Solução:** Verifique se você tem role `admin`, `financeiro` ou `operacional`

---

## 📊 Métricas de Sucesso

| Métrica | Alvo |
|---------|------|
| Build Time | < 60s |
| Dashboard Load | < 3s (primeira vez), < 500ms (cached) |
| Chart Render | Suave, sem lag |
| Erros Console | 0 erros TypeScript |
| ESLint Warnings | 0 critérios |

---

## 📝 Notas Importantes

1. **TanStack Query Cache:** Dados com `staleTime: 5min` — atualizam automaticamente
2. **Fallback:** Se Buonny API falhar, Edge Function retorna `DEFAULT_COVERAGE_OPTIONS`
3. **RLS:** Views são públicas (sem policy) — em prod, adicionar RLS se necessário
4. **Alertas de Fallback:**
   - 🟢 Verde: < 10%
   - 🟡 Amarelo: 10-20%
   - 🔴 Vermelho: > 20%

---

## ✨ Após Deploy Bem-Sucedido

1. ✅ Documentar URL de produção
2. ✅ Configurar uptime monitoring (alertar se fallback > 30%)
3. ✅ Criar runbook: "O que fazer quando Dashboard mostra 🔴"
4. ✅ Treinar time: Como interpretar os gráficos

---

**Status:** ✅ Pronto para Deploy

Quer testar agora? 🚀
