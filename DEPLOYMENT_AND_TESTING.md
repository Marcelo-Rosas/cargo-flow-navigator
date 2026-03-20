# 🚀 Deployment & Testing — Phases 1-3

**Objetivo**: Deploy da implementação em prod e validação com dados reais.

---

## 📋 Pré-requisitos

- [ ] Supabase CLI instalado (`supabase --version`)
- [ ] Acesso ao projeto Supabase: `epgedaiukjippepujuzc` (sa-east-1)
- [ ] JWT válido para testes manuais
- [ ] Acesso ao Cursor com Claude Code
- [ ] Terminal com `deno` (para logs)

---

## 🔧 Passo 1: Type Check Local

**Objetivo**: Garantir zero erros TypeScript antes de deploy.

```bash
cd ~/seu-repo/cargo-flow-navigator

# Full type check
npx tsc --noEmit

# Esperado:
# (nada — silêncio é ouro)
```

**Se houver erro**:
- Revise o arquivo mencionado
- Procure por imports faltando
- Verifique tipos em `composition-data-quality.ts`

**Status**: ✅ Já passou antes, espera-se que passe novamente.

---

## 🚀 Passo 2: Deploy da Edge Function

**Objetivo**: Publicar mudanças em produção.

```bash
# Deploy especificamente a function
supabase functions deploy analyze-load-composition --no-verify-jwt

# Saída esperada:
# Deploying function 'analyze-load-composition'...
# ✓ Deployed successfully to https://epgedaiukjippepujuzc.supabase.co/functions/v1/analyze-load-composition
```

**Se houver erro**:
- Verifique se JWT/token está correto
- Confirme que mudança em `composition-data-quality.ts` foi feita
- Tente novamente em 30 segundos (propagação de cache)

---

## 📊 Passo 3: Monitorar Logs

**Objetivo**: Verificar que a function está funcionando e vendo logs esperados.

```bash
# Terminal separado — deixe aberto
supabase functions logs analyze-load-composition --tail

# Saída esperada:
# 2026-03-20T10:15:23.456Z [analyze] batch — 5/5 quotes analyzed
# 2026-03-20T10:15:24.123Z [phase-2] Enriching km_distance...
# 2026-03-20T10:15:25.789Z [phase-1] Combo rejected (quality=45%)...
```

**Observar**:
- ✅ `[phase-2]` entries — enriquecimento acontecendo
- ✅ `[phase-1]` entries — gate rejeitando combos ruins
- ✅ `[phase-3]` entries — filtragem de insufficient_data
- ❌ Nenhum `mock_v1` nos novos entries
- ❌ Nenhum erro de import `composition-data-quality.ts`

---

## 🧪 Passo 4: Teste Manual com cURL

**Objetivo**: Validar que a API está respondendo corretamente.

### 4A. Obter JWT válido

```bash
# Opção 1: Do seu app em produção
# Abra DevTools → Application → Cookies → Procure por auth token

# Opção 2: Via CLI Supabase
supabase auth --project-id epgedaiukjippepujuzc

# Saída será um JWT token (copie)
JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 4B. Teste Batch (Découvert comum)

```bash
curl -X POST "https://epgedaiukjippepujuzc.supabase.co/functions/v1/analyze-load-composition" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "shipper_id": "550e8400-e29b-41d4-a716-446655440000",
    "trigger_source": "batch",
    "date_window_days": 14,
    "min_viable_score": 60
  }'

# Saída esperada:
# {
#   "suggestions": [...],
#   "total_found": 3,
#   "message": "..."
# }
```

**O que verificar**:
- ✅ HTTP 200 OK
- ✅ `suggestions` é array (pode ser vazio)
- ✅ Nenhum suggestion tem `route_evaluation_model: 'mock_v1'`
- ✅ Todos têm modelo real (`webrouter_v1` ou `stored_km_v1`)

### 4C. Teste com Dados Insuficientes

```bash
# Crie 2 quotes SEM km_distance em seu teste manual
# Depois chame a function

# Saída esperada:
# {
#   "suggestions": [],
#   "total_found": 0,
#   "message": "Dados insuficientes para consolidação..."
# }
```

**Logs esperados**:
```
[phase-1] Combo rejected (quality=30%): Apenas 0/2 cotações com distância (km)
```

---

## 🔍 Passo 5: Validação em DB

**Objetivo**: Confirmar que novas sugestões estão sendo salvas corretamente.

### 5A. Conectar ao Supabase CLI

```bash
# Abra o studio web
supabase projects list
# ou acesse: https://app.supabase.com/projects
```

### 5B. Query via SQL

```sql
-- Verificar sugestões recentes
SELECT
  id,
  shipper_id,
  quote_ids,
  consolidation_score,
  route_evaluation_model,
  is_feasible,
  created_at
FROM load_composition_suggestions
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;

-- Esperado:
-- Todos route_evaluation_model = 'webrouter_v1' ou 'stored_km_v1'
-- NENHUM = 'mock_v1' ou 'insufficient_data' (esses devem ser filtrados)
```

### 5C. Verificar enriquecimento KM

```sql
-- Ver quotes que foram enriquecidas
SELECT
  id,
  quote_code,
  km_distance,
  updated_at
FROM quotes
WHERE shipper_id = 'XXX'
  AND km_distance IS NOT NULL
  AND updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC
LIMIT 10;

