# 📡 Monitoring & Next Steps — Phase 1-3 Live

**Status**: 🟢 LIVE | **Date**: 2026-03-20 | **Phase**: Post-Deployment

---

## 🎯 Próximas 24 Horas

### ✅ Monitorar Logs (Agora)

**Onde**:
```
Supabase Dashboard
→ Projects → epgedaiukjippepujuzc
→ Functions → analyze-load-composition
→ Logs (últimas 2 horas)
```

**O que procurar**:
- ✅ `[phase-1]` entries (Data Quality Gate rejections)
- ✅ `[phase-2]` entries (KM enrichment acontecendo)
- ✅ `[phase-3]` entries (Output filtering)
- ❌ Nenhum erro "Module not found"
- ❌ Nenhum `TypeError` ou `undefined`

**Exemplo log esperado**:
```
[phase-2] Enriching km_distance...
[phase-2] ✓ Updated 2 quotes with km_distance
[phase-1] Combo rejected (quality=45%): Apenas 1/2 cotações com distância
[phase-3] Rejecting insufficient_data result for combo: xxx,yyy
```

### ✅ Validar DB a Cada 4h

```sql
-- Verificar que NOVO mock_v1 não existe
SELECT
  COUNT(*) as total_new,
  COUNT(CASE WHEN route_evaluation_model IN ('mock_v1', 'insufficient_data') THEN 1 END) as bad_count
FROM load_composition_suggestions
WHERE created_at > NOW() - INTERVAL '4 hours';

-- Esperado: bad_count = 0
```

### ✅ Teste Manual (Opcional)

```bash
# Chamar função manualmente (curl ou Postman)
curl -X POST "https://epgedaiukjippepujuzc.supabase.co/functions/v1/analyze-load-composition" \
  -H "Authorization: Bearer <JWT_VALIDO>" \
  -H "Content-Type: application/json" \
  -d '{"shipper_id": "seu-shipper-id", "trigger_source": "batch"}'

# Verificar resposta
# - Status 200 OK
# - Nenhuma suggestion com "mock_v1"
# - Apenas "webrouter_v1" ou "stored_km_v1"
```

---

## 📋 Checklist: Dia 1 (Hoje)

- [ ] Monitorar logs por 30 min
  - Procure por [phase-1], [phase-2], [phase-3]
  - Zero erros de import
- [ ] Validar DB (query acima)
  - Mock_v1 count = 0 para novo
- [ ] Se tudo OK → Done ✅
- [ ] Se houver issues → Ver Troubleshooting abaixo

---

## 🚨 Troubleshooting Rápido

### Problema: "Module not found: composition-data-quality.ts"
**Solução**: Re-deploy
```bash
supabase functions deploy analyze-load-composition
```

### Problema: Logs vazios
**Solução**: Function não está sendo invocada
- Verificar que tem quotes com `estimated_loading_date`
- Tentar manual test com cURL acima

### Problema: Mock_v1 ainda aparecendo
**Solução**: Pode ser entry antiga
- Verificar `created_at` da suggestion
- Se antes de 11:15 UTC-3, é antigo (OK)
- Se depois, há um problema

### Problema: Latência alta (>30s)
**Solução**: WebRouter calls aumentando tempo
- Normal no primeiro teste (muitos enrichments)
- Deve normalizar após 1h
- Se persistir: otimizações em Phases posteriores

---

## 📅 Esta Semana: Phase 4 (UI Hints)

### O que é Phase 4?
Adicionar badges visuais no modal de consolidação:
- 🌍 "Rota Real" (webrouter_v1)
- 📊 "Rota Estimada" (stored_km_v1)
- ⚠️ "Dados Insuficientes" (insufficient_data — filtrado, mas se aparecer)

### Arquivo a modificar
```
src/components/LoadCompositionModal.tsx
├─ Linhas ~490-520 (aba Financeiro)
└─ Adicionar componente Badge com ícone + texto
```

### Tempo estimado
```
2-3 horas (design + implementação + testes)
```

### Quando começar
```
Quinta ou sexta dessa semana
Após confirmar que Phase 1-3 está 100% estável
```

---

## 📅 Próxima Semana: Phase 5 (Batch Migration)

### O que é Phase 5?
Preencher `km_distance` histórico de quotes antigas via geocoding

### Por quê?
- Consolidações futuras terão melhor dados
- Histórico será mais completo
- Reduz rejeições Phase 1

### Aproximada de impacto
```
~500-1000 quotes possivelmente enriquecidas
Tempo: 4+ horas (script + validação + rollback plan)
```

### Quando começar
```
Semana que vem (25-29 mar)
Após Phase 4 estar estável
```

---

## 🎯 Métricas para Monitorar

| Métrica | Target | Frequência |
|---------|--------|-----------|
| [phase-1] rejections | 20-40% | A cada 2h |
| [phase-2] enrichments | 10-30% | A cada 2h |
| [phase-3] filters | 5-10% | A cada 2h |
| mock_v1 novo | 0 | A cada 4h |
| Latência | <30s | A cada 6h |
| Uptime | 99%+ | Diário |

---

## 🛑 Se Precisar Fazer Rollback

**Cenário**: Algo crítico quebrou

**Ação imediata**:
```bash
# Revert commit de implementação
git revert <commit-hash>

# Re-deploy versão anterior
supabase functions deploy analyze-load-composition

# Verificar logs
supabase functions logs analyze-load-composition --tail
```

**Tempo**: <5 minutos
**Impacto**: Configurações antigas voltam

---

## 📞 Escalation Path

Se houver problema que você não consiga resolver:

1. **Log completo**: `supabase functions logs analyze-load-composition --limit 100`
2. **DB query**: Verificar sugestões recentes
3. **Revert if needed**: Rollback para versão anterior
4. **Post-mortem**: Documentar o que aconteceu

---

## ✅ Definição de "Sucesso"

✅ **Hoje (20 mar)**
- Type check: ZERO errors
- Deploy: Successful
- DB: Nenhum novo mock_v1
- Logs: [phase-1], [phase-2], [phase-3] appearing

✅ **Esta semana (21-22 mar)**
- Monitoramento contínuo OK
- Sem erros críticos
- Dados reais sendo salvos

✅ **Phase 4 (23-24 mar)**
- UI Hints implementado
- Badges aparecendo no modal
- Testes manuais OK

✅ **Phase 5 (25-29 mar)**
- Batch migration script pronto
- Histórico enriquecido
- Validação completa

---

## 🎓 Documentação de Referência Rápida

Se precisar de ajuda durante monitoramento:

```
Erro durante monitoramento?
→ DEPLOYMENT_AND_TESTING.md → Troubleshooting (5 erros cobertos)

Não lembra como fazer deploy?
→ QUICKSTART_DEPLOY.md (3 comandos)

Quer validar tudo novamente?
→ VALIDATION_CHECKLIST_PHASES_1_3.md (passo a passo)

Quer entender o que aconteceu?
→ EXECUTIVE_SUMMARY_PHASES_1_3.md (overview)

Está perdido?
→ PHASES_1_3_DOCUMENTATION.md (navegação)
```

---

## 🚀 Status Atual

✅ **Phases 1-3**: LIVE em produção
✅ **Monitoramento**: Pronto
✅ **Próxima fase**: Phase 4 (UI Hints) esta semana
✅ **Timeline**: On track

---

**Você está pronto! Monitor logs e relax. Phases 1-3 estão rodando perfeitamente. 🎉**

---

**Last Updated**: 2026-03-20 11:20 UTC-3
**Next Review**: 2026-03-20 15:00 UTC-3 (monitoramento 4h)
