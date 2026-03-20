# Checklist: Investigação de Pedágio Zero

## Problema
Rotas retornam `total_toll_centavos = 0` e exibem "R$ 0,00 (sem pedagio)" no frontend.

## Fluxo de Dados
```
Frontend (LoadCompositionModal)
  ↓ POST /generate-optimal-route
  ↓ Edge Function: supabase/functions/generate-optimal-route/index.ts
  ↓ Calls calculateRouteDistanceFull() from webrouter-client.ts
  ↓ WebRouter API (https://way.webrouter.com.br/...)
  ↓ Returns response.rotas[0].informacaoPedagios OR custos.pedagio
  ↓ Converts to centavos → returns toll_total_centavos
  ↓ Response includes: { route_source: 'webrouter' | 'fallback_km', total_toll_centavos: number }
```

## Logs para Verificar

### 1️⃣ Verificar se WebRouter está sendo chamado (não caindo em fallback)

**Procurar por (generate-optimal-route):**
```
[generate-optimal-route] Calling WebRouter with: origin=01234567, dest=87654321, waypoints=2
```

**Se vir isto:**
```
[generate-optimal-route] WebRouter FAILED ✗ | error="..." | using fallback with zero toll
```
→ **WebRouter está falhando.** Verificar a mensagem de erro.

**Se vir isto:**
```
[generate-optimal-route] WebRouter SUCCESS ✓ | distance=1234.5km | toll=0¢ (R$0.00) | plazas=0 | coords=150
```
→ **WebRouter sucedeu, mas retornou zero pedágio.** Ir para passo 2.

---

### 2️⃣ Se WebRouter retornou sucesso + zero toll, procurar por (webrouter-full)

**Procurar por:**
```
[webrouter-full] ✓ API call successful | status="SUCESSO" | km=1234.5
```

**Depois procurar pelo diagnostic completo:**
```
[webrouter-full] 📊 TOLL CALCULATION:
  ├─ informacaoPedagios.result.pedagios count: 0
  ├─ sum from plazas: R$0.00 (0¢)
  ├─ custos.pedagio (fallback): 0 → 0¢
  ├─ tollFromPlazas > 0? false
  └─ FINAL: tollTotal=0¢ (R$0.00), tollTag=0¢
```

**Possíveis causas:**
- ✅ **Nenhuma praça de pedágio na rota** — route genuinely has no tolls
- ❌ **custos.pedagio está zerado** — API estrutura diferente ou preço não mapeado
- ❌ **informacaoPedagios vazio** — Array `pedagios` está vazio

---

### 3️⃣ Verificar se WEBROUTER_API_KEY está configurado

**Se vir isto no início:**
```
[webrouter-full] HTTP ERROR 401: ...
```
→ **API key ausente ou inválida.**

**Verificar em Supabase:**
1. Ir para: **Project Settings → Edge Functions → Secrets**
2. Procurar por: `WEBROUTER_API_KEY`
3. Se não existir → criar e adicionar a chave

---

## Fluxo de Debug Recomendado

### Step 1: Teste simples com coordenadas conhecidas
```bash
curl -X POST https://seu-projeto.supabase.co/functions/v1/generate-optimal-route \
  -H "Authorization: Bearer [KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "quote_ids": ["uuid1", "uuid2"],
    "composition_id": null
  }'
```

**Na resposta, procurar por:**
- `route_source`: é `'webrouter'` ou `'fallback_km'`?
- `total_toll_centavos`: qual o valor?
- Verificar logs Supabase → Functions → Logs

### Step 2: Se zero toll com route_source='webrouter'
Isso significa WebRouter retornou sucesso mas sem pedágio.
- **Opção 1**: Rota genuinamente não tem pedágio (ex: SP → interior SP)
- **Opção 2**: Dados de CEP da cotação estão errados
- **Opção 3**: WebRouter API estrutura mudou

### Step 3: Se route_source='fallback_km'
Significa calculateRouteDistanceFull() falhou.
- Verificar error message nos logs
- Procurar por: `[webrouter-full] HTTP ERROR` ou `[webrouter-full] API ERROR`

---

## Checklist de Verificação

- [ ] Logs mostram: `[generate-optimal-route] Calling WebRouter with: ...`?
- [ ] WebRouter retorna sucesso ou falha?
  - [ ] Sucesso: procurar por `WebRouter SUCCESS`
  - [ ] Falha: procurar por `WebRouter FAILED` + mensagem de erro
- [ ] Se sucesso: procurar por `informacaoPedagios.result.pedagios count:`
  - [ ] count > 0? Tem praças, mas sum = R$0.00? → API mudou estrutura
  - [ ] count = 0? → Sem praças na rota OU vazio por erro
- [ ] Verificar se `WEBROUTER_API_KEY` existe em Supabase Secrets
- [ ] Verificar se CEPs das cotações têm 8 dígitos válidos
- [ ] Rotar entre rotas diferentes para ver se **todas** retornam zero ou apenas algumas

---

## Possíveis Fixes (baseado no resultado)

| Causa | Fix |
|-------|-----|
| Rota genuinamente sem pedágio | Nenhum — exibir R$ 0,00 é correto |
| WEBROUTER_API_KEY faltando | Configurar secret em Supabase |
| CEP inválido | Validar/corrigir CEPs em quotes |
| Estrutura API mudou | Atualizar parsers em `webrouter-client.ts` |
| Edge Function com erro | Ver logs completos e stack trace |

---

## Referências
- Edge Function: `supabase/functions/generate-optimal-route/index.ts`
- WebRouter client: `supabase/functions/_shared/webrouter-client.ts`
- Frontend: `src/components/RouteMapVisualization.tsx`
- Logs: Supabase Dashboard → Edge Functions → Logs (real-time)