-- Esperado:
-- km_distance preenchido com valores reais
-- updated_at recente
```

---

## 📈 Passo 6: Validação de Comportamento

**Objetivo**: Confirmar que as 3 phases funcionam como esperado.

### Phase 1: Data Quality Gate ✅

**Cenário**: 2 quotes, 1 com km_distance, 1 sem

```sql
-- Setup (execute em dev/staging se tiver access)
INSERT INTO quotes (shipper_id, origin, destination, origin_cep, destination_cep, km_distance, weight, value, estimated_loading_date, stage, client_name)
VALUES
  ('test-shipper', 'São Paulo - SP', 'Rio de Janeiro - RJ', '01310100', '20000000', 450, 5000, 10000000, '2026-03-25', 'precificacao', 'Cliente A'),
  ('test-shipper', 'São Paulo - SP', 'Belo Horizonte - MG', '01310100', '30130100', NULL, 3000, 8000000, '2026-03-25', 'precificacao', 'Cliente B');

-- Chamar function
-- Logs esperado:
-- [phase-1] Combo rejected (quality=45%): Apenas 1/2 cotações com distância (km)
```

### Phase 2: KM Enrichment ✅

**Cenário**: Quote sem km_distance, COM CEPs válidos

```sql
-- Setup
INSERT INTO quotes (shipper_id, origin, destination, origin_cep, destination_cep, km_distance, weight, value, estimated_loading_date, stage, client_name)
VALUES
  ('test-shipper', 'São Paulo - SP', 'Campinas - SP', '01310100', '13070000', NULL, 2000, 5000000, '2026-03-25', 'precificacao', 'Cliente C');

-- Chamar function
-- Logs esperado:
-- [phase-2] Enriching km_distance...
-- [phase-2] Calculating km for quote XXX (01310100 → 13070000)
-- [phase-2] ✓ Updated quote XXX with 106km
```

**Depois verificar DB**:
```sql
SELECT id, km_distance FROM quotes WHERE id = 'XXX';
-- Esperado: km_distance = 106 (ou valor recomendado)
```

### Phase 3: Output Filter ✅

**Cenário**: Combo que resultaria em insufficient_data é filtrado

```
Logs esperado:
[phase-3] Rejecting insufficient_data result for combo: xxx,yyy,zzz
[phase-3] Skipping insufficient_data result in WebRouter pass
```

**DB esperado**:
- Nenhuma sugestão com `route_evaluation_model = 'insufficient_data'` ou `'mock_v1'`

---

## ✅ Checklist de Validação

- [ ] Type check passa (`npx tsc --noEmit` = zero errors)
- [ ] Deploy executa sem erros
- [ ] Logs mostram `[phase-2]` entries
- [ ] Logs mostram `[phase-1]` rejections
- [ ] Logs mostram `[phase-3]` filtering
- [ ] cURL retorna 200 OK
- [ ] DB mostra 0 suggestions com `mock_v1` novo
- [ ] DB mostra km_distance preenchido (enriquecimento)
- [ ] Nenhum suggestion tem `insufficient_data` em output
- [ ] Scores são realistas (não NaN, não negativos)

---

## 🐛 Troubleshooting

### Erro: "composition-data-quality.ts not found"

```
Error: Module not found: ../composition-data-quality.ts
```

**Solução**:
1. Verificar que arquivo existe: `supabase/functions/_shared/composition-data-quality.ts`
2. Se não existir, recrie-o (veja `composition-data-quality.ts` nos files)
3. Confirmar path é relativo correto: `../` (um nível up)
4. Re-deploy

### Erro: "Type ... is not assignable to type RouteEvaluation"

```
[ts] Type '{ ..., model: "insufficient_data" }' is not assignable to type 'RouteEvaluation'
```

**Solução**:
1. Verificar que `type RouteEvaluation` tem `model: '...' | 'insufficient_data'`
2. Procurar em linha ~253 de `index.ts`
3. Confirmar que aparece: `'insufficient_data'` no union type

### Logs vazios (sem [phase-X] entries)

**Possível causa**: Function não está sendo disparada

**Verificar**:
1. É preciso ter quotes com `estimated_loading_date` preenchida
2. Testar com `trigger_source: 'manual'` primeiro (mais fácil debug)
3. Verificar logs: `supabase functions logs analyze-load-composition --limit 100`

### Mock_v1 ainda aparecendo em novos entries

**Possível causa**: Deploy não pegou mudança, ou hay old entries

**Verificar**:
1. Confirmar que `evaluateRouteFit()` tem o check KM_DATA_THRESHOLD (linha ~276)
2. Confirmar que ultimo retorno (fallback) usa `INSUFFICIENT_DATA_MODEL` (não `'mock_v1'`)
3. Re-deploy e aguarde 30s
4. Teste com novo quote (não antigo)

---

## 📞 Próximas Ações

### Imediatas (hoje)
1. ✅ Deploy
2. ✅ Verificar logs
3. ✅ Testar com cURL

### Curto prazo (esta semana)
4. Phase 4: UI Hints (badges "Rota Real" vs "Estimada")
5. Phase 5: Batch Migration (preencher km histórico)

### Médio prazo
6. Cleanup histórico: remover suggestions com `mock_v1`
7. Otimizações: cache de qualidade, paralelizar enriquecimento

---

## 📚 Referências

- CLI: https://supabase.com/docs/guides/cli
- Edge Functions: https://supabase.com/docs/guides/functions
- Logging: `supabase functions logs <name> --tail`
