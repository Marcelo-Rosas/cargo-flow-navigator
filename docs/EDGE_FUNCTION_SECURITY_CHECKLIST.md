# Checklist de Segurança — Edge Functions (Supabase)

Referência para criação e revisão de Edge Functions no Cargo Flow Navigator.

---

## 1. Autenticação

- [ ] JWT ou apikey verificado em todas as rotas protegidas
- [ ] `SUPABASE_SERVICE_ROLE_KEY` usado apenas server-side (nunca exposto ao cliente)
- [ ] CORS configurado via `getCorsHeaders()` de `_shared/cors.ts`
- [ ] Preflight `OPTIONS` tratado antes da lógica principal
- [ ] Funções públicas (webhook) têm `verify_jwt: false` explícito em `config.toml`

## 2. Validação de Input

- [ ] Todos os campos do `req.json()` validados antes de uso
- [ ] Strings sanitizadas (sem SQL injection via template literals)
- [ ] Arrays têm tamanho máximo validado
- [ ] UUIDs validados como formato correto antes de queries
- [ ] Enums validados contra valores permitidos

## 3. Gestão de Secrets

- [ ] Todas as chaves via `Deno.env.get()` (variáveis do Supabase Dashboard)
- [ ] Nenhuma API key hardcoded no código
- [ ] Nenhum secret nos logs (mesmo em debug)
- [ ] `.env` local nunca commitado (está no `.gitignore`)
- [ ] Secrets diferentes para dev e produção

## 4. CORS

- [ ] Usar `getCorsHeaders(req)` de `_shared/cors.ts` (origin-restricted)
- [ ] Não usar `Access-Control-Allow-Origin: *` em produção
- [ ] Origens permitidas: localhost (dev), vectracargo.com.br, *.cargo-flow-navigator.pages.dev

## 5. Tratamento de Erros

- [ ] Erros internos nunca expostos ao cliente (retornar mensagem genérica)
- [ ] Logs de erro com prefixo da função (ex: `[nina-orchestrator]`)
- [ ] Stack traces apenas em logs server-side
- [ ] Códigos HTTP corretos: 400 (input inválido), 401 (não autenticado), 403 (não autorizado), 500 (erro interno)

## 6. Rate Limiting (planejado)

> **Status**: Não implementado. Planejado para Sprint 3.

- [ ] Limite por número WhatsApp: 60 msg/min (Navi)
- [ ] Limite por IP para endpoints públicos
- [ ] Resposta 429 com `Retry-After` header

## 7. Chamadas a APIs Externas

- [ ] Timeout configurado (AbortController) — recomendado: 5000ms
- [ ] Fallback definido para quando API externa falha
- [ ] Credenciais de API externa via `Deno.env.get()` (nunca no código)
- [ ] Erros de API externa logados com status code e duração

## 8. Acesso a Dados

- [ ] Queries usam RLS quando possível (client com JWT do usuário)
- [ ] `SERVICE_ROLE_KEY` apenas quando RLS precisa ser bypassed (jobs, cron, webhooks)
- [ ] Nunca `SELECT *` — especificar colunas necessárias
- [ ] Dados retornados ao cliente são o mínimo necessário
- [ ] Dados sensíveis (CPF, CNPJ, telefone) nunca em logs

---

## Referências

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Supabase Edge Functions Security: https://supabase.com/docs/guides/functions/security
- CORS compartilhado: `supabase/functions/_shared/cors.ts`
