---
name: navi-ops
description: Gerencia, audita, estende e documenta o Navi — assistente AI da Vectra Cargo no WhatsApp. Use ao implementar novas tools, revisar o system prompt, debugar interações, planejar novos fluxos conversacionais ou auditar o uso de tokens do Gemini.
---

# Skill: Operações Navi — Assistente WhatsApp AI

Você é especialista em manter e evoluir o **Navi**, assistente WhatsApp da Vectra Cargo. O Navi roda como Edge Function `nina-orchestrator` no Supabase, usa Gemini com function calling, e se comunica via WhatsApp Cloud API (Meta) através do OpenClaw.

---

## Arquitetura

```
WhatsApp (Meta) → OpenClaw → nina-orchestrator (Edge Function)
                                ├── System Prompt (embutido)
                                ├── Gemini 2.0 Flash (function calling)
                                ├── Tool Registry (tools/index.ts)
                                │   ├── sugerir_perdido
                                │   └── mover_para_perdido
                                └── session_messages (stateless, enviado pelo cliente)
```

- **Runtime**: Deno (Supabase Edge Functions)
- **LLM**: Gemini 2.0 Flash via API REST (não usa `_shared/gemini.ts` — chamada inline com function calling)
- **Tool loop**: máx 5 iterações (`processWithToolLoop`)
- **maxOutputTokens**: 2048
- **Temperature**: 0.3
- **Sessão**: stateless — o cliente envia `session_messages` completo a cada request

## Adicionando uma Nova Tool

1. **Criar handler** em `supabase/functions/nina-orchestrator/tools/nova_tool.ts`:
   - Exportar função `executeNovaTool(args: {...}): Promise<{...}>`
   - Usar `createClient` do Supabase com `SERVICE_ROLE_KEY` se precisar acessar dados
   - Retornar objeto JSON serializável (será passado ao Gemini como function response)

2. **Registrar declaration** em `tools/index.ts`:
   - Adicionar objeto no array `toolDeclarations` com `name`, `description` e `parameters` (JSON Schema)
   - `description` deve ser clara para o Gemini entender quando usar

3. **Adicionar case** no switch de `executeTool` em `tools/index.ts`:
   - Importar o handler
   - Fazer cast dos args para os tipos esperados

4. **Atualizar system prompt** em `index.ts` (se necessário):
   - Adicionar instruções de quando e como usar a nova tool
   - Definir formato de resposta esperado

5. **Testar localmente**:
   ```bash
   supabase functions serve nina-orchestrator --env-file supabase/.env.local
   ```

6. **Deploy** via push para branch → CI faz `supabase functions deploy nina-orchestrator`

## Roteamento Gemini (Flash vs Pro)

Ver detalhes em `references/gemini-routing-matrix.md`.

Resumo:
- **Flash** (padrão): conversação, cotações, status, sugestões — rápido e barato
- **Pro**: approval_summary, dashboard_insights — análises que exigem raciocínio profundo

No nina-orchestrator: sempre Flash (function calling direto).
No `_shared/gemini.ts`: roteamento via `selectGeminiModel(analysisType)`.

## Debugging

### Logs no Supabase Dashboard
1. Ir em **Edge Functions** → **nina-orchestrator** → **Logs**
2. Buscar por prefixo `[nina-orchestrator]`
3. Erros comuns:
   - `Gemini API error 429`: Rate limit — aguardar ou implementar backoff
   - `Gemini API error 500`: Indisponibilidade temporária do Gemini
   - `Tool desconhecida: X`: Tool chamada pelo Gemini não existe no registry

### Testando via curl
```bash
curl -X POST "https://ijkeuncfyaonjermwggl.supabase.co/functions/v1/nina-orchestrator" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d '{"message": "sugerir perdido", "session_messages": []}'
```

## Checklist de Deploy

- [ ] Tool funciona localmente com `supabase functions serve`
- [ ] System prompt atualizado (se nova tool)
- [ ] `toolDeclarations` tem description clara
- [ ] Parâmetros validados no handler (não confiar no Gemini)
- [ ] Sem secrets hardcoded — tudo via `Deno.env.get()`
- [ ] Testado com mensagens reais simuladas
- [ ] Push para branch → CI deploya automaticamente
